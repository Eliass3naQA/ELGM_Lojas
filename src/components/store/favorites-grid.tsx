"use client";

import type { Product } from "@/lib/types";
import { EmptyState } from "../ui";
import { useFavorites } from "./favorites";
import { ProductCard } from "./product-card";

export function FavoritesGrid({ products, slug, now, vehicle }: { products: Product[]; slug: string; now: number; vehicle: boolean }) {
  const { ids } = useFavorites(slug);
  const saved = products.filter((p) => ids.includes(p.id));
  if (!saved.length) {
    return (
      <div className="glass mt-5 rounded-[28px]">
        <EmptyState title="Nada salvo ainda" description="Toque no coração de um produto para guardar aqui e comparar depois." />
      </div>
    );
  }
  return (
    <div className="mt-10 grid gap-x-5 gap-y-12 sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-3">
      {saved.map((p) => (
        <ProductCard key={p.id} product={p} slug={slug} now={now} vehicle={vehicle} />
      ))}
    </div>
  );
}
