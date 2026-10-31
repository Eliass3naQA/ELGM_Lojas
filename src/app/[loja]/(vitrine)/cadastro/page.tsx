import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/store/profile-form";
import { safeNext } from "@/lib/auth/redirect";
import { getSessionUser } from "@/lib/auth/session";
import { loadStore } from "@/lib/data/load-store";
import { getCustomerForUser } from "@/lib/data/repository";

export const metadata = { title: "Cadastro" };

export default async function ProfilePage({ params, searchParams }: { params: Promise<{ loja: string }>; searchParams: Promise<{ next?: string }> }) {
  const store = await loadStore((await params).loja);
  const next = safeNext(store.slug, (await searchParams).next);
  const user = await getSessionUser();
  if (!user) redirect(`/${store.slug}/entrar?next=${encodeURIComponent(`/${store.slug}/cadastro?next=${next}`)}`);
  const customer = await getCustomerForUser(store.id, user);
  const termsChanged = !!customer?.termsVersion && customer.termsVersion !== store.termsUpdatedAt;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{customer?.cpf ? "Meus dados" : "Complete seu cadastro"}</h1>
      <p className="mt-1 mb-6 text-sm text-zinc-500">
        Conectado como <b className="text-zinc-700">{user.email}</b>. Usamos estes dados apenas para entregar e faturar seus pedidos na {store.name}.
      </p>
      <ProfileForm slug={store.slug} next={next} defaultName={user.name} customer={customer} termsChanged={termsChanged} />
    </main>
  );
}
