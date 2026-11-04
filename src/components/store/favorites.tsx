"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Heart } from "lucide-react";
import { cn } from "../ui";

// Favoritos ficam no navegador do comprador, um conjunto por loja (como o carrinho).
const keyOf = (slug: string) => `lojaflow:favorites:v1:${slug}`;
const EVENT = "lojaflow:favorites";
const EMPTY = "[]";

function read(slug: string) {
  try {
    return window.localStorage.getItem(keyOf(slug)) ?? EMPTY;
  } catch {
    return EMPTY;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange); // outras abas
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useFavorites(slug: string) {
  const raw = useSyncExternalStore(subscribe, () => read(slug), () => EMPTY);
  const ids = JSON.parse(raw) as string[];

  const toggle = useCallback(
    (id: string) => {
      const current = JSON.parse(read(slug)) as string[];
      const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
      try {
        window.localStorage.setItem(keyOf(slug), JSON.stringify(next));
      } catch {
        return; // navegação privada sem armazenamento: o botão só não persiste
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [slug],
  );

  return { ids, toggle };
}

export function FavoriteButton({ slug, productId, name, className, iconClassName }: { slug: string; productId: string; name: string; className?: string; iconClassName?: string }) {
  const { ids, toggle } = useFavorites(slug);
  const active = ids.includes(productId);
  return (
    <button
      type="button"
      onClick={() => toggle(productId)}
      aria-pressed={active}
      aria-label={active ? `Remover ${name} dos favoritos` : `Salvar ${name} nos favoritos`}
      title={active ? "Remover dos favoritos" : "Salvar nos favoritos"}
      className={cn("grid shrink-0 place-items-center rounded-full transition active:scale-95", className)}
    >
      <Heart className={cn("size-5 transition", active && "fill-[var(--brand)] text-[var(--brand)]", iconClassName)} />
    </button>
  );
}

export function FavoritesCount({ slug, className }: { slug: string; className?: string }) {
  const { ids } = useFavorites(slug);
  if (!ids.length) return null;
  return <span className={cn("grid min-w-5 place-items-center rounded-full bg-[var(--brand)] px-1 text-[11px] font-semibold text-white", className)}>{ids.length}</span>;
}
