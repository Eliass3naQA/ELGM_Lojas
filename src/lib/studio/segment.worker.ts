/// <reference lib="webworker" />
// Recorte do veículo no próprio navegador do vendedor (sem custo e sem enviar a foto a terceiros).
// Modelo: BiRefNet lite (licença MIT), via transformers.js. Usa WebGPU quando a placa aguenta; senão, WASM.
import { AutoModel, AutoProcessor, env, RawImage, type PreTrainedModel, type Processor } from "@huggingface/transformers";

// Mesmo modelo (BiRefNet lite, MIT) em duas resoluções fixas:
// - 1024 px na GPU: melhor recorte de bordas;
// - 512 px no WASM: em 1024 px o WASM estoura o limite de 4 GB de memória (bad_alloc).
// Os arquivos ficam no Storage do próprio projeto (bucket "models", publicado por `npm run models:upload`),
// divididos em partes de 45 MB que são baixadas em paralelo. O Hugging Face fica só como reserva.
const MODELS = {
  webgpu: { id: "birefnet-lite-1024", hf: "onnx-community/BiRefNet_lite-ONNX", dtype: "fp16" },
  wasm: { id: "birefnet-lite-512", hf: "studioludens/birefnet-lite-512", dtype: "fp32" },
} as const;
const HOST = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/models/`;
env.allowLocalModels = false;
env.remoteHost = HOST;
env.remotePathTemplate = "{model}/";
env.fetch = fetchModelFile;

/** Baixa um arquivo do modelo: partes em paralelo (com progresso) a partir do Storage; se falhar, do Hugging Face. */
async function fetchModelFile(input: string | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  if (!url.startsWith(HOST)) return fetch(input, init);
  try {
    if (!url.endsWith(".onnx")) {
      const res = await fetch(url, init);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    }
    const manifest = await fetch(`${url}.parts.json`, { cache: "no-store" });
    if (!manifest.ok) throw new Error(`HTTP ${manifest.status}`);
    const { parts, size } = (await manifest.json()) as { parts: number; size: number };
    const loaded = new Array<number>(parts).fill(0);
    let lastPost = 0;
    const chunks = await Promise.all(
      Array.from({ length: parts }, async (_, i) => {
        const res = await fetch(`${url}.part${i}`);
        if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
        const reader = res.body.getReader();
        const pieces: Uint8Array[] = [];
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          pieces.push(value);
          loaded[i] += value.length;
          const now = Date.now();
          if (now - lastPost > 250) {
            lastPost = now;
            post({ type: "progress", loaded: loaded.reduce((a, b) => a + b, 0), total: size });
          }
        }
        return new Blob(pieces as BlobPart[]);
      }),
    );
    post({ type: "progress", loaded: size, total: size });
    return new Response(new Blob(chunks), { headers: { "content-type": "application/octet-stream", "content-length": String(size) } });
  } catch {
    // reserva: mesmo arquivo direto do Hugging Face
    const [model, ...file] = url.slice(HOST.length).split("/");
    const hf = Object.values(MODELS).find((m) => m.id === model)?.hf;
    if (!hf) throw new Error(`Modelo desconhecido: ${model}`);
    return fetch(`https://huggingface.co/${hf}/resolve/main/${file.join("/")}`, init);
  }
}

// O BiRefNet usa shaders com 17 storage buffers; GPUs que suportam menos falham na execução.
const MIN_STORAGE_BUFFERS = 17;

export type SegmentRequest = { id: number; image: Blob };
export type SegmentControl = { warmup: true } | { gpu: false };
export type SegmentEvent =
  | { type: "progress"; loaded: number; total: number }
  | { type: "ready"; device: "webgpu" | "wasm" }
  | { type: "result"; id: number; width: number; height: number; channels: number; mask: Uint8Array }
  // gpu: a falha veio da GPU — a página recria o worker em modo WASM e tenta de novo
  | { type: "error"; id: number | null; message: string; gpu?: boolean };

const post = (e: SegmentEvent, transfer: Transferable[] = []) => (self as DedicatedWorkerGlobalScope).postMessage(e, transfer);

let loading: Promise<{ model: PreTrainedModel; processor: Processor; device: "webgpu" | "wasm" }> | null = null;
let allowGpu = true;

type Adapter = { limits: { maxStorageBuffersPerShaderStage: number } };
async function gpuUsable() {
  if (!allowGpu) return false;
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<Adapter | null> } }).gpu;
    const adapter = gpu && (await gpu.requestAdapter());
    return !!adapter && adapter.limits.maxStorageBuffersPerShaderStage >= MIN_STORAGE_BUFFERS;
  } catch {
    return false;
  }
}

/** Motor de execução (ONNX Runtime WASM) também vem do Storage, publicado por `npm run models:upload`; senão, do CDN padrão. */
async function useHostedRuntime() {
  const onnx = env.backends.onnx as { versions?: { web?: string }; wasm?: { wasmPaths?: unknown } };
  const version = onnx.versions?.web;
  if (!version || !onnx.wasm) return;
  const prefix = `${HOST}ort/${version}/`;
  const ok = await fetch(`${prefix}ort-wasm-simd-threaded.asyncify.mjs`, { method: "HEAD" }).then((r) => r.ok, () => false);
  if (ok) onnx.wasm.wasmPaths = prefix;
}

function load() {
  return (loading ??= (async () => {
    await useHostedRuntime();
    const device: "webgpu" | "wasm" = (await gpuUsable()) ? "webgpu" : "wasm";
    // download: ~115 MB (GPU, fp16) ou ~192 MB (WASM, fp32); depois fica no cache do navegador.
    // O progresso é informado pelo fetchModelFile, que baixa as partes.
    const { id, dtype } = MODELS[device];
    const model = await AutoModel.from_pretrained(id, { device, dtype });
    const processor = await AutoProcessor.from_pretrained(id, {});
    post({ type: "ready", device });
    return { model, processor, device };
  })().catch((e) => {
    loading = null; // permite tentar de novo
    throw e;
  }));
}

self.onmessage = async (ev: MessageEvent<SegmentRequest | SegmentControl>) => {
  const msg = ev.data;
  if ("gpu" in msg) {
    allowGpu = false;
    return;
  }
  if ("warmup" in msg) {
    load().catch((e) => post({ type: "error", id: null, message: String(e?.message ?? e) }));
    return;
  }
  let device: "webgpu" | "wasm" | null = null;
  try {
    const image = await RawImage.fromBlob(msg.image);
    const loaded = await load();
    device = loaded.device;
    const { pixel_values } = await loaded.processor(image);
    const { output_image } = await loaded.model({ input_image: pixel_values });
    // máscara alfa (0–255) no tamanho da foto enviada
    const mask = await RawImage.fromTensor(output_image[0].sigmoid().mul(255).to("uint8")).resize(image.width, image.height);
    const data = new Uint8Array(mask.data.buffer.slice(0));
    post({ type: "result", id: msg.id, width: image.width, height: image.height, channels: mask.channels, mask: data }, [data.buffer]);
  } catch (e) {
    post({ type: "error", id: msg.id, message: String((e as Error)?.message ?? e), gpu: device === "webgpu" });
  }
};
