// Estúdio fotográfico no navegador: recorta o veículo da foto (IA local) e o aplica sobre um cenário.
// Saídas por foto:
//   original → a foto do vendedor, reduzida (até 2400 px)
//   cutout   → só o veículo, fundo transparente, recortado justo
//   stage    → veículo enquadrado de forma padronizada, fundo transparente (usado no showroom 360°)
//   square   → foto de catálogo 1:1 com o cenário escolhido (vitrine e galeria)
// O enquadramento depende só do tamanho do recorte, então todas as fotos de um veículo ficam alinhadas
// e trocar o cenário não exige rodar a IA de novo.
import { api } from "../api-client";
import type { StudioScene } from "../types";
import type { SegmentEvent } from "./segment.worker";

const MAX_SIDE = 2400;
const MAX_UPLOAD = 4.8 * 1024 * 1024;

// ---------------------------------------------------------------- IA (worker)

type Pending = { image: Blob; resolve: (r: Extract<SegmentEvent, { type: "result" }>) => void; reject: (e: Error) => void };
let worker: Worker | null = null;
let gpuDisabled = false;
let seq = 0;
const pending = new Map<number, Pending>();
const listeners = new Set<(e: SegmentEvent) => void>();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./segment.worker.ts", import.meta.url), { type: "module" });
  if (gpuDisabled) worker.postMessage({ gpu: false });
  worker.onmessage = (ev: MessageEvent<SegmentEvent>) => {
    const e = ev.data;
    if (e.type === "error" && e.gpu && !gpuDisabled) {
      // a placa de vídeo não deu conta do modelo: recria o worker do zero em modo WASM e refaz o que estava na fila
      gpuDisabled = true;
      worker?.terminate();
      worker = null;
      const retry = [...pending.entries()];
      for (const [id, p] of retry) getWorker().postMessage({ id, image: p.image });
      return;
    }
    listeners.forEach((l) => l(e));
    if (e.type === "result") {
      pending.get(e.id)?.resolve(e);
      pending.delete(e.id);
    } else if (e.type === "error") {
      if (e.id === null) pending.forEach((p) => p.reject(new Error(e.message)));
      else pending.get(e.id)?.reject(new Error(e.message));
      if (e.id === null) pending.clear();
      else pending.delete(e.id);
    }
  };
  return worker;
}

/** Acompanha o download do modelo (progress) e quando ele fica pronto. */
export function onStudioEvent(listener: (e: SegmentEvent) => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Começa a baixar o modelo antes da primeira foto (ex.: quando o vendedor liga o estúdio). */
export function warmupStudio() {
  getWorker().postMessage({ warmup: true });
}

function segment(image: Blob) {
  const id = ++seq;
  return new Promise<Extract<SegmentEvent, { type: "result" }>>((resolve, reject) => {
    pending.set(id, { image, resolve, reject });
    getWorker().postMessage({ id, image });
  });
}

// ---------------------------------------------------------------- utilidades de imagem

const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.round(w);
  c.height = Math.round(h);
  return c;
};

function toBlob(c: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar a imagem."))), type, quality));
}

/** WebP quando o navegador suporta (com transparência); reduz até caber no limite de upload. */
async function encode(c: HTMLCanvasElement, opaque: boolean): Promise<Blob> {
  let src = c;
  for (let i = 0; i < 4; i++) {
    let blob = await toBlob(src, "image/webp", 0.9);
    if (blob.type !== "image/webp") blob = await toBlob(src, opaque ? "image/jpeg" : "image/png", 0.9);
    if (blob.size <= MAX_UPLOAD) return blob;
    const smaller = canvas(src.width * 0.8, src.height * 0.8);
    smaller.getContext("2d")!.drawImage(src, 0, 0, smaller.width, smaller.height);
    src = smaller;
  }
  throw new Error("A imagem ficou grande demais.");
}

export function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // o Storage libera CORS; sem isso o canvas não pode ser exportado
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
    img.src = url;
  });
}

/** Lê a foto respeitando a orientação do celular e reduz para no máximo 2400 px. */
async function normalize(file: Blob) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = canvas(bmp.width * scale, bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c;
}

export async function uploadBlob(slug: string, blob: Blob, name: string) {
  const ext = blob.type.split("/")[1] ?? "png";
  const form = new FormData();
  form.append("file", new File([blob], `${name}.${ext}`, { type: blob.type }));
  return (await api<{ url: string }>(`/api/stores/${slug}/uploads`, "POST", form)).url;
}

/** Envia uma foto comum (detalhes, fotos sem estúdio), já reduzida e na orientação certa. */
export async function uploadPhoto(slug: string, file: File) {
  const c = await normalize(file);
  return uploadBlob(slug, await encode(c, true), "foto");
}

// ---------------------------------------------------------------- enquadramento

export type Kind = "ring" | "top";
export const STAGE = { ring: { w: 2400, h: 1200 }, top: { w: 1600, h: 1600 } } as const;

/** Posição do recorte (cw × ch) dentro de uma imagem W × H. Determinística: mesmo recorte → mesmo lugar. */
function place(cw: number, ch: number, W: number, H: number, kind: Kind, target: "stage" | "catalog") {
  if (kind === "top") {
    const s = Math.min((W * 0.86) / cw, (H * 0.86) / ch);
    return { s, x: (W - cw * s) / 2, y: (H - ch * s) / 2, baseline: (H + ch * s) / 2 };
  }
  const [mw, mh, base] = target === "stage" ? [0.92, 0.88, 0.96] : [0.9, 0.6, 0.76];
  const s = Math.min((W * mw) / cw, (H * mh) / ch);
  const baseline = H * base;
  return { s, x: (W - cw * s) / 2, y: baseline - ch * s, baseline };
}

/** Recorte dentro da foto original: tamanho da foto (w, h) e caixa do veículo (x, y, cw, ch), em px. */
export interface Frame {
  w: number;
  h: number;
  x: number;
  y: number;
  cw: number;
  ch: number;
}

/** Converte um ponto (% da foto original) para % da imagem do showroom, e vice-versa. */
export function originalToStage(p: { x: number; y: number }, f: Frame, kind: Kind) {
  const { w: W, h: H } = STAGE[kind];
  const pl = place(f.cw, f.ch, W, H, kind, "stage");
  return { x: clampPct((((p.x / 100) * f.w - f.x) * pl.s + pl.x) / W), y: clampPct((((p.y / 100) * f.h - f.y) * pl.s + pl.y) / H) };
}
export function stageToOriginal(p: { x: number; y: number }, f: Frame, kind: Kind) {
  const { w: W, h: H } = STAGE[kind];
  const pl = place(f.cw, f.ch, W, H, kind, "stage");
  return { x: clampPct(((((p.x / 100) * W - pl.x) / pl.s + f.x) / f.w)), y: clampPct(((((p.y / 100) * H - pl.y) / pl.s + f.y) / f.h)) };
}
const clampPct = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 1000) / 10;

// ---------------------------------------------------------------- cenários

function drawScene(ctx: CanvasRenderingContext2D, W: number, H: number, scene: StudioScene, brand: string, logo: HTMLImageElement | null, floor: number) {
  const fl = floor / H;
  const linear = (stops: [number, string][]) => {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    stops.forEach(([o, c]) => g.addColorStop(Math.min(1, Math.max(0, o)), c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  };
  const radial = (cx: number, cy: number, r: number, stops: [number, string][], sy = 1) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, sy);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    stops.forEach(([o, c]) => g.addColorStop(o, c));
    ctx.fillStyle = g;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  };

  if (scene === "dark" || scene === "brand") {
    linear([[0, "#15181f"], [fl - 0.08, "#0d0f14"], [fl, "#0a0b0f"], [1, "#030304"]]);
    radial(W / 2, H * 0.38, W * 0.75, [[0, "rgb(70 76 92 / 0.55)"], [1, "rgb(0 0 0 / 0)"]], 0.8);
    if (scene === "brand") radial(W / 2, floor, W * 0.55, [[0, hexA(brand, 0.55)], [1, hexA(brand, 0)]], 0.45);
    // piso: brilho de holofote
    radial(W / 2, floor + H * 0.04, W * 0.48, [[0, "rgb(255 255 255 / 0.08)"], [1, "rgb(255 255 255 / 0)"]], 0.18);
    if (scene === "brand") {
      ctx.save();
      ctx.strokeStyle = "rgb(255 255 255 / 0.09)";
      ctx.lineWidth = Math.max(1, W / 900);
      ctx.beginPath();
      ctx.ellipse(W / 2, floor + H * 0.02, W * 0.44, H * 0.06, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    return;
  }
  // cenários claros: parede e piso unidos por uma curva suave (fundo infinito)
  const palette = scene === "beige" ? ["#f4ede2", "#ece2d3", "#e4d8c5", "#cdbfa8"] : ["#fbfbfc", "#f0f0f2", "#e9e9ec", "#d3d3d8"];
  linear([[0, palette[0]], [fl - 0.06, palette[1]], [fl + 0.04, palette[2]], [1, palette[3]]]);
  radial(W / 2, H * 0.35, W * 0.7, [[0, "rgb(255 255 255 / 0.55)"], [1, "rgb(255 255 255 / 0)"]], 0.7);
  if (scene === "logo" && logo) {
    const lh = H * 0.13;
    const lw = (logo.width / logo.height) * lh;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.drawImage(logo, (W - lw) / 2, H * 0.07, lw, lh);
    ctx.restore();
    ctx.fillStyle = hexA(brand, 0.85);
    ctx.fillRect(W * 0.42, H * 0.07 + lh + H * 0.02, W * 0.16, Math.max(2, H * 0.004));
  }
}

function hexA(hex: string, a: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgb(${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255} / ${a})`;
}

/** Foto de catálogo quadrada: cenário + sombra + reflexo + veículo. */
function renderCatalog(cut: CanvasImageSource & { width: number; height: number }, kind: Kind, scene: StudioScene, brand: string, logo: HTMLImageElement | null) {
  const W = 1600;
  const H = 1600;
  const pl = place(cut.width, cut.height, W, H, kind, "catalog");
  const c = canvas(W, H);
  const ctx = c.getContext("2d")!;
  drawScene(ctx, W, H, scene, brand, logo, kind === "ring" ? pl.baseline : H * 0.82);
  const cw = cut.width * pl.s;
  const ch = cut.height * pl.s;
  const dark = scene === "dark" || scene === "brand";

  if (kind === "ring") {
    // reflexo no piso (espelhado na linha de base e esmaecendo)
    const refl = canvas(W, H);
    const r = refl.getContext("2d")!;
    r.translate(0, pl.baseline * 2);
    r.scale(1, -1);
    r.drawImage(cut, pl.x, pl.y, cw, ch);
    r.setTransform(1, 0, 0, 1, 0, 0);
    r.globalCompositeOperation = "destination-in";
    const g = r.createLinearGradient(0, pl.baseline, 0, pl.baseline + ch * 0.55);
    g.addColorStop(0, `rgb(0 0 0 / ${dark ? 0.32 : 0.16})`);
    g.addColorStop(1, "rgb(0 0 0 / 0)");
    r.fillStyle = g;
    r.fillRect(0, 0, W, H);
    ctx.drawImage(refl, 0, 0);
  }
  // sombra de contato
  ctx.save();
  ctx.translate(W / 2, kind === "ring" ? pl.baseline : pl.y + ch * 0.55);
  ctx.scale(1, kind === "ring" ? 0.075 : 0.9);
  const rx = cw * (kind === "ring" ? 0.56 : 0.6);
  const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  sg.addColorStop(0, `rgb(0 0 0 / ${dark ? 0.75 : 0.6})`);
  sg.addColorStop(0.6, `rgb(0 0 0 / ${dark ? 0.35 : 0.26})`);
  sg.addColorStop(1, "rgb(0 0 0 / 0)");
  ctx.fillStyle = sg;
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
  ctx.restore();

  ctx.drawImage(cut, pl.x, pl.y, cw, ch);
  return c;
}

/** Veículo enquadrado sobre fundo transparente, para o showroom. */
function renderStage(cut: CanvasImageSource & { width: number; height: number }, kind: Kind) {
  const { w: W, h: H } = STAGE[kind];
  const pl = place(cut.width, cut.height, W, H, kind, "stage");
  const c = canvas(W, H);
  c.getContext("2d")!.drawImage(cut, pl.x, pl.y, cut.width * pl.s, cut.height * pl.s);
  return c;
}

// ---------------------------------------------------------------- fluxo completo

export interface StudioResult {
  original: string;
  cutout: string;
  stage: string;
  square: string;
  frame: Frame;
}

export type Step = "preparando" | "recortando" | "compondo" | "enviando";

/** Foto do celular → recorte por IA → imagens do showroom e do catálogo, já enviadas ao Storage. */
export async function processVehiclePhoto(o: { slug: string; file: File; kind: Kind; scene: StudioScene; brand: string; logoUrl: string | null; onStep?: (s: Step) => void }): Promise<StudioResult> {
  o.onStep?.("preparando");
  const photo = await normalize(o.file);
  const originalBlob = await encode(photo, true);

  o.onStep?.("recortando");
  const seg = await segment(originalBlob);
  if (seg.width !== photo.width || seg.height !== photo.height) throw new Error("Falha ao recortar a foto.");

  // aplica a máscara como transparência e acha a caixa do veículo
  const ctx = photo.getContext("2d")!;
  const img = ctx.getImageData(0, 0, photo.width, photo.height);
  let minX = photo.width;
  let minY = photo.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0, i = 0; y < photo.height; y++) {
    for (let x = 0; x < photo.width; x++, i++) {
      const a = seg.mask[i * seg.channels];
      img.data[i * 4 + 3] = a;
      if (a > 96) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0 || (maxX - minX) * (maxY - minY) < photo.width * photo.height * 0.01) {
    throw new Error("Não encontrei um veículo nesta foto. Tente uma foto com o carro inteiro e mais centralizado.");
  }
  const pad = Math.round(Math.max(photo.width, photo.height) * 0.006);
  const frame: Frame = { w: photo.width, h: photo.height, x: Math.max(0, minX - pad), y: Math.max(0, minY - pad), cw: 0, ch: 0 };
  frame.cw = Math.min(photo.width, maxX + pad + 1) - frame.x;
  frame.ch = Math.min(photo.height, maxY + pad + 1) - frame.y;
  const masked = canvas(photo.width, photo.height);
  masked.getContext("2d")!.putImageData(img, 0, 0);
  const cut = canvas(frame.cw, frame.ch);
  cut.getContext("2d")!.drawImage(masked, frame.x, frame.y, frame.cw, frame.ch, 0, 0, frame.cw, frame.ch);

  o.onStep?.("compondo");
  const logo = o.scene === "logo" && o.logoUrl ? await loadImage(o.logoUrl).catch(() => null) : null;
  const [stageBlob, squareBlob, cutBlob] = await Promise.all([encode(renderStage(cut, o.kind), false), encode(renderCatalog(cut, o.kind, o.scene, o.brand, logo), true), encode(cut, false)]);

  o.onStep?.("enviando");
  const [original, cutout, stage, square] = await Promise.all([
    uploadBlob(o.slug, originalBlob, "original"),
    uploadBlob(o.slug, cutBlob, "recorte"),
    uploadBlob(o.slug, stageBlob, "showroom"),
    uploadBlob(o.slug, squareBlob, "catalogo"),
  ]);
  return { original, cutout, stage, square, frame };
}

/** Novo cenário a partir do recorte já salvo (sem rodar a IA de novo). */
export async function rerenderCatalog(o: { slug: string; cutoutUrl: string; kind: Kind; scene: StudioScene; brand: string; logoUrl: string | null }) {
  const [cut, logo] = await Promise.all([loadImage(o.cutoutUrl), o.scene === "logo" && o.logoUrl ? loadImage(o.logoUrl).catch(() => null) : null]);
  return uploadBlob(o.slug, await encode(renderCatalog(cut, o.kind, o.scene, o.brand, logo), true), "catalogo");
}

/** Prévia do cenário (sem veículo) para o seletor. */
export function scenePreview(scene: StudioScene, brand: string, logo: HTMLImageElement | null) {
  const c = canvas(320, 200);
  drawScene(c.getContext("2d")!, 320, 200, scene, brand, logo, 200 * 0.72);
  return c.toDataURL("image/jpeg", 0.8);
}
