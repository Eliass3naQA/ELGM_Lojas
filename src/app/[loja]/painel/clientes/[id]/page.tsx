import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Mail, MessageCircle } from "lucide-react";
import { ProviderIcon } from "@/components/store/login-panel";
import { Badge, ButtonLink, Card, CardHeader, OrderStatusBadge, StatCard, Table } from "@/components/ui";
import { authProviders } from "@/lib/auth/providers";
import { loadStore } from "@/lib/data/load-store";
import { formatAddress, listCustomers, listOrders } from "@/lib/data/repository";
import { date, dateTime, money } from "@/lib/format";
import { segment, vipThreshold } from "@/lib/segments";

export default async function CustomerDetail({ params }: { params: Promise<{ loja: string; id: string }> }) {
  const { loja, id } = await params;
  const store = await loadStore(loja);
  const customers = await listCustomers(store.id);
  const c = customers.find((x) => x.id === id);
  if (!c) notFound();
  const orders = (await listOrders({ storeId: store.id })).filter((o) => o.customerId === c.id);
  const s = segment(c, vipThreshold(customers));
  const phone = c.phone.replace(/\D/g, "");

  const row = (label: string, value: React.ReactNode) => (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-0.5">{value || "—"}</dd>
    </div>
  );

  return (
    <>
      <Link href={`/${loja}/painel/clientes`} className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
        <ChevronLeft className="size-4" /> Clientes
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <span className="bg-brand-soft text-brand-strong grid size-14 place-items-center rounded-full text-xl font-semibold">{c.name.charAt(0)}</span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
            <Badge tone={s.tone}>{s.label}</Badge>
          </div>
          <p className="text-sm text-zinc-500">Cliente desde {date(c.createdAt)}</p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href={`mailto:${c.email}`} variant="outline">
            <Mail className="size-4" /> E-mail
          </ButtonLink>
          {phone && (
            <ButtonLink href={`https://wa.me/55${phone}`} target="_blank" variant="outline">
              <MessageCircle className="size-4" /> WhatsApp
            </ButtonLink>
          )}
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Pedidos" value={String(c.orders)} />
        <StatCard label="Total gasto" value={money(c.spent)} />
        <StatCard label="Ticket médio" value={money(c.orders ? c.spent / c.orders : 0)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Cadastro" />
          <dl className="grid gap-4 p-5 text-sm sm:grid-cols-2">
            {row("E-mail", c.email)}
            {row(
              "Login",
              c.provider && (
                <span className="inline-flex items-center gap-1.5">
                  <ProviderIcon provider={c.provider} className="size-3.5" /> {authProviders[c.provider].label}
                </span>
              ),
            )}
            {row("CPF", c.cpf && <span className="font-mono">{c.cpf}</span>)}
            {row("Telefone", c.phone)}
            {row("Nascimento", c.birthDate && date(c.birthDate + "T12:00:00"))}
            {row("Cidade", c.city)}
            <div className="sm:col-span-2">{row("Endereço de entrega", c.address && formatAddress(c.address))}</div>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Consentimentos (LGPD)" />
          <dl className="space-y-4 p-5 text-sm">
            {row("Termos e Privacidade", c.acceptedTermsAt ? `Aceitos em ${dateTime(c.acceptedTermsAt)}` : <Badge tone="yellow">Não aceitos</Badge>)}
            {row(
              "Versão aceita",
              c.termsVersion === store.termsUpdatedAt ? <Badge tone="green">Versão atual</Badge> : c.termsVersion ? <Badge tone="yellow">Versão antiga</Badge> : null,
            )}
            {row("Marketing", c.marketingOptIn ? <Badge tone="green">Autorizado</Badge> : <Badge>Não autorizado</Badge>)}
          </dl>
          {!c.marketingOptIn && <p className="px-5 pb-5 text-xs text-zinc-400">Não envie ofertas para este cliente: ele não autorizou comunicações de marketing.</p>}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Histórico de pedidos" />
        <Table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Itens</th>
              <th>Status</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/${loja}/painel/pedidos/${o.id}`} className="font-medium hover:underline">
                    #{o.number}
                  </Link>
                  <p className="text-xs text-zinc-400">{dateTime(o.createdAt)}</p>
                </td>
                <td className="text-zinc-500">{o.items.map((i) => `${i.qty}× ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""}`).join(", ")}</td>
                <td>
                  <OrderStatusBadge status={o.status} />
                </td>
                <td className="text-right font-medium">{money(o.total)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
