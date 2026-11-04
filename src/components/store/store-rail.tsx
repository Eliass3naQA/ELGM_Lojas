import Link from "next/link";
import { CarFront, Heart, House, type LucideIcon, Package, Tag } from "lucide-react";
import { FavoritesCount } from "./favorites";

/** Navegação lateral da página do produto (telas largas). Só lista destinos que existem nesta loja. */
export function StoreRail({ slug, vehicle, hasDeals }: { slug: string; vehicle: boolean; hasDeals: boolean }) {
  const items: { href: string; label: string; icon: LucideIcon; current?: boolean; favorites?: boolean }[] = [
    { href: `/${slug}/home`, label: "Início", icon: House },
    { href: `/${slug}/home#produtos`, label: vehicle ? "Veículos" : "Produtos", icon: vehicle ? CarFront : Package, current: true },
    ...(hasDeals ? [{ href: `/${slug}/home#ofertas`, label: "Ofertas", icon: Tag }] : []),
    { href: `/${slug}/favoritos`, label: "Favoritos", icon: Heart, favorites: true },
  ];

  return (
    <nav aria-label="Navegação da loja" className="pdp-panel sticky top-[88px] hidden h-[calc(100vh-108px)] max-h-[780px] min-h-[540px] w-[92px] shrink-0 flex-col items-center gap-1 rounded-full py-5 xl:flex">
      {items.map(({ href, label, icon: Icon, current, favorites }) => (
        <Link key={label} href={href} aria-current={current ? "page" : undefined} className="group relative flex w-full flex-col items-center gap-1.5 py-2.5 text-xs text-white/80 transition hover:text-white">
          <span className={current ? "pdp-rail-active grid size-11 place-items-center rounded-full" : "grid size-11 place-items-center rounded-full transition group-hover:bg-white/10"}>
            <Icon className="size-5" />
          </span>
          {label}
          {favorites && <FavoritesCount slug={slug} className="absolute right-4 top-1.5" />}
        </Link>
      ))}
    </nav>
  );
}
