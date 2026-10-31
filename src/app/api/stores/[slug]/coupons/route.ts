import { createCoupon, DomainError, getStoreBySlug, listCoupons } from "@/lib/data/repository";
import { couponSchema, handle } from "@/lib/validation";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const store = await getStoreBySlug((await params).slug);
  if (!store) throw new DomainError("Loja não encontrada.", 404);
  return listCoupons(store.id);
});

export const POST = handle(async (req: Request, { params }: Ctx) => createCoupon((await params).slug, couponSchema.parse(await req.json())));
