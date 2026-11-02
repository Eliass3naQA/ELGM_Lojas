"use client";

import { useRef, useState } from "react";
import { Crosshair, Eye, ImagePlus, ListChecks, Loader2, Plus, Rotate3d, Trash2, X } from "lucide-react";
import { ringViews, VIEW_LABEL } from "@/lib/showcase";
import type { Showcase, ShowcaseView, Spec } from "@/lib/types";
import { Img } from "../media";
import { Showroom } from "../store/showroom";
import { Button, Input, cn } from "../ui";
import { useUploader } from "./image-fields";

const MAIN: { view: ShowcaseView; hint: string }[] = [
  { view: "front", hint: "De frente, centralizado" },
  { view: "right", hint: "Frente apontando para a direita" },
  { view: "back", hint: "De trás, centralizado" },
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

const empty: Showcase = { views: {}, headlights: [], intro: true };

function Slot({ slug, view, hint, url, onChange }: { slug: string; view: ShowcaseView; hint: string; url?: string; onChange: (url: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const { upload, busy, error } = useUploader(slug);
  const pick = async (files: FileList | File[]) => {
    const [u] = await upload(files);
    if (u) onChange(u);
  };
  return (
    <div className="space-y-1">
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files);
        }}
        className={cn("group relative aspect-[4/3] overflow-hidden rounded-xl border-2 border-dashed", url ? "border-transparent bg-zinc-900" : "border-zinc-200 bg-zinc-50")}
      >
        {url && <Img src={url} alt={VIEW_LABEL[view]} className="size-full object-contain" />}
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={cn("absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs font-medium transition", url ? "text-transparent hover:bg-black/50 hover:text-white" : "text-zinc-500 hover:bg-zinc-100")}
        >
          {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
          {url ? "Trocar" : "Enviar"}
        </button>
        {url && (
          <button type="button" onClick={() => onChange(null)} className="absolute right-1.5 top-1.5 rounded-lg bg-white/90 p-1 text-zinc-600 opacity-0 shadow transition hover:text-red-600 group-hover:opacity-100" aria-label="Remover">
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      <p className="text-xs font-medium text-zinc-800">{VIEW_LABEL[view]}</p>
      <p className={cn("text-[11px]", error ? "text-red-600" : "text-zinc-400")}>{error ?? hint}</p>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          pick(e.target.files ?? []);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Showroom 360°: o lojista envia as fotos de cada ângulo e o sistema monta o giro. */
export function ShowcaseField({ slug, value, onChange, preview }: { slug: string; value: Showcase | null; onChange: (s: Showcase | null) => void; preview: { name: string; brand: string; specs: Spec[] } }) {
  const [showDiagonals, setShowDiagonals] = useState(() => DIAGONALS.some((d) => value?.views[d.view]));
  const [previewing, setPreviewing] = useState(false);
  const s = value ?? empty;
  const enabled = value !== null;
  const ring = ringViews(s).length;

  const setView = (view: ShowcaseView, url: string | null) => {
    const views = { ...s.views };
    if (url) views[view] = url;
    else delete views[view];
    onChange({ ...s, views, headlights: view === "front" && !url ? [] : s.headlights });
  };

  const markHeadlight = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const point = { x: Math.round(((e.clientX - r.left) / r.width) * 1000) / 10, y: Math.round(((e.clientY - r.top) / r.height) * 1000) / 10 };
    if (s.headlights.length >= 4) return;
    onChange({ ...s, headlights: [...s.headlights, point] });
  };

  if (!enabled) {
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-br from-zinc-950 to-zinc-800 p-5 text-white">
        <Rotate3d className="size-8 shrink-0 text-white/80" />
        <div className="min-w-56 flex-1">
          <p className="font-medium">Showroom 360°</p>
          <p className="text-sm text-white/60">Envie fotos de frente, traseira, laterais, cima e baixo. O sistema monta um giro 360° interativo, com animação de chegada e faróis piscando.</p>
        </div>
        <Button type="button" variant="outline" className="bg-white text-zinc-900" onClick={() => onChange({ ...empty })}>
          Ativar showroom
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {MAIN.map((m) => (
          <Slot key={m.view} slug={slug} view={m.view} hint={m.hint} url={s.views[m.view]} onChange={(u) => setView(m.view, u)} />
        ))}
      </div>

      <div>
        <button type="button" onClick={() => setShowDiagonals((v) => !v)} className="text-xs font-medium text-zinc-700 underline-offset-2 hover:underline">
          {showDiagonals ? "Ocultar" : "+ Adicionar"} fotos diagonais (opcional: deixam o giro mais suave)
        </button>
        {showDiagonals && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {DIAGONALS.map((m) => (
              <Slot key={m.view} slug={slug} view={m.view} hint={m.hint} url={s.views[m.view]} onChange={(u) => setView(m.view, u)} />
            ))}
          </div>
        )}
      </div>

      {s.views.front && (
        <div className="rounded-2xl border border-zinc-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Crosshair className="size-4 text-zinc-400" /> Faróis
              <span className="font-normal text-zinc-500">· clique na foto sobre cada farol ({s.headlights.length}/4)</span>
            </p>
            {s.headlights.length > 0 && (
              <button type="button" onClick={() => onChange({ ...s, headlights: [] })} className="text-xs text-zinc-500 hover:text-red-600">
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
                    onChange({ ...s, headlights: s.headlights.filter((_, j) => j !== i) });
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

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-zinc-100 pt-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={s.intro} onChange={(e) => onChange({ ...s, intro: e.target.checked })} className="size-4 accent-zinc-900" />
          Animação de chegada
        </label>
        <span className={cn("text-xs", ring >= 2 ? "text-emerald-600" : "text-amber-600")}>
          {ring >= 2 ? `${ring} fotos no giro${s.views.top || s.views.bottom ? " + vistas de cima/baixo" : ""}` : "Envie ao menos 2 fotos ao redor (ex.: frente e traseira)"}
        </span>
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
            <Showroom name={preview.name || "Produto"} showcase={s} specs={preview.specs} brand={preview.brand} />
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
