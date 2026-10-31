"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, ShoppingBag, User } from "lucide-react";
import { useCart } from "../cart";
import { StoreLogo } from "../media";

export function StoreHeader({ slug, name, logo, logoUrl, userName }: { slug: string; name: string; logo: string; logoUrl: string | null; userName: string | null }) {
  const { count } = useCart();
  const router = useRouter();
  const params = useSearchParams();

  return (
    <header className="sticky top-0 z-20 px-3 pt-3 sm:px-6 sm:pt-4">
      <div className="glass mx-auto flex h-16 max-w-7xl items-center gap-3 rounded-full pl-2.5 pr-2.5 sm:gap-4 sm:pl-3">
        <Link href={`/${slug}/home`} className="flex shrink-0 items-center gap-2.5">
          <StoreLogo store={{ name, logo, logoUrl }} className="size-11 rounded-full ring-1 ring-white" />
          <span className="hidden text-[15px] font-semibold tracking-tight text-zinc-900 sm:block">{name}</span>
        </Link>
        <form
          className="relative ml-auto w-full max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            const q = new FormData(e.currentTarget).get("q")?.toString().trim();
            router.push(`/${slug}/home${q ? `?q=${encodeURIComponent(q)}` : ""}`);
          }}
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <input
            name="q"
            defaultValue={params.get("q") ?? ""}
            placeholder="Buscar produtos…"
            className="h-11 w-full rounded-full bg-white/55 pl-10 pr-4 text-sm outline-none ring-1 ring-white/70 transition placeholder:text-zinc-500 focus:bg-white/90"
          />
        </form>
        {userName ? (
          <Link href={`/${slug}/conta`} className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-white/70 pl-1.5 pr-1.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-white md:pr-4" aria-label="Minha conta">
            <span className="grid size-8 place-items-center rounded-full bg-[var(--brand)] text-xs font-semibold text-white">{userName.charAt(0).toUpperCase()}</span>
            <span className="hidden max-w-24 truncate md:block">{userName.split(" ")[0]}</span>
          </Link>
        ) : (
          <Link href={`/${slug}/entrar`} className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white/70 px-3.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-white sm:px-4">
            <User className="size-4" /> <span className="hidden sm:block">Entrar</span>
          </Link>
        )}
        <Link href={`/${slug}/carrinho`} className="relative flex h-11 shrink-0 items-center gap-2 rounded-full bg-zinc-950 px-3.5 text-sm font-medium text-white shadow-[0_8px_20px_-8px_rgb(0_0_0/0.6)] transition hover:bg-zinc-800 sm:px-4" aria-label="Carrinho">
          <ShoppingBag className="size-[18px]" />
          <span className="hidden sm:block">Sacola</span>
          {count > 0 && <span className="grid min-w-5 place-items-center rounded-full bg-[var(--brand)] px-1 text-[11px] font-semibold text-white">{count}</span>}
        </Link>
      </div>
    </header>
  );
}
