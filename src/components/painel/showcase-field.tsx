"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, Crosshair, Eye, ImagePlus, ListChecks, Loader2, MousePointerClick, Plus, Rotate3d, Sparkles, Trash2, X } from "lucide-react";
import { ringViews, SCENE_LABEL, VIEW_LABEL } from "@/lib/showcase";
import { loadImage, onStudioEvent, originalToStage, processVehiclePhoto, rerenderCatalog, resetStudio, scenePreview, stageToOriginal, uploadPhoto, warmupStudio, type Kind, type Step } from "@/lib/studio/studio";
import { HOTSPOT_KINDS, STUDIO_SCENES, type Hotspot, type HotspotKind, type Showcase, type ShowcaseRingView, type ShowcaseSource, type ShowcaseView, type Spec, type StudioScene } from "@/lib/types";
import { Img } from "../media";
import { HOTSPOT_META } from "../store/hotspot-kinds";
import { Showroom } from "../store/showroom";
import { Button, Input, Textarea, cn } from "../ui";

const MAIN: { view: ShowcaseView; hint: string }[] = [
  { view: "front", hint: "De frente, carro inteiro" },
  { view: "right", hint: "Frente apontando para a direita" },
  { view: "back", hint: "De trás, carro inteiro" },
  { view: "left", hint: "Frente apontando para a esquerda" },
  { view: "top", hint: "Foto aérea · frente para baixo" },
  { view: "bottom", hint: "Por baixo · frente para baixo" },
];
const DIAGONALS: { view: ShowcaseView; hint: string }[] = [
  { view: "frontRight", hint: "Entre frente e lateral direita" },
  { view: "backRight", hint: "Entre lateral direita e traseira" },
  { view: "backLeft", hint: "Entre traseira e lateral esquerda" },
  { view: "frontLeft", hint: "Entre lateral esquerda e frente" },
];
// ordem das fotos de catálogo (as diagonais vendem melhor)
const CATALOG_ORDER: ShowcaseView[] = ["frontLeft", "frontRight", "front", "left", "right", "backLeft", "backRight", "back", "top"];

const STEP_LABEL: Record<Step, string> = { preparando: "Preparando a foto…", recortando: "Recortando o veículo…", compondo: "Montando o estúdio…", enviando: "Enviando…" };

const empty: Showcase = { views: {}, headlights: [], intro: true, studio: null, sources: {}, hotspots: [] };
const kindOf = (v: ShowcaseView): Kind => (v === "top" || v === "bottom" ? "top" : "ring");
const newId = () => Math.random().toString(36).slice(2, 10);

type SetShowcase = React.Dispatch<React.SetStateAction<Showcase | null>>;

/** Converte os pontos marcados numa vista (faróis e pontos interativos) quando a imagem da vista muda de enquadramento. */
function remapPoints(s: Showcase, view: ShowcaseView, map: (p: { x: number; y: number }) => { x: number; y: number }): Showcase {
  return {
    ...s,
    headlights: view === "front" ? s.headlights.map(map) : s.headlights,
    hotspots: (s.hotspots ?? []).map((h) => (h.view === view ? { ...h, ...map(h) } : h)),
  };
}

// ---------------------------------------------------------------- foto de um ângulo

function Slot({
  view,
  hint,
  url,
  status,
  onPick,
  onRemove,
}: {
  view: ShowcaseView;
  hint: string;
  url?: string;
  status?: string;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const busy = !!status && !status.startsWith("!");
  return (
    <div className="space-y-1">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) onPick(f);
        }}
        className={cn("group relative aspect-[4/3] overflow-hidden rounded-xl border-2 border-dashed", url ? "border-transparent bg-[repeating-conic-gradient(#e4e4e7_0_25%,#f4f4f5_0_50%)] bg-[length:16px_16px]" : "border-zinc-200 bg-zinc-50")}
      >
        {url && <Img src={url} alt={VIEW_LABEL[view]} className="size-full object-contain" />}
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className={cn(
            "absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center text-xs font-medium transition",
            busy ? "bg-white/80 text-zinc-700" : url ? "text-transparent hover:bg-black/50 hover:text-white" : "text-zinc-500 hover:bg-zinc-100",
          )}
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
          {busy ? status : url ? "Trocar" : "Enviar"}
        </button>
        {url && !busy && (
          <button type="button" onClick={onRemove} className="absolute right-1.5 top-1.5 rounded-lg bg-white/90 p-1 text-zinc-600 opacity-0 shadow transition hover:text-red-600 group-hover:opacity-100" aria-label="Remover">
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      <p className="text-xs font-medium text-zinc-800">{VIEW_LABEL[view]}</p>
      <p className={cn("text-[11px]", status?.startsWith("!") ? "text-red-600" : "text-zinc-400")}>{status?.startsWith("!") ? status.slice(1) : hint}</p>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------- estúdio

function StudioPicker({ scene, onChange, brand, logoUrl, model }: { scene: StudioScene | null; onChange: (s: StudioScene | null) => void; brand: string; logoUrl: string | null; model: ModelState }) {
  const [previews, setPreviews] = useState<Partial<Record<StudioScene, string>>>({});
  useEffect(() => {
    let alive = true;
    (async () => {
      const logo = logoUrl ? await loadImage(logoUrl).catch(() => null) : null;
      if (alive) setPreviews(Object.fromEntries(STUDIO_SCENES.map((s) => [s, scenePreview(s, brand, logo)])));
    })();
    return () => {
      alive = false;
    };
  }, [brand, logoUrl]);

  return (
    <div className="rounded-2xl border border-zinc-200 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Camera className="size-4 text-zinc-400" /> Estúdio fotográfico
        <span className="font-normal text-zinc-500">· a IA recorta o veículo e aplica o mesmo cenário em todas as fotos</span>
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
        <button type="button" onClick={() => onChange(null)} className={cn("overflow-hidden rounded-xl border-2 text-left transition", scene === null ? "border-zinc-900" : "border-transparent hover:border-zinc-300")}>
          <span className="grid aspect-[16/10] place-items-center bg-zinc-100 text-[11px] text-zinc-500">Foto original</span>
          <span className="block px-1.5 py-1 text-[11px] font-medium">Sem estúdio</span>
        </button>
        {STUDIO_SCENES.map((s) => (
          <button key={s} type="button" onClick={() => onChange(s)} className={cn("overflow-hidden rounded-xl border-2 text-left transition", scene === s ? "border-zinc-900" : "border-transparent hover:border-zinc-300")}>
            {previews[s] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previews[s]} alt="" className="aspect-[16/10] w-full object-cover" />
            ) : (
              <span className="block aspect-[16/10] bg-zinc-100" />
            )}
            <span className="flex items-center gap-1 px-1.5 py-1 text-[11px] font-medium">
              {scene === s && <Check className="size-3" />} {SCENE_LABEL[s]}
            </span>
          </button>
        ))}
      </div>
      {scene && (
        <div className="mt-3 text-xs text-zinc-500">
          {model.ready ? (
            <span className="text-emerald-600">IA de recorte pronta {model.device === "webgpu" ? "(acelerada pela placa de vídeo)" : "(modo compatível: cada foto leva mais tempo)"}.</span>
          ) : model.error ? (
            <span className="flex flex-wrap items-center gap-2 text-red-600">
              {model.error}
              <button type="button" onClick={model.retry} className="rounded-full border border-red-200 px-2.5 py-0.5 font-medium hover:bg-red-50">
                Tentar de novo
              </button>
            </span>
          ) : (
            <div>
              <p>
                Baixando a IA de recorte{model.total ? `: ${Math.round(model.loaded / 1e6)} de ${Math.round(model.total / 1e6)} MB` : "…"} · só na primeira vez, depois fica guardada no navegador
              </p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full bg-zinc-900 transition-[width]" style={{ width: `${model.total ? Math.round((model.loaded / model.total) * 100) : 3}%` }} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type ModelState = { ready: boolean; device: string | null; loaded: number; total: number; error: string | null; retry: () => void };

const STALL_MS = 45_000; // sem nenhum avanço no download por esse tempo = travou

function useStudioModel(active: boolean) {
  const [state, setState] = useState<Omit<ModelState, "retry">>({ ready: false, device: null, loaded: 0, total: 0, error: null });
  const lastActivity = useRef(Date.now());
  useEffect(() => {
    if (!active) return;
    lastActivity.current = Date.now();
    const off = onStudioEvent((e) => {
      lastActivity.current = Date.now();
      if (e.type === "progress") setState((s) => ({ ...s, loaded: e.loaded, total: e.total, error: null }));
      else if (e.type === "ready") setState((s) => ({ ...s, ready: true, device: e.device, error: null }));
      else if (e.type === "error" && e.id === null) setState((s) => ({ ...s, error: e.message }));
    });
    warmupStudio();
    // vigia: download parado (depois de baixar, a preparação do modelo leva alguns segundos sem avisos)
    const timer = setInterval(() => {
      setState((s) => {
        const downloading = !s.ready && !s.error && (!s.total || s.loaded < s.total);
        return downloading && Date.now() - lastActivity.current > STALL_MS ? { ...s, error: "O download da IA de recorte parou. Verifique a conexão e tente de novo." } : s;
      });
    }, 5000);
    return () => {
      off();
      clearInterval(timer);
    };
  }, [active]);
  const retry = () => {
    lastActivity.current = Date.now();
    setState({ ready: false, device: null, loaded: 0, total: 0, error: null });
    resetStudio();
  };
  return { ...state, retry };
}

// ---------------------------------------------------------------- pontos interativos

function HotspotEditor({ slug, s, onChange }: { slug: string; s: Showcase; onChange: SetShowcase }) {
  const ring = ringViews(s);
  const [view, setView] = useState<ShowcaseRingView>(ring[0] ?? "front");
  const [selected, setSelected] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const hotspots = s.hotspots ?? [];
  const current = hotspots.find((h) => h.id === selected) ?? null;
  const url = s.views[view];
  if (!ring.length) return null;

  const update = (id: string, patch: Partial<Hotspot>) => onChange((prev) => prev && { ...prev, hotspots: (prev.hotspots ?? []).map((h) => (h.id === id ? { ...h, ...patch } : h)) });

  const add = (e: React.MouseEvent<HTMLDivElement>) => {
    if (hotspots.length >= 16) return;
    const r = e.currentTarget.getBoundingClientRect();
    const h: Hotspot = {
      id: newId(),
      view,
      x: Math.round(((e.clientX - r.left) / r.width) * 1000) / 10,
      y: Math.round(((e.clientY - r.top) / r.height) * 1000) / 10,
      kind: "custom",
      label: HOTSPOT_META.custom.label,
      note: "",
      photos: [],
    };
    onChange((prev) => prev && { ...prev, hotspots: [...(prev.hotspots ?? []), h] });
    setSelected(h.id);
  };

  const addPhotos = async (files: FileList) => {
    if (!current) return;
    setUploading(true);
    setError(null);
    const id = current.id;
    try {
      for (const f of [...files].slice(0, 12 - current.photos.length)) {
        const u = await uploadPhoto(slug, f);
        onChange((prev) => prev && { ...prev, hotspots: (prev.hotspots ?? []).map((h) => (h.id === id ? { ...h, photos: [...h.photos, u] } : h)) });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <MousePointerClick className="size-4 text-zinc-400" /> Pontos interativos
        <span className="font-normal text-zinc-500">· clique no veículo para criar um ponto e anexe fotos reais do detalhe</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-1">
        {ring.map((v) => (
          <button key={v} type="button" onClick={() => setView(v)} className={cn("rounded-full px-3 py-1 text-xs font-medium", v === view ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200")}>
            {VIEW_LABEL[v]} {hotspots.some((h) => h.view === v) && `· ${hotspots.filter((h) => h.view === v).length}`}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="relative cursor-crosshair overflow-hidden rounded-xl bg-[repeating-conic-gradient(#e4e4e7_0_25%,#f4f4f5_0_50%)] bg-[length:16px_16px]" onClick={add}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {url && <img src={url} alt={VIEW_LABEL[view]} className="block w-full" draggable={false} />}
          {hotspots
            .filter((h) => h.view === view)
            .map((h) => {
              const Icon = HOTSPOT_META[h.kind].icon;
              return (
                <button
                  key={h.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected(h.id);
                  }}
                  className={cn("absolute grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full shadow-lg ring-4 transition", h.id === selected ? "bg-zinc-900 text-white ring-zinc-900/25" : "bg-white text-zinc-900 ring-white/50")}
                  style={{ left: `${h.x}%`, top: `${h.y}%` }}
                  aria-label={h.label}
                >
                  <Icon className="size-3.5" />
                </button>
              );
            })}
        </div>
        <div>
          {current ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1">
                {HOTSPOT_KINDS.map((k) => {
                  const Icon = HOTSPOT_META[k].icon;
                  return (
                    <button
                      key={k}
                      type="button"
                      title={HOTSPOT_META[k].hint}
                      onClick={() => update(current.id, { kind: k as HotspotKind, label: current.label === HOTSPOT_META[current.kind].label || !current.label ? HOTSPOT_META[k].label : current.label })}
                      className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium", current.kind === k ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 text-zinc-700 hover:border-zinc-300")}
                    >
                      <Icon className="size-3.5" /> {HOTSPOT_META[k].label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-zinc-400">{HOTSPOT_META[current.kind].hint}</p>
              <Input value={current.label} onChange={(e) => update(current.id, { label: e.target.value })} placeholder="Nome do ponto" maxLength={40} />
              <Textarea value={current.note} onChange={(e) => update(current.id, { note: e.target.value })} placeholder="Ex.: Pneus Pirelli com 80% de vida útil, trocados em 2025." className="min-h-20" maxLength={500} />
              <div className="grid grid-cols-4 gap-1.5">
                {current.photos.map((p) => (
                  <div key={p} className="group relative aspect-square overflow-hidden rounded-lg bg-zinc-100">
                    <Img src={p} alt="" className="size-full object-cover" />
                    <button type="button" onClick={() => update(current.id, { photos: current.photos.filter((x) => x !== p) })} className="absolute right-1 top-1 rounded bg-white/90 p-0.5 text-red-600 opacity-0 group-hover:opacity-100" aria-label="Remover foto">
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                {current.photos.length < 12 && (
                  <button type="button" disabled={uploading} onClick={() => photoInput.current?.click()} className="grid aspect-square place-items-center rounded-lg border-2 border-dashed border-zinc-200 text-zinc-400 hover:bg-zinc-50">
                    {uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  </button>
                )}
              </div>
              <input
                ref={photoInput}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) addPhotos(e.target.files);
                  e.target.value = "";
                }}
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                type="button"
                onClick={() => {
                  onChange((prev) => prev && { ...prev, hotspots: (prev.hotspots ?? []).filter((h) => h.id !== current.id) });
                  setSelected(null);
                }}
                className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
              >
                <Trash2 className="size-3.5" /> Remover ponto
              </button>
            </div>
          ) : (
            <div className="grid h-full place-items-center rounded-xl bg-zinc-50 p-4 text-center text-xs text-zinc-500">
              <div>
                <Crosshair className="mx-auto size-5 text-zinc-400" />
                <p className="mt-2">Clique sobre o capô, uma roda, o vidro lateral, o porta-malas… e anexe fotos reais daquele detalhe.</p>
                <p className="mt-1 text-zinc-400">{hotspots.length}/16 pontos</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- campo completo

/** Showroom 360°: fotos de cada ângulo, estúdio com IA, faróis e pontos interativos. */
export function ShowcaseField({
  slug,
  value,
  onChange,
  preview,
  onUseCatalogPhotos,
}: {
  slug: string;
  value: Showcase | null;
  onChange: SetShowcase;
  preview: { name: string; brand: string; specs: Spec[]; logoUrl: string | null };
  onUseCatalogPhotos: (urls: string[]) => void;
}) {
  const s: Showcase = { ...empty, ...value };
  const [showDiagonals, setShowDiagonals] = useState(() => DIAGONALS.some((d) => value?.views[d.view]));
  const [previewing, setPreviewing] = useState(false);
  const [status, setStatus] = useState<Partial<Record<ShowcaseView, string>>>({});
  const [sceneBusy, setSceneBusy] = useState(false);
  const model = useStudioModel(!!s.studio);
  const ring = ringViews(s).length;
  const queue = useRef(Promise.resolve());
  const enabled = value !== null;

  const setStatusOf = (v: ShowcaseView, text: string | null) =>
    setStatus((st) => {
      const next = { ...st };
      if (text) next[v] = text;
      else delete next[v];
      return next;
    });

  /**
   * Processa uma foto (com ou sem estúdio) e grava a vista. As fotos entram numa fila para a IA rodar uma de cada vez.
   * `remapFromOriginal`: é a mesma foto que já estava na vista, agora passando pelo estúdio — os pontos marcados acompanham.
   */
  const pick = (view: ShowcaseView, file: File, scene: StudioScene | null = s.studio ?? null, remapFromOriginal = false) => {
    setStatusOf(view, "Na fila…");
    queue.current = queue.current.then(async () => {
      try {
        if (!scene) {
          setStatusOf(view, "Enviando…");
          const url = await uploadPhoto(slug, file);
          onChange((prev) => prev && { ...prev, views: { ...prev.views, [view]: url }, sources: { ...prev.sources, [view]: { original: url, cutout: null, stage: null, square: null, frame: null } } });
        } else {
          const r = await processVehiclePhoto({ slug, file, kind: kindOf(view), scene, brand: preview.brand, logoUrl: preview.logoUrl, onStep: (st) => setStatusOf(view, STEP_LABEL[st]) });
          onChange((prev) => {
            if (!prev) return prev;
            const next: Showcase = {
              ...prev,
              views: { ...prev.views, [view]: r.stage },
              sources: { ...prev.sources, [view]: { original: r.original, cutout: r.cutout, stage: r.stage, square: r.square, frame: r.frame } },
            };
            return remapFromOriginal ? remapPoints(next, view, (p) => originalToStage(p, r.frame, kindOf(view))) : next;
          });
        }
        setStatusOf(view, null);
      } catch (e) {
        setStatusOf(view, `!${(e as Error).message}`);
      }
    });
  };

  const remove = (view: ShowcaseView) =>
    onChange((prev) => {
      if (!prev) return prev;
      const views = { ...prev.views };
      const sources = { ...prev.sources };
      delete views[view];
      delete sources[view];
      return { ...prev, views, sources, headlights: view === "front" ? [] : prev.headlights, hotspots: (prev.hotspots ?? []).filter((h) => h.view !== view) };
    });

  /** Troca o cenário de todas as fotos do veículo. */
  const changeScene = async (scene: StudioScene | null) => {
    const sources = s.sources ?? {};
    const views = Object.keys(s.views) as ShowcaseView[];
    onChange((prev) => prev && { ...prev, studio: scene });
    if (!views.length) return;

    if (!scene) {
      // volta às fotos originais, convertendo os pontos marcados
      onChange((prev) => {
        if (!prev) return prev;
        let next: Showcase = { ...prev, studio: null, views: { ...prev.views } };
        for (const v of views) {
          const src = prev.sources?.[v];
          if (!src?.original || prev.views[v] === src.original) continue;
          next.views[v] = src.original;
          if (src.frame) next = remapPoints(next, v, (p) => stageToOriginal(p, src.frame!, kindOf(v)));
        }
        return next;
      });
      return;
    }

    setSceneBusy(true);
    try {
      for (const v of views) {
        const src: ShowcaseSource | undefined = sources[v];
        const showingOriginal = !!src && s.views[v] === src.original;
        if (src?.cutout && src.stage) {
          // já recortada: só troca o cenário da foto de catálogo (sem rodar a IA de novo)
          setStatusOf(v, "Aplicando cenário…");
          const square = await rerenderCatalog({ slug, cutoutUrl: src.cutout, kind: kindOf(v), scene, brand: preview.brand, logoUrl: preview.logoUrl });
          onChange((prev) => {
            if (!prev) return prev;
            const next: Showcase = { ...prev, views: { ...prev.views, [v]: src.stage! }, sources: { ...prev.sources, [v]: { ...src, square } } };
            // a vista mostrava a foto original (estúdio estava desligado): os pontos voltam ao enquadramento do estúdio
            return showingOriginal && src.frame ? remapPoints(next, v, (p) => originalToStage(p, src.frame!, kindOf(v))) : next;
          });
          setStatusOf(v, null);
        } else {
          // nunca recortada: baixa a foto original e passa pela IA
          const orig = src?.original ?? s.views[v];
          if (!orig) continue;
          const blob = await (await fetch(orig)).blob();
          pick(v, new File([blob], "original", { type: blob.type }), scene, true);
        }
      }
      await queue.current;
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSceneBusy(false);
    }
  };

  const markHeadlight = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const point = { x: Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, y: Math.round(((e.clientY - r.top) / r.height) * 1000) / 10 };
    if (s.headlights.length >= 4) return;
    onChange((prev) => prev && { ...prev, headlights: [...prev.headlights, point] });
  };

  const catalogPhotos = CATALOG_ORDER.map((v) => s.sources?.[v]?.square).filter((u): u is string => !!u);

  if (!enabled) {
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-br from-zinc-950 to-zinc-800 p-5 text-white">
        <Rotate3d className="size-8 shrink-0 text-white/80" />
        <div className="min-w-56 flex-1">
          <p className="font-medium">Showroom 360° com estúdio por IA</p>
          <p className="text-sm text-white/60">Fotografe o veículo com o celular (frente, traseira, laterais). A IA recorta o carro, aplica um cenário de estúdio e o sistema monta o giro 360° com pontos clicáveis.</p>
        </div>
        <Button type="button" variant="outline" className="bg-white text-zinc-900" onClick={() => onChange({ ...empty, studio: "dark" })}>
          Ativar showroom
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <StudioPicker scene={s.studio ?? null} onChange={changeScene} brand={preview.brand} logoUrl={preview.logoUrl} model={model} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {MAIN.map((m) => (
          <Slot key={m.view} view={m.view} hint={m.hint} url={s.views[m.view]} status={status[m.view]} onPick={(f) => pick(m.view, f)} onRemove={() => remove(m.view)} />
        ))}
      </div>

      <div>
        <button type="button" onClick={() => setShowDiagonals((v) => !v)} className="text-xs font-medium text-zinc-700 underline-offset-2 hover:underline">
          {showDiagonals ? "Ocultar" : "+ Adicionar"} fotos diagonais (opcional: deixam o giro mais suave e realista)
        </button>
        {showDiagonals && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {DIAGONALS.map((m) => (
              <Slot key={m.view} view={m.view} hint={m.hint} url={s.views[m.view]} status={status[m.view]} onPick={(f) => pick(m.view, f)} onRemove={() => remove(m.view)} />
            ))}
          </div>
        )}
      </div>

      {catalogPhotos.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-zinc-50 p-3">
          <div className="flex -space-x-3">
            {catalogPhotos.slice(0, 4).map((u) => (
              <Img key={u} src={u} alt="" className="size-12 rounded-xl object-cover ring-2 ring-white" />
            ))}
          </div>
          <p className="min-w-40 flex-1 text-xs text-zinc-600">{catalogPhotos.length} foto(s) de estúdio prontas para a vitrine.</p>
          <Button type="button" variant="outline" className="text-xs" onClick={() => onUseCatalogPhotos(catalogPhotos)}>
            <Sparkles className="size-3.5" /> Usar como fotos do anúncio
          </Button>
        </div>
      )}

      {s.views.front && (
        <div className="rounded-2xl border border-zinc-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Crosshair className="size-4 text-zinc-400" /> Faróis
              <span className="font-normal text-zinc-500">· clique sobre cada farol na foto da frente ({s.headlights.length}/4)</span>
            </p>
            {s.headlights.length > 0 && (
              <button type="button" onClick={() => onChange((prev) => prev && { ...prev, headlights: [] })} className="text-xs text-zinc-500 hover:text-red-600">
                Limpar
              </button>
            )}
          </div>
          <div className="mx-auto mt-3 max-w-md">
            <div className="relative cursor-crosshair overflow-hidden rounded-xl bg-zinc-900" onClick={markHeadlight}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.views.front} alt="Frente" className="block w-full" draggable={false} />
              {s.headlights.map((h, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange((prev) => prev && { ...prev, headlights: prev.headlights.filter((_, j) => j !== i) });
                  }}
                  className="absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-amber-300 text-zinc-900 shadow-[0_0_0_4px_rgb(252_211_77/0.35),0_0_18px_6px_rgb(255_255_255/0.6)]"
                  style={{ left: `${h.x}%`, top: `${h.y}%` }}
                  aria-label="Remover farol"
                >
                  <X className="size-3" />
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-zinc-400">Na chegada, os faróis marcados acendem e piscam duas vezes.</p>
        </div>
      )}

      <HotspotEditor slug={slug} s={s} onChange={onChange} />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-zinc-100 pt-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.intro} onChange={(e) => onChange((prev) => prev && { ...prev, intro: e.target.checked })} className="size-4 accent-zinc-900" />
          Animação de chegada
        </label>
        <span className={cn("text-xs", ring >= 2 ? "text-emerald-600" : "text-amber-600")}>
          {ring >= 2 ? `${ring} fotos no giro${s.views.top || s.views.bottom ? " + vistas de cima/baixo" : ""}` : "Envie ao menos 2 fotos ao redor (ex.: frente e traseira)"}
        </span>
        {sceneBusy && (
          <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
            <Loader2 className="size-3.5 animate-spin" /> Aplicando cenário…
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" className="text-xs text-red-600" onClick={() => confirm("Desativar o showroom 360° deste produto?") && onChange(null)}>
            Desativar
          </Button>
          <Button type="button" variant="outline" className="text-xs" disabled={ring < 2} onClick={() => setPreviewing(true)}>
            <Eye className="size-3.5" /> Pré-visualizar
          </Button>
        </div>
      </div>

      {previewing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-3 backdrop-blur-sm sm:p-8" onClick={() => setPreviewing(false)}>
          <div className="relative w-full max-w-6xl" onClick={(e) => e.stopPropagation()}>
            <Showroom name={preview.name || "Produto"} showcase={s} specs={preview.specs} brand={preview.brand} logoUrl={preview.logoUrl} />
            <button type="button" onClick={() => setPreviewing(false)} className="absolute -top-3 right-3 grid size-9 -translate-y-full place-items-center rounded-full bg-white text-zinc-900 shadow" aria-label="Fechar">
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const VEHICLE_SPECS = ["Ano", "Quilometragem", "Motor", "Potência", "Câmbio", "Combustível", "Cor", "Final da placa"];

/** Ficha técnica livre (rótulo → valor). */
export function SpecsField({ value, onChange }: { value: Spec[]; onChange: (s: Spec[]) => void }) {
  const set = (i: number, patch: Partial<Spec>) => onChange(value.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="space-y-2">
      {value.map((s, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] gap-2">
          <Input value={s.label} onChange={(e) => set(i, { label: e.target.value })} placeholder="Ex.: Motor" aria-label="Item" />
          <Input value={s.value} onChange={(e) => set(i, { value: e.target.value })} placeholder="Ex.: 1.4 TSI" aria-label="Valor" />
          <Button type="button" variant="ghost" className="px-2" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remover item">
            <Trash2 className="size-4 text-zinc-400" />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="text-xs" onClick={() => onChange([...value, { label: "", value: "" }])}>
          <Plus className="size-3.5" /> Adicionar item
        </Button>
        {value.length === 0 && (
          <Button type="button" variant="outline" className="text-xs" onClick={() => onChange(VEHICLE_SPECS.map((label) => ({ label, value: "" })))}>
            <ListChecks className="size-3.5" /> Usar modelo de veículo
          </Button>
        )}
      </div>
    </div>
  );
}
