import type { Metadata } from "next";
import { StoreHome } from "@/components/store/store-home";
import { loadStore } from "@/lib/data/load-store";
import { getStoreBySlug, listProducts } from "@/lib/data/repository";

type Props = { params: Promise<{ loja: string }>; searchParams: Promise<{ q?: string; categoria?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const store = await getStoreBySlug((await params).loja);
  return { title: store?.name, description: store?.tagline };
}

export default async function StoreHomePage({ params, searchParams }: Props) {
  const { loja } = await params;
  const { q, categoria } = await searchParams;
  const store = await loadStore(loja);
  const [all, products] = await Promise.all([listProducts(store.id), listProducts(store.id, { q, category: categoria })]);
  return <StoreHome store={store} all={all} products={products} q={q} categoria={categoria} now={Date.now()} />;
}
