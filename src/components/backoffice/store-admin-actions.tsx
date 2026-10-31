"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { money } from "@/lib/format";
import type { Plan, Store, StoreStatus } from "@/lib/types";
import { Button, Card, CardHeader, Field, Select } from "../ui";

export function StoreAdminActions({ store, plans }: { store: Store; plans: Plan[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Partial<Store>, key: string) {
    setLoading(key);
    setError(null);
    try {
      await api(`/api/stores/${store.slug}`, "PATCH", body, { "x-actor": "admin" });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  const statusAction: { to: StoreStatus; label: string; variant: "danger" | "primary" }[] =
    store.status === "suspended"
      ? [{ to: "active", label: "Reativar loja", variant: "primary" }]
      : store.status === "trial"
        ? [
            { to: "active", label: "Ativar assinatura", variant: "primary" },
            { to: "suspended", label: "Suspender", variant: "danger" },
          ]
        : [{ to: "suspended", label: "Suspender loja", variant: "danger" }];

  return (
    <Card>
      <CardHeader title="Administração" description="Ações registradas na auditoria" />
      <div className="space-y-4 p-5">
        <Field label="Plano">
          <Select value={store.planId} disabled={!!loading} onChange={(e) => patch({ planId: e.target.value as Plan["id"] }, "plan")}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {money(p.priceMonthly)}/mês · {p.feePercent}%
              </option>
            ))}
          </Select>
        </Field>
        {statusAction.map((a) => (
          <Button
            key={a.to}
            variant={a.variant}
            className="w-full"
            disabled={!!loading}
            onClick={() => (a.to !== "suspended" || confirm(`Suspender ${store.name}? A vitrine ficará indisponível.`)) && patch({ status: a.to }, a.to)}
          >
            {loading === a.to && <Loader2 className="size-4 animate-spin" />} {a.label}
          </Button>
        ))}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
    </Card>
  );
}
