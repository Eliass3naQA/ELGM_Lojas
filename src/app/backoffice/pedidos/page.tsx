import Link from "next/link";
import { Card, OrderStatusBadge, PageHeader, PaymentStatusBadge, Table } from "@/components/ui";
import { listOrders, listPayments, listStores } from "@/lib/data/repository";
import { dateTime, money, paymentLabel } from "@/lib/format";

export const metadata = { title: "Pedidos" };

export default async function AllOrdersPage() {
  const [orders, stores, payments] = await Promise.all([listOrders(), listStores(), listPayments()]);
  const paymentByOrder = Object.fromEntries(payments.map((p) => [p.orderId, p]));
  const storeById = Object.fromEntries(stores.map((s) => [s.id, s]));
  return (
    <>
      <PageHeader title="Pedidos da plataforma" description={`${orders.length} pedidos em todas as lojas (mostrando os 100 mais recentes).`} />
      <Card>
        <Table>
          <thead>
            <tr>
              <th>Pedido</th>
              <th>Loja</th>
              <th>Forma</th>
              <th>Pagamento</th>
              <th>Status</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.slice(0, 100).map((o) => {
              const s = storeById[o.storeId];
              return (
                <tr key={o.id}>
                  <td>
                    <p className="font-medium">#{o.number}</p>
                    <p className="text-xs text-zinc-400">{dateTime(o.createdAt)}</p>
                  </td>
                  <td>
                    <Link href={`/backoffice/lojas/${s.slug}`} className="hover:underline">
                      {s.logo} {s.name}
                    </Link>
                  </td>
                  <td className="text-zinc-500">{paymentLabel[o.paymentMethod]}</td>
                  <td>{paymentByOrder[o.id] && <PaymentStatusBadge status={paymentByOrder[o.id].status} />}</td>
                  <td>
                    <OrderStatusBadge status={o.status} />
                  </td>
                  <td className="text-right font-medium">{money(o.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
