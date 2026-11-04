import type { Metadata } from "next";
import { FavoritesGrid } from "@/components/store/favorites-grid";
import { isVehicleStore } from "@/lib/catalog-templates";
import { loadStore } from "@/lib/data/load-store";
import { listProducts } from "@/lib/data/repository";

export const metadata: Metadata = { title: "Favoritos" };

export default async function FavoritesPage({ params }: { params: Promise<{ loja: string }> }) {
  const { loja } = await params;
  const store = await loadStore(loja);
  const products = await listProducts(store.id);
  return (
    <main className="mx-auto max-w-[1512px] px-5 pt-12 sm:px-8">
      <h1 className="text-4xl font-light tracking-[-0.035em] text-white sm:text-6xl">Favoritos</h1>
      <FavoritesGrid products={products} slug={loja} now={Date.now()} vehicle={isVehicleStore(store.category)} />
    </main>
  );
}
