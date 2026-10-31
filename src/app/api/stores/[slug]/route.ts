import { DomainError, getStoreBySlug, updateStore } from "@/lib/data/repository";
import { handle, storeUpdateSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ slug: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const store = await getStoreBySlug((await params).slug);
  if (!store) throw new DomainError("Loja não encontrada.", 404);
  return store;
});

// TODO(auth): restringir planId/status ao backoffice quando o Supabase Auth entrar.
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const patch = storeUpdateSchema.parse(await req.json());
  const actor = req.headers.get("x-actor") ?? "lojista";
  return updateStore((await params).slug, patch, actor);
});
