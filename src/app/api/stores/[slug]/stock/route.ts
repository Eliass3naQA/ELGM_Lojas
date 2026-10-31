import { adjustStock, DomainError, getStoreBySlug, listStockMovements } from "@/lib/data/repository";
import { handle, stockAdjustSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ slug: string }> };

// Histórico de movimentações (?productId= para filtrar).
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const store = await getStoreBySlug((await params).slug);
  if (!store) throw new DomainError("Loja não encontrada.", 404);
  return listStockMovements(store.id, { productId: new URL(req.url).searchParams.get("productId") ?? undefined });
});

// Entrada, saída ou contagem de estoque.
export const POST = handle(async (req: Request, { params }: Ctx) => adjustStock((await params).slug, stockAdjustSchema.parse(await req.json())));
