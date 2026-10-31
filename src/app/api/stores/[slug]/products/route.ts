import { createProduct, DomainError, getStoreBySlug, listProducts } from "@/lib/data/repository";
import { handle, productSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const store = await getStoreBySlug((await params).slug);
  if (!store) throw new DomainError("Loja não encontrada.", 404);
  const url = new URL(req.url);
  return listProducts(store.id, {
    q: url.searchParams.get("q") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    includeInactive: url.searchParams.get("all") === "1",
  });
});

// TODO(auth): exigir dono da loja.
export const POST = handle(async (req: Request, { params }: Ctx) => createProduct((await params).slug, productSchema.parse(await req.json())));
