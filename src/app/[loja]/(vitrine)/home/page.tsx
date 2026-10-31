import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, Flame, Truck } from "lucide-react";
import { Img, StoreLogo, Thumb } from "@/components/media";
import { Price, ProductCard, totalAvailable } from "@/components/store/product-card";
import { ButtonLink, EmptyState, cn } from "@/components/ui";
import { loadStore } from "@/lib/data/load-store";
import { getStoreBySlug, listProducts } from "@/lib/data/repository";
import { money } from "@/lib/format";
import { fromPrice } from "@/lib/pricing";

type Props = { params: Promise<{ loja: string }>; searchParams: Promise<{ q?: string; categoria?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const store = await getStoreBySlug((await params).loja);
  return { title: store?.name, description: store?.tagline };
}

export default async function StoreHome({ params, searchParams }: Props) {
  const { loja } = await params;
  const { q, categoria } = await searchParams;
  const store = await loadStore(loja);
  const now = Date.now();
  const [all, products] = await Promise.all([listProducts(store.id), listProducts(store.id, { q, category: categoria })]);
  const categories = [...new Set(all.map((p) => p.category))];
  // vitrine: disponíveis primeiro, promoções em destaque
  const rank = (p: (typeof all)[number]) => Number(totalAvailable(p) > 0) * 2 + Number(fromPrice(p, now).onSale);
  products.sort((a, b) => rank(b) - rank(a));
  const deals = all.filter((p) => fromPrice(p, now).onSale && totalAvailable(p) > 0).slice(0, 4);
  const isHome = !q && !categoria;

  // destaque do showroom: uma oferta (de preferência com foto) e alguns vizinhos na faixa de miniaturas
  const showcase = [...all].filter((p) => totalAvailable(p) > 0).sort((a, b) => rank(b) + Number(b.images.length > 0) - (rank(a) + Number(a.images.length > 0)));
  const featured = showcase[0];
  const strip = showcase.slice(0, 4);

  const chip = (label: string, value?: string) => (
    <Link
      key={label}
      href={`/${loja}/home${value ? `?categoria=${encodeURIComponent(value)}` : ""}`}
      className={cn(
        "whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition",
        categoria === value ? "bg-zinc-950 text-white shadow-[0_8px_20px_-8px_rgb(0_0_0/0.6)]" : "glass text-zinc-700 hover:bg-white/80",
      )}
    >
      {label}
    </Link>
  );

  return (
    <main>
      {isHome && (
        <section className="mx-auto max-w-7xl px-3 pt-4 sm:px-6 sm:pt-6">
          <div className="glass-sheet relative overflow-hidden rounded-[36px] p-5 sm:p-8 lg:p-10">
            <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <div className="animate-fade-up">
                <div className="flex items-center gap-3">
                  <StoreLogo store={store} className="size-12 rounded-2xl ring-1 ring-white" emojiClassName="text-2xl" />
                  <span className="rounded-full bg-white/60 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-zinc-600">{store.category}</span>
                </div>
                <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-zinc-950 sm:text-6xl">{store.name}</h1>
                <p className="mt-4 max-w-md text-lg leading-relaxed text-zinc-600">{store.tagline}</p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <ButtonLink href="#produtos" className="px-6 py-3">
                    Ver produtos <ArrowRight className="size-4" />
                  </ButtonLink>
                  {deals.length > 0 && (
                    <ButtonLink href="#ofertas" variant="outline" className="px-6 py-3">
                      <Flame className="size-4 text-[var(--brand)]" /> Ofertas
                    </ButtonLink>
                  )}
                </div>
                {store.freeShippingOver !== null && (
                  <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/60 px-4 py-2 text-sm text-zinc-700">
                    <Truck className="size-4 text-[var(--brand)]" /> Frete grátis acima de <strong className="font-semibold">{money(store.freeShippingOver)}</strong>
                  </p>
                )}
              </div>

              {featured ? <Showroom featured={featured} strip={strip} slug={loja} now={now} /> : store.coverUrl && <Img src={store.coverUrl} alt="" loading="eager" className="aspect-[4/3] w-full rounded-[28px] object-cover" />}
            </div>
          </div>
        </section>
      )}

      {isHome && deals.length > 0 && (
        <section id="ofertas" className="mx-auto max-w-7xl scroll-mt-28 px-3 pt-14 sm:px-6">
          <SectionTitle icon={<Flame className="size-5 text-[var(--brand)]" />} title="Ofertas" />
          <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {deals.map((p) => (
              <ProductCard key={p.id} product={p} slug={loja} now={now} />
            ))}
          </div>
        </section>
      )}

      <section id="produtos" className="mx-auto max-w-7xl scroll-mt-28 px-3 pt-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionTitle title={q ? `Resultados para “${q}”` : categoria ?? "Todos os produtos"} />
          <span className="text-sm text-zinc-500">{products.length} produto(s)</span>
        </div>
        <div className="no-scrollbar -mx-3 mt-5 flex gap-2 overflow-x-auto px-3 pb-2">
          {chip("Todos")}
          {categories.map((c) => chip(c, c))}
        </div>
        {products.length === 0 ? (
          <div className="glass mt-4 rounded-[28px]">
            <EmptyState title="Nenhum produto encontrado" description="Tente outra busca ou categoria." />
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} slug={loja} now={now} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function SectionTitle({ title, icon }: { title: string; icon?: React.ReactNode }) {
  return <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-[-0.02em] text-zinc-950">{icon}{title}</h2>;
}

type P = Awaited<ReturnType<typeof listProducts>>[number];

/** Produto em destaque sobre um "piso" refletivo, com etiqueta de preço e miniaturas (estilo configurador). */
function Showroom({ featured, strip, slug, now }: { featured: P; strip: P[]; slug: string; now: number }) {
  const price = fromPrice(featured, now);
  const href = `/${slug}/produto/${featured.id}`;
  return (
    <div className="glass relative overflow-hidden rounded-[30px] p-4 sm:p-6">
      <div className="stage-floor pointer-events-none absolute inset-x-0 bottom-0 h-1/2" />
      <Link href={href} className="relative block">
        <div className="mx-auto grid aspect-[16/10] max-w-xl place-items-center">
          {featured.images[0] ? (
            <Img src={featured.images[0]} alt={featured.name} loading="eager" className="reflect max-h-full w-auto max-w-full rounded-3xl object-contain drop-shadow-[0_30px_30px_rgba(0,0,0,.18)]" />
          ) : (
            <span className="reflect select-none text-[9rem] leading-none drop-shadow-[0_24px_24px_rgba(0,0,0,.18)] sm:text-[12rem]">{featured.image}</span>
          )}
        </div>
      </Link>
      <div className="relative mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto">
          {strip.map((p) => (
            <Link
              key={p.id}
              href={`/${slug}/produto/${p.id}`}
              title={p.name}
              className={cn("shrink-0 rounded-2xl p-1 transition", p.id === featured.id ? "bg-white shadow-[0_8px_20px_-10px_rgb(0_0_0/0.35)] ring-1 ring-white" : "bg-white/40 hover:bg-white/70")}
            >
              <Thumb url={p.images[0]} emoji={p.image} alt={p.name} className="size-14 rounded-xl sm:size-16" emojiClassName="text-3xl" />
            </Link>
          ))}
        </div>
        <div className="glass-strong flex items-center gap-4 rounded-[22px] py-2 pl-5 pr-2">
          <div className="min-w-0">
            <p className="max-w-40 truncate text-[11px] text-zinc-500">{featured.name}</p>
            <Price price={price} />
          </div>
          <ButtonLink href={href} className="px-4">
            Ver <ArrowRight className="size-4" />
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
