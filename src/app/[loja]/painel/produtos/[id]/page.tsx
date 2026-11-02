import { notFound } from "next/navigation";
import { loadStore } from "@/lib/data/load-store";
import { ProductForm } from "@/components/painel/product-form";
import { PageHeader } from "@/components/ui";
import { isVehicleStore, optionTemplatesFor } from "@/lib/catalog-templates";
import { getProduct, listProducts } from "@/lib/data/repository";

export default async function EditProductPage({ params }: { params: Promise<{ loja: string; id: string }> }) {
  const { loja, id } = await params;
  const store = await loadStore(loja);
  const product = await getProduct(store.id, id);
  if (!product) notFound();
  const categories = [...new Set((await listProducts(store.id, { includeInactive: true })).map((p) => p.category))];
  return (
    <>
      <PageHeader title="Editar produto" description={product.name} />
      <ProductForm slug={store.slug} brand={store.brandColor} logoUrl={store.logoUrl} vehicles={isVehicleStore(store.category)} product={product} categories={categories} templates={optionTemplatesFor(store.category)} />
    </>
  );
}
