import { deleteCoupon, updateCoupon } from "@/lib/data/repository";
import { couponPatchSchema, handle } from "@/lib/validation";

type Ctx = { params: Promise<{ slug: string; id: string }> };

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { slug, id } = await params;
  return updateCoupon(slug, id, couponPatchSchema.parse(await req.json()));
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { slug, id } = await params;
  await deleteCoupon(slug, id);
});
