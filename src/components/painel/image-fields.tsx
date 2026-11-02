"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { Img } from "../media";
import { cn } from "../ui";

const ACCEPT = "image/jpeg,image/png,image/webp";

export function useUploader(slug: string) {
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  async function upload(files: FileList | File[]) {
    setError(null);
    const list = [...files];
    setBusy((b) => b + list.length);
    const urls: string[] = [];
    for (const file of list) {
      try {
        if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name}: máximo de 5 MB.`);
        const form = new FormData();
        form.append("file", file);
        urls.push((await api<{ url: string }>(`/api/stores/${slug}/uploads`, "POST", form)).url);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy((b) => b - 1);
      }
    }
    return urls;
  }
  return { upload, busy: busy > 0, error };
}

/** Uma imagem (logo, capa). */
export function SingleImageField({ slug, value, onChange, aspect = "square", label, hint }: { slug: string; value: string | null; onChange: (url: string | null) => void; aspect?: "square" | "cover"; label: string; hint?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const { upload, busy, error } = useUploader(slug);
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-medium text-zinc-700">{label}</span>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={async (e) => {
          e.preventDefault();
          const [url] = await upload(e.dataTransfer.files);
          if (url) onChange(url);
        }}
        className={cn("group relative overflow-hidden rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50", aspect === "square" ? "aspect-square w-32" : "aspect-[3/1] w-full")}
      >
        {value ? <Img src={value} alt={label} className="size-full object-cover" /> : null}
        <button type="button" onClick={() => input.current?.click()} className={cn("absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs font-medium transition", value ? "bg-black/0 text-transparent hover:bg-black/40 hover:text-white" : "text-zinc-500 hover:bg-zinc-100")}>
          {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
          {value ? "Trocar" : "Enviar imagem"}
        </button>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="absolute right-1.5 top-1.5 rounded-lg bg-white/90 p-1 text-zinc-600 opacity-0 shadow transition hover:text-red-600 group-hover:opacity-100" aria-label="Remover">
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={async (e) => {
          const [url] = await upload(e.target.files ?? []);
          if (url) onChange(url);
          e.target.value = "";
        }}
      />
      {error ? <span className="block text-xs text-red-600">{error}</span> : hint && <span className="block text-xs text-zinc-400">{hint}</span>}
    </div>
  );
}

/** Galeria de fotos do produto: várias, reordenáveis; a primeira é a principal. */
export function GalleryField({ slug, value, onChange, max = 10 }: { slug: string; value: string[]; onChange: (urls: string[]) => void; max?: number }) {
  const input = useRef<HTMLInputElement>(null);
  const { upload, busy, error } = useUploader(slug);
  const add = async (files: FileList | File[]) => {
    const urls = await upload([...files].slice(0, max - value.length));
    if (urls.length) onChange([...value, ...urls]);
  };
  const move = (i: number, dir: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div
        className="grid grid-cols-3 gap-2"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          add(e.dataTransfer.files);
        }}
      >
        {value.map((url, i) => (
          <div key={url} className={cn("group relative aspect-square overflow-hidden rounded-xl border bg-zinc-50", i === 0 ? "col-span-2 row-span-2 border-zinc-900" : "border-zinc-200")}>
            <Img src={url} alt={`Foto ${i + 1}`} className="size-full object-cover" />
            {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold text-white">Principal</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-black/60 p-1.5 opacity-0 transition group-hover:opacity-100">
              {i > 0 && (
                <button type="button" onClick={() => move(i, -1)} className="rounded-md bg-white/90 p-1 text-zinc-700" aria-label="Mover para a esquerda">
                  <ArrowLeft className="size-3.5" />
                </button>
              )}
              {i > 0 && (
                <button type="button" onClick={() => onChange([url, ...value.filter((u) => u !== url)])} className="rounded-md bg-white/90 p-1 text-zinc-700" aria-label="Definir como principal">
                  <Star className="size-3.5" />
                </button>
              )}
              {i < value.length - 1 && (
                <button type="button" onClick={() => move(i, 1)} className="rounded-md bg-white/90 p-1 text-zinc-700" aria-label="Mover para a direita">
                  <ArrowRight className="size-3.5" />
                </button>
              )}
              <button type="button" onClick={() => onChange(value.filter((u) => u !== url))} className="rounded-md bg-white/90 p-1 text-red-600" aria-label="Remover foto">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
        {value.length < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            className={cn(
              "flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-zinc-200 text-xs text-zinc-500 transition hover:border-zinc-300 hover:bg-zinc-50",
              value.length === 0 && "col-span-3 aspect-[3/2]",
            )}
          >
            {busy ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
            {value.length === 0 ? "Arraste fotos aqui ou clique para enviar" : "Adicionar"}
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          add(e.target.files ?? []);
          e.target.value = "";
        }}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : <p className="text-xs text-zinc-400">JPG, PNG ou WEBP até 5 MB · até {max} fotos · passe o mouse para ordenar</p>}
    </div>
  );
}
