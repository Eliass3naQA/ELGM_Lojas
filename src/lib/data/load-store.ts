import { notFound } from "next/navigation";
import { cache } from "react";
import { getStoreBySlug } from "./repository";

// Layouts e páginas de uma loja rodam em paralelo no Next, então cada um
// precisa resolver (e validar) o tenant por conta própria. `cache` deduplica por request.
export const loadStore = cache(async (slug: string) => {
  const store = await getStoreBySlug(slug);
  if (!store) notFound();
  return store;
});
