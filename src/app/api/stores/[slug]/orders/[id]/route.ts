import { updateOrder } from "@/lib/data/repository";
import { handle, orderUpdateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ slug: string; id: string }> };

// Painel do lojista: mudar status / informar rastreio (envio).
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { slug, id } = await params;
  return updateOrder(slug, id, orderUpdateSchema.parse(await req.json()));
});
