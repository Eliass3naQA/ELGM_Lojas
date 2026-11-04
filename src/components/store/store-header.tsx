"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Heart, Search, ShoppingBag, User } from "lucide-react";
import { useCart } from "../cart";
import { StoreLogo } from "../media";
import { FavoritesCount } from "./favorites";

const pill = "text-white/85 transition hover:bg-white/10 hover:text-white";

export function StoreHeader({ slug, name, logo, logoUrl, userName }: { slug: string; name: string; logo: string; logoUrl: string | null; userName: string | null }) {
  const { count } = useCart();
  const router = useRouter();
  const params = useSearchParams();
  // transparente sobre a abertura; ganha vidro quando a página rola
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="sticky top-0 z-20 px-3 pt-3 sm:px-6">
      <div data-scrolled={scrolled ? "1" : "0"} className="vitrine-header mx-auto flex h-[60px] max-w-[1512px] items-center gap-1.5 rounded-full pl-2 pr-2 sm:gap-2 sm:pl-2.5">
        <Link href={`/${slug}/home`} className="flex shrink-0 items-center gap-3">
          <StoreLogo store={{ name, logo, logoUrl }} className="size-10 rounded-full ring-1 ring-white/20" />
          <span className="hidden text-[15px] font-medium tracking-[-0.01em] text-white sm:block">{name}</span>
        </Link>
        <form
          className="relative ml-auto w-full max-w-[260px]"
          onSubmit={(e) => {
            e.preventDefault();
            const q = new FormData(e.currentTarget).get("q")?.toString().trim();
            router.push(`/${slug}/home${q ? `?q=${encodeURIComponent(q)}` : ""}`);
          }}
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/60" />
          <input
            name="q"
            defaultValue={params.get("q") ?? ""}
            placeholder="Buscar…"
            aria-label="Buscar produtos"
            className="h-10 w-full rounded-full border border-white/15 bg-white/5 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-white/55 focus:border-[var(--amber)]"
          />
        </form>
        <Link href={`/${slug}/favoritos`} className={`relative grid size-10 shrink-0 place-items-center rounded-full ${pill}`} aria-label="Favoritos">
          <Heart className="size-[18px]" />
          <FavoritesCount slug={slug} className="absolute -right-0.5 -top-0.5" />
        </Link>
        {userName ? (
          <Link href={`/${slug}/conta`} className={`flex h-10 shrink-0 items-center gap-2 rounded-full pl-1 pr-1 text-sm md:pr-3.5 ${pill}`} aria-label="Minha conta">
            <span className="grid size-8 place-items-center rounded-full bg-[var(--brand)] text-xs font-semibold text-white">{userName.charAt(0).toUpperCase()}</span>
            <span className="hidden max-w-24 truncate md:block">{userName.split(" ")[0]}</span>
          </Link>
        ) : (
          <Link href={`/${slug}/entrar`} className={`grid size-10 shrink-0 place-items-center rounded-full ${pill}`} aria-label="Entrar">
            <User className="size-[18px]" />
          </Link>
        )}
        <Link href={`/${slug}/carrinho`} className={`relative grid size-10 shrink-0 place-items-center rounded-full ${pill}`} aria-label="Sacola">
          <ShoppingBag className="size-[18px]" />
          {mounted && count > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-[var(--brand)] px-1 text-[11px] font-semibold text-white">{count}</span>}
        </Link>
      </div>
    </header>
  );
}
