import { ProductForm } from "@/components/painel/product-form";
import { loadStore } from "@/lib/data/load-store";
import { PageHeader } from "@/components/ui";
import { isVehicleStore, optionTemplatesFor } from "@/lib/catalog-templates";
import { listProducts } from "@/lib/data/repository";

export const metadata = { title: "Novo produto" };

export default async function NewProductPage({ params }: { params: Promise<{ loja: string }> }) {
  const store = await loadStore((await params).loja);
  const categories = [...new Set((await listProducts(store.id, { includeInactive: true })).map((p) => p.category))];
  return (
    <>
      <PageHeader title="Novo produto" />
      <ProductForm slug={store.slug} brand={store.brandColor} logoUrl={store.logoUrl} vehicles={isVehicleStore(store.category)} categories={categories} templates={optionTemplatesFor(store.category)} />
    </>
  );
}
