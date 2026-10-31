import { requireUser } from "@/lib/auth/session";
import { DomainError, getCustomerForUser, getStoreBySlug, isProfileComplete, saveCustomerProfile } from "@/lib/data/repository";
import { handle, profileSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ slug: string }> };

// Perfil do comprador logado nesta loja.
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireUser();
  const store = await getStoreBySlug((await params).slug);
  if (!store) throw new DomainError("Loja não encontrada.", 404);
  const customer = await getCustomerForUser(store.id, user);
  return { user, customer, complete: isProfileComplete(customer, store) };
});

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireUser();
  return saveCustomerProfile((await params).slug, user, profileSchema.parse(await req.json()));
});
