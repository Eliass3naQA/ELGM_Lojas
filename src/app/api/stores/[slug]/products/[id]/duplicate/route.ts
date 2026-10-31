import { duplicateProduct } from "@/lib/data/repository";
import { handle } from "@/lib/validation";

type Ctx = { params: Promise<{ slug: string; id: string }> };

export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { slug, id } = await params;
  return duplicateProduct(slug, id);
});
