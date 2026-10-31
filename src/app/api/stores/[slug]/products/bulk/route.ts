import { bulkProducts } from "@/lib/data/repository";
import { bulkProductsSchema, handle } from "@/lib/validation";

type Ctx = { params: Promise<{ slug: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { ids, action } = bulkProductsSchema.parse(await req.json());
  return bulkProducts((await params).slug, ids, action);
});
