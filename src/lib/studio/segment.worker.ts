/// <reference lib="webworker" />
// Recorte do veículo no próprio navegador do vendedor (sem custo e sem enviar a foto a terceiros).
// Modelo: BiRefNet lite (licença MIT), via transformers.js. Usa WebGPU quando a placa aguenta; senão, WASM.
import { AutoModel, AutoProcessor, env, RawImage, type PreTrainedModel, type Processor } from "@huggingface/transformers";

// Mesmo modelo (BiRefNet lite, MIT) em duas resoluções fixas:
// - 1024 px na GPU: melhor recorte de bordas;
// - 512 px no WASM: em 1024 px o WASM estoura o limite de 4 GB de memória (bad_alloc).
const MODELS = {
  webgpu: { id: "onnx-community/BiRefNet_lite-ONNX", dtype: "fp16" },
  wasm: { id: "studioludens/birefnet-lite-512", dtype: "fp32" },
} as const;
env.allowLocalModels = false;

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

function load() {
  return (loading ??= (async () => {
    const device: "webgpu" | "wasm" = (await gpuUsable()) ? "webgpu" : "wasm";
    const files = new Map<string, { loaded: number; total: number }>();
    const progress_callback = (p: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (p.status !== "progress" || !p.file) return;
      files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 });
      let loaded = 0;
      let total = 0;
      for (const f of files.values()) {
        loaded += f.loaded;
        total += f.total;
      }
      post({ type: "progress", loaded, total });
    };
    // download: ~115 MB (GPU, fp16) ou ~192 MB (WASM, fp32); depois fica no cache do navegador
    const { id, dtype } = MODELS[device];
    const model = await AutoModel.from_pretrained(id, { device, dtype, progress_callback });
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
