"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { api } from "@/lib/api-client";
import type { Order, OrderStatus } from "@/lib/types";
import { Button, Card, CardHeader, Field, Input } from "../ui";

// Espelha as transições permitidas pelo backend (repository.updateOrder).
const actions: Partial<Record<OrderStatus, { to: OrderStatus; label: string; variant?: "primary" | "danger" | "outline" }[]>> = {
  // pagamento é aprovado no card "Pagamento" (PaymentReview)
  pending: [{ to: "cancelled", label: "Cancelar pedido", variant: "outline" }],
  paid: [{ to: "cancelled", label: "Cancelar pedido", variant: "outline" }],
  shipped: [{ to: "delivered", label: "Marcar como entregue" }],
};

export function OrderActions({ slug, order }: { slug: string; order: Order }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(order.trackingCode ?? "");

  async function update(patch: { status?: OrderStatus; trackingCode?: string }, key: string) {
    if (patch.status === "cancelled" && !confirm("Cancelar este pedido? O estoque será devolvido.")) return;
    setLoading(key);
    setError(null);
    try {
      await api(`/api/stores/${slug}/orders/${order.id}`, "PATCH", patch);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  const list = actions[order.status] ?? [];

  return (
    <Card>
      <CardHeader title="Ações" description="Atualize o andamento do pedido" />
      <div className="space-y-4 p-5">
        {order.status === "paid" && (
          <form
            className="space-y-3 rounded-xl bg-zinc-50 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              update({ status: "shipped", trackingCode: tracking.trim() }, "ship");
            }}
          >
            <Field label="Código de rastreio" hint="O cliente verá o código na página do pedido.">
              <Input value={tracking} onChange={(e) => setTracking(e.target.value.toUpperCase())} placeholder="BR123456789BR" required />
            </Field>
            <Button type="submit" className="w-full" disabled={!!loading}>
              {loading === "ship" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Enviar pedido
            </Button>
          </form>
        )}
        {list.map((a) => (
          <Button key={a.to} variant={a.variant ?? "primary"} className="w-full" disabled={!!loading} onClick={() => update({ status: a.to }, a.to)}>
            {loading === a.to && <Loader2 className="size-4 animate-spin" />} {a.label}
          </Button>
        ))}
        {order.status === "pending" && <p className="text-center text-xs text-zinc-500">O envio é liberado depois que você aprovar o pagamento.</p>}
        {list.length === 0 && order.status !== "paid" && <p className="text-center text-sm text-zinc-500">Nenhuma ação pendente para este pedido.</p>}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
    </Card>
  );
}
