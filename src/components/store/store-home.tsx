import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { isVehicleStore } from "@/lib/catalog-templates";
import { moneyShort } from "@/lib/format";
import { fromPrice } from "@/lib/pricing";
import { hasCutouts } from "@/lib/showcase";
import type { Product, Store } from "@/lib/types";
import { cn, EmptyState } from "../ui";
import { ProductCard, totalAvailable } from "./product-card";
import { StoreHero, type HeroItem } from "./store-hero";

const pad = (n: number) => String(n).padStart(2, "0");

/** Até três colunas; com poucos produtos eles ocupam mais espaço, em vez de deixar buracos. */
function Grid({ products, slug, now, vehicle }: { products: Product[]; slug: string; now: number; vehicle: boolean }) {
  const n = products.length;
  return (
    <div className={cn("grid gap-x-5 gap-y-12 sm:gap-x-6", n === 2 ? "md:grid-cols-2" : n > 2 && "sm:grid-cols-2 lg:grid-cols-3")}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} slug={slug} now={now} vehicle={vehicle} wide={n === 1} />
      ))}
    </div>
  );
}

export function StoreHome({ store, all, products, q, categoria, now }: { store: Store; all: Product[]; products: Product[]; q?: string; categoria?: string; now: number }) {
  const slug = store.slug;
  const vehicle = isVehicleStore(store.category);
  const isHome = !q && !categoria;
  const categories = [...new Set(all.map((p) => p.category))];
  const deals = all.filter((p) => fromPrice(p, now).onSale && totalAvailable(p) > 0).slice(0, 3);

  // vitrine: disponíveis primeiro, promoções em destaque
  const rank = (p: Product) => Number(totalAvailable(p) > 0) * 2 + Number(fromPrice(p, now).onSale);
  const sorted = [...products].sort((a, b) => rank(b) - rank(a));

  // destaques da abertura: disponíveis, preferindo os que têm recorte para pousar no palco
  const score = (p: Product) => Number(hasCutouts(p)) * 4 + Number(p.images.length > 0) * 2 + Number(fromPrice(p, now).onSale);
  const heroItems: HeroItem[] = all
    .filter((p) => totalAvailable(p) > 0)
    .sort((a, b) => score(b) - score(a))
    .slice(0, 4)
    .map((p) => ({ id: p.id, name: p.name, price: moneyShort(fromPrice(p, now).price), showcase: hasCutouts(p) ? p.showcase : null, photo: p.images[0] ?? null }));

  // "Sobre": a primeira frase ganha destaque, o restante acompanha em tom menor
  const about = store.about.trim();
  const cut = about.search(/[.!?]\s/);
  const [lead, rest] = cut > 0 ? [about.slice(0, cut + 1), about.slice(cut + 2)] : [about, ""];
  const whatsappUrl = store.whatsapp ? `https://wa.me/55${store.whatsapp}?text=${encodeURIComponent(`Olá! Vim pela loja ${store.name}.`)}` : null;

  const tab = (label: string, value?: string) => (
    <Link key={label} href={`/${slug}/home${value ? `?categoria=${encodeURIComponent(value)}` : ""}#colecao`} scroll={false} aria-current={categoria === value} className="shop-tab">
      {label}
    </Link>
  );

  return (
    <main>
      {isHome && <StoreHero name={store.name} tagline={store.tagline} category={store.category} slug={slug} brand={store.brandColor} logoUrl={store.logoUrl} items={heroItems} vehicle={vehicle} coverUrl={store.coverUrl} />}

      {isHome && deals.length > 0 && (
        <section id="ofertas" className="mx-auto max-w-[1512px] scroll-mt-28 px-5 pt-24 sm:px-8 sm:pt-32">
          <p className="eyebrow reveal">Ofertas</p>
          <div className="mt-8">
            <Grid products={deals} slug={slug} now={now} vehicle={vehicle} />
          </div>
        </section>
      )}

      <section id="colecao" className={cn("mx-auto max-w-[1512px] scroll-mt-28 px-5 sm:px-8", isHome ? "pt-24 sm:pt-32" : "pt-12")}>
        <div id="produtos" className="reveal flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
          <div>
            <p className="eyebrow">{q ? "Busca" : "Coleção"}</p>
            <h2 className="mt-4 text-4xl font-light tracking-[-0.035em] text-white sm:text-6xl">{q ? `“${q}”` : categoria ?? (vehicle ? "Nossos veículos" : "Nossos produtos")}</h2>
          </div>
          <p className="pb-1 text-sm tabular-nums tracking-[0.14em] text-white/55">{pad(sorted.length)} {sorted.length === 1 ? "item" : "itens"}</p>
        </div>

        {categories.length > 1 && (
          <nav aria-label="Categorias" className="no-scrollbar reveal mt-8 flex gap-7 overflow-x-auto border-b border-[var(--pdp-line)]">
            {tab("Todos")}
            {categories.map((c) => tab(c, c))}
          </nav>
        )}

        <div className="mt-10">
          {sorted.length === 0 ? (
            <div className="glass rounded-[28px]">
              <EmptyState title="Nada por aqui" description="Tente outra busca ou categoria." />
            </div>
          ) : (
            <Grid products={sorted} slug={slug} now={now} vehicle={vehicle} />
          )}
        </div>
      </section>

      {isHome && about && (
        <section className="mx-auto max-w-[1512px] px-5 pt-28 sm:px-8 sm:pt-44">
          <div className="reveal grid gap-8 lg:grid-cols-[1fr_3fr]">
            <p className="eyebrow self-start lg:pt-3">Sobre</p>
            <div>
              <p className="max-w-4xl text-3xl font-light leading-[1.18] tracking-[-0.025em] text-white [text-wrap:balance] sm:text-5xl">{lead}</p>
              {rest && <p className="pdp-muted mt-7 max-w-xl text-[15px] leading-relaxed">{rest}</p>}
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="link-arrow mt-8">
                  <MessageCircle className="size-4 text-[var(--amber)]" /> <span className="link-underline">Falar com a loja</span> <ArrowRight className="size-4" />
                </a>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
