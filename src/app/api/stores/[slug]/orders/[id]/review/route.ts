import { getStoreBySlug, reviewPayment } from "@/lib/data/repository";
import { handle, reviewSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ slug: string; id: string }> };

// Lojista aprova ou recusa o pagamento. TODO(auth): exigir dono da loja.
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { slug, id } = await params;
  const store = await getStoreBySlug(slug);
  return reviewPayment(slug, id, reviewSchema.parse(await req.json()), store?.ownerName ?? "lojista");
});
