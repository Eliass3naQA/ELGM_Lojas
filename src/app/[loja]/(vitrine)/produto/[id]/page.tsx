import Link from "next/link";
import { loadStore } from "@/lib/data/load-store";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { ProductConfigurator } from "@/components/store/product-buy-box";
import { ProductCard } from "@/components/store/product-card";
import { getProduct, listProducts } from "@/lib/data/repository";
import { Showroom } from "@/components/store/showroom";
import { money } from "@/lib/format";
import { fromPrice } from "@/lib/pricing";
import { hasShowroom } from "@/lib/showcase";

export default async function ProductPage({ params }: { params: Promise<{ loja: string; id: string }> }) {
  const { loja, id } = await params;
  const store = await loadStore(loja);
  const product = await getProduct(store.id, id);
  if (!product || !product.active) notFound();
  const related = (await listProducts(store.id, { category: product.category })).filter((p) => p.id !== product.id).slice(0, 4);
  const now = Date.now();
  const shippingText =
    store.shippingFlat === 0 ? "Frete grátis" : store.freeShippingOver !== null ? `Frete grátis acima de ${money(store.freeShippingOver)}` : `Frete fixo de ${money(store.shippingFlat)}`;

  const price = fromPrice(product, now);

  return (
    <main className="mx-auto max-w-7xl px-3 pt-4 sm:px-6 sm:pt-6">
      {hasShowroom(product) && (
        <Showroom
          name={product.name}
          eyebrow={product.category}
          price={`${product.variants.some((v) => v.price !== null) ? "a partir de " : ""}${money(price.price)}`}
          showcase={product.showcase}
          logoUrl={store.logoUrl}
          specs={product.specs}
          brand={store.brandColor}
          className="mb-4 sm:mb-6"
        />
      )}
      <div className="glass-sheet rounded-[36px] p-3 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 px-1 sm:mb-5">
          <Link href={`/${loja}/home`} className="grid size-10 place-items-center rounded-full bg-white/70 text-zinc-600 shadow-sm transition hover:bg-white hover:text-zinc-900" aria-label="Voltar">
            <ChevronLeft className="size-5" />
          </Link>
          <div className="min-w-0">
            <Link href={`/${loja}/home?categoria=${encodeURIComponent(product.category)}`} className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 hover:text-zinc-900">
              {product.category}
            </Link>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-950 sm:text-3xl">{product.name}</h1>
          </div>
        </div>
        <ProductConfigurator product={product} now={now} shippingText={shippingText} />
      </div>

      {related.length > 0 && (
        <section className="mt-14">
          <h2 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-950">Você também pode gostar</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} slug={loja} now={now} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
