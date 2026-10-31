"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Plus, Ticket, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { couponTypeLabel, date, money } from "@/lib/format";
import type { Coupon, CouponType } from "@/lib/types";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select, type BadgeTone } from "../ui";

type Status = "active" | "scheduled" | "expired" | "exhausted" | "disabled";
const statusBadge: Record<Status, { label: string; tone: BadgeTone }> = {
  active: { label: "Ativo", tone: "green" },
  scheduled: { label: "Agendado", tone: "blue" },
  expired: { label: "Expirado", tone: "zinc" },
  exhausted: { label: "Esgotado", tone: "yellow" },
  disabled: { label: "Desativado", tone: "zinc" },
};

const describe = (c: Pick<Coupon, "type" | "value">) => (c.type === "percent" ? `${c.value}% off` : c.type === "fixed" ? `${money(c.value)} off` : "Frete grátis");
const fromDate = (v: string, endOfDay = false) => (v ? new Date(`${v}T${endOfDay ? "23:59:59" : "00:00:00"}`).toISOString() : null);

export function CouponManager({ slug, coupons }: { slug: string; coupons: (Coupon & { status: Status })[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [type, setType] = useState<CouponType>("percent");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      router.refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const n = (k: string) => Number(String(f.get(k) ?? "").replace(",", ".")) || 0;
    const ok = await run("create", () =>
      api(`/api/stores/${slug}/coupons`, "POST", {
        code: String(f.get("code")),
        type,
        value: type === "free_shipping" ? 0 : n("value"),
        minSubtotal: n("minSubtotal"),
        startsAt: fromDate(String(f.get("startsAt"))),
        endsAt: fromDate(String(f.get("endsAt")), true),
        maxUses: f.get("maxUses") ? n("maxUses") : null,
      }),
    );
    if (ok) setCreating(false);
  }

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><Ticket className="size-4 text-zinc-400" /> Cupons de desconto</span>}
        description="O cliente digita o código no carrinho"
        action={
          !creating && (
            <Button className="px-3 py-1.5 text-xs" onClick={() => setCreating(true)}>
              <Plus className="size-3.5" /> Novo cupom
            </Button>
          )
        }
      />
      {creating && (
        <form onSubmit={create} className="grid gap-4 border-b border-zinc-100 bg-zinc-50 p-5 sm:grid-cols-4">
          <Field label="Código">
            <Input name="code" required placeholder="BEMVINDO10" className="font-mono uppercase" maxLength={20} />
          </Field>
          <Field label="Tipo">
            <Select value={type} onChange={(e) => setType(e.target.value as CouponType)}>
              {(Object.keys(couponTypeLabel) as CouponType[]).map((t) => (
                <option key={t} value={t}>
                  {couponTypeLabel[t]}
                </option>
              ))}
            </Select>
          </Field>
          {type !== "free_shipping" ? (
            <Field label={type === "percent" ? "Desconto (%)" : "Desconto (R$)"}>
              <Input name="value" required inputMode="decimal" />
            </Field>
          ) : (
            <div />
          )}
          <Field label="Pedido mínimo (R$)" hint="0 = sem mínimo">
            <Input name="minSubtotal" inputMode="decimal" defaultValue="0" />
          </Field>
          <Field label="Válido a partir de" hint="Opcional">
            <Input name="startsAt" type="date" />
          </Field>
          <Field label="Válido até" hint="Opcional">
            <Input name="endsAt" type="date" />
          </Field>
          <Field label="Limite de usos" hint="Vazio = ilimitado">
            <Input name="maxUses" type="number" min={1} />
          </Field>
          <div className="flex items-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={busy === "create"}>
              {busy === "create" && <Loader2 className="size-4 animate-spin" />} Criar cupom
            </Button>
          </div>
        </form>
      )}
      {error && <p className="bg-red-50 px-5 py-2 text-sm text-red-700">{error}</p>}
      {coupons.length === 0 ? (
        <EmptyState title="Nenhum cupom ainda" description="Crie um cupom de boas-vindas ou de frete grátis para incentivar a primeira compra." />
      ) : (
        <ul className="divide-y divide-zinc-100">
          {coupons.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <code className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-2.5 py-1 font-mono text-sm font-semibold">{c.code}</code>
              <div className="min-w-40 flex-1 text-sm">
                <p className="font-medium">{describe(c)}</p>
                <p className="text-xs text-zinc-500">
                  {c.minSubtotal > 0 ? `Acima de ${money(c.minSubtotal)}` : "Sem mínimo"}
                  {c.endsAt && ` · até ${date(c.endsAt)}`}
                  {c.startsAt && ` · a partir de ${date(c.startsAt)}`}
                </p>
              </div>
              <span className="text-xs text-zinc-500">
                {c.uses}
                {c.maxUses ? `/${c.maxUses}` : ""} usos
              </span>
              <Badge tone={statusBadge[c.status].tone}>{statusBadge[c.status].label}</Badge>
              <label className="flex items-center gap-1.5 text-xs text-zinc-500" title={c.active ? "Desativar" : "Ativar"}>
                <input type="checkbox" checked={c.active} disabled={!!busy} onChange={() => run(c.id, () => api(`/api/stores/${slug}/coupons/${c.id}`, "PATCH", { active: !c.active }))} className="accent-zinc-900" />
                ligado
              </label>
              <Button
                variant="ghost"
                className="px-2 py-1"
                disabled={!!busy}
                onClick={() => confirm(`Excluir o cupom ${c.code}?`) && run(c.id, () => api(`/api/stores/${slug}/coupons/${c.id}`, "DELETE"))}
                aria-label={`Excluir ${c.code}`}
              >
                {busy === c.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4 text-zinc-400" />}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
