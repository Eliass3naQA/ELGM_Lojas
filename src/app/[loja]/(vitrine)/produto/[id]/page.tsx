import { notFound } from "next/navigation";
import { totalAvailable } from "@/components/store/product-card";
import { ProductView } from "@/components/store/product-view";
import { SimilarProducts } from "@/components/store/similar-products";
import { StoreRail } from "@/components/store/store-rail";
import { isVehicleStore } from "@/lib/catalog-templates";
import { loadStore } from "@/lib/data/load-store";
import { getProduct, listProducts } from "@/lib/data/repository";
import { money } from "@/lib/format";
import { fromPrice } from "@/lib/pricing";

export default async function ProductPage({ params }: { params: Promise<{ loja: string; id: string }> }) {
  const { loja, id } = await params;
  const store = await loadStore(loja);
  const product = await getProduct(store.id, id);
  if (!product || !product.active) notFound();
  const all = await listProducts(store.id);
  const now = Date.now();
  const vehicle = isVehicleStore(store.category);
  const shippingText =
    store.shippingFlat === 0 ? "Frete grátis" : store.freeShippingOver !== null ? `Frete grátis acima de ${money(store.freeShippingOver)}` : `Frete fixo de ${money(store.shippingFlat)}`;

  // mesma categoria primeiro; completa com o restante da loja
  const others = all.filter((p) => p.id !== product.id);
  const similar = [...others.filter((p) => p.category === product.category), ...others.filter((p) => p.category !== product.category)].slice(0, 4);

  return (
    <div className="pdp mx-auto flex max-w-[1560px] gap-4 px-3 pt-4 sm:px-6">
      <StoreRail slug={loja} vehicle={vehicle} hasDeals={all.some((p) => fromPrice(p, now).onSale && totalAvailable(p) > 0)} />
      <main className="min-w-0 flex-1 text-white">
        <ProductView key={product.id} product={product} slug={loja} now={now} vehicle={vehicle} whatsapp={store.whatsapp} brand={store.brandColor} logoUrl={store.logoUrl} shippingText={shippingText} />
        <SimilarProducts products={similar} slug={loja} now={now} title={vehicle ? "Veículos similares" : "Você também pode gostar"} allHref={`/${loja}/home?categoria=${encodeURIComponent(product.category)}`} />
      </main>
    </div>
  );
}
