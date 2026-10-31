import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Pencil } from "lucide-react";
import { ProviderIcon } from "@/components/store/login-panel";
import { LogoutButton } from "@/components/store/logout-button";
import { Thumb } from "@/components/media";
import { Badge, ButtonLink, Card, CardHeader, EmptyState, OrderStatusBadge, PaymentStatusBadge } from "@/components/ui";
import { authProviders } from "@/lib/auth/providers";
import { getSessionUser } from "@/lib/auth/session";
import { loadStore } from "@/lib/data/load-store";
import { formatAddress, getCustomerForUser, isProfileComplete, listOrders, listPayments } from "@/lib/data/repository";
import { date, money } from "@/lib/format";

export const metadata = { title: "Minha conta" };

export default async function AccountPage({ params }: { params: Promise<{ loja: string }> }) {
  const { loja } = await params;
  const store = await loadStore(loja);
  const user = await getSessionUser();
  if (!user) redirect(`/${loja}/entrar?next=${encodeURIComponent(`/${loja}/conta`)}`);
  const customer = await getCustomerForUser(store.id, user);
  const [orders, payments] = await Promise.all([customer ? listOrders({ storeId: store.id }).then((os) => os.filter((o) => o.customerId === customer.id)) : [], listPayments({ storeId: store.id })]);
  const paymentByOrder = Object.fromEntries(payments.map((p) => [p.orderId, p]));
  const complete = isProfileComplete(customer, store);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-4">
        <span className="bg-brand-soft text-brand-strong grid size-14 place-items-center rounded-full text-xl font-semibold">{(customer?.name ?? user.name).charAt(0).toUpperCase()}</span>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Olá, {(customer?.name ?? user.name).split(" ")[0]}!</h1>
          <p className="flex items-center gap-1.5 text-sm text-zinc-500">
            <ProviderIcon provider={user.provider} className="size-3.5" /> {user.email} · via {authProviders[user.provider].label}
          </p>
        </div>
        <LogoutButton redirectTo={`/${loja}/home`} />
      </div>

      {!complete && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
          <p className="flex-1">Complete seu cadastro para poder comprar.</p>
          <ButtonLink href={`/${loja}/cadastro?next=${encodeURIComponent(`/${loja}/conta`)}`} variant="brand">
            Completar cadastro
          </ButtonLink>
        </div>
      )}

      {customer?.address && (
        <Card className="mt-6">
          <CardHeader
            title="Meus dados"
            action={
              <Link href={`/${loja}/cadastro?next=${encodeURIComponent(`/${loja}/conta`)}`} className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900">
                <Pencil className="size-3" /> Editar
              </Link>
            }
          />
          <dl className="grid gap-4 p-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-zinc-500">Nome</dt>
              <dd>{customer.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">CPF</dt>
              <dd>{customer.cpf}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-zinc-500">Endereço de entrega</dt>
              <dd>{formatAddress(customer.address)}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Comunicações</dt>
              <dd>{customer.marketingOptIn ? <Badge tone="green">Recebendo ofertas</Badge> : <Badge>Não recebe ofertas</Badge>}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Termos aceitos em</dt>
              <dd>{customer.acceptedTermsAt ? date(customer.acceptedTermsAt) : "—"}</dd>
            </div>
          </dl>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader title="Meus pedidos" />
        {orders.length === 0 ? (
          <EmptyState title="Você ainda não fez pedidos" action={<ButtonLink href={`/${loja}/home`} variant="brand">Ver produtos</ButtonLink>} />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {orders.map((o) => {
              const p = paymentByOrder[o.id];
              return (
                <li key={o.id}>
                  <Link href={`/${loja}/pedido/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition hover:bg-zinc-50">
                    <Thumb url={o.items[0]?.imageUrl} emoji={o.items[0]?.image ?? "📦"} alt="" className="size-10 rounded-lg" emojiClassName="text-xl" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        #{o.number} · {o.items.length} item(ns)
                      </p>
                      <p className="text-xs text-zinc-500">{date(o.createdAt)}</p>
                    </div>
                    {o.status === "pending" && p ? <PaymentStatusBadge status={p.status} /> : <OrderStatusBadge status={o.status} />}
                    <span className="w-24 text-right text-sm font-medium">{money(o.total)}</span>
                    <ChevronRight className="size-4 text-zinc-300" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <p className="mt-6 text-center text-xs text-zinc-400">
        Para pedir a exclusão dos seus dados (LGPD), escreva para {store.ownerEmail}. ·{" "}
        <Link href={`/${loja}/privacidade`} className="underline">
          Política de Privacidade
        </Link>
      </p>
    </main>
  );
}
