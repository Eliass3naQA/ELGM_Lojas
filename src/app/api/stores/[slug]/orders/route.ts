import { requireUser } from "@/lib/auth/session";
import { createOrder, DomainError, getStoreBySlug, listOrders } from "@/lib/data/repository";
import type { OrderStatus } from "@/lib/types";
import { checkoutSchema, handle } from "@/lib/validation";

type Ctx = { params: Promise<{ slug: string }> };

// Painel do lojista: listar pedidos. TODO(auth): exigir dono da loja.
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const store = await getStoreBySlug((await params).slug);
  if (!store) throw new DomainError("Loja não encontrada.", 404);
  const status = new URL(req.url).searchParams.get("status") as OrderStatus | null;
  return listOrders({ storeId: store.id, status: status ?? undefined });
});

// Vitrine: checkout do comprador logado (dados de entrega vêm do cadastro).
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  return createOrder((await params).slug, user, checkoutSchema.parse(await req.json()));
});
