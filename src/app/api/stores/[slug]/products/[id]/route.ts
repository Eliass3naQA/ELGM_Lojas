import { deleteProduct, patchProduct, updateProduct } from "@/lib/data/repository";
import { handle, productPatchSchema, productSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ slug: string; id: string }> };

// TODO(auth): exigir dono da loja em todas as rotas abaixo.

// Atualização completa (formulário do produto).
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const { slug, id } = await params;
  return updateProduct(slug, id, productSchema.parse(await req.json()));
});

// Alterações rápidas: ativar/ocultar, preço, promoção.
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { slug, id } = await params;
  return patchProduct(slug, id, productPatchSchema.parse(await req.json()));
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { slug, id } = await params;
  await deleteProduct(slug, id);
});
