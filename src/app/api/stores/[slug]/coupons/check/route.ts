import { DomainError, evaluateCoupon, getStoreBySlug } from "@/lib/data/repository";
import { couponCheckSchema, handle } from "@/lib/validation";

type Ctx = { params: Promise<{ slug: string }> };

// Vitrine: confere um cupom antes de fechar o pedido (o checkout recalcula no servidor).
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const store = await getStoreBySlug((await params).slug);
  if (!store) throw new DomainError("Loja não encontrada.", 404);
  const { code, subtotal } = couponCheckSchema.parse(await req.json());
  const baseShipping = store.freeShippingOver !== null && subtotal >= store.freeShippingOver ? 0 : store.shippingFlat;
  const { coupon, discount, shipping } = await evaluateCoupon(store, code, subtotal, baseShipping);
  return { code: coupon.code, type: coupon.type, discount, shipping };
});
