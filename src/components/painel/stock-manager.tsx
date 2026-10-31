"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Minus, Plus, Search, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api-client";
import { money } from "@/lib/format";
import type { StockLevel } from "@/lib/pricing";
import { Thumb } from "../media";
import { Badge, Button, Card, EmptyState, Field, Input, Select, cn } from "../ui";

export type StockRow = {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  variant: string | null;
  sku: string;
  imageUrl: string | null;
  emoji: string;
  stock: number;
  threshold: number;
  price: number;
  level: StockLevel;
};

type Mode = "add" | "remove" | "set";
const modes: { id: Mode; label: string; icon: typeof Plus }[] = [
  { id: "add", label: "Entrada", icon: Plus },
  { id: "remove", label: "Saída", icon: Minus },
  { id: "set", label: "Contagem", icon: SlidersHorizontal },
];
const defaultReason: Record<Mode, string> = { add: "restock", remove: "loss", set: "adjustment" };

function AdjustPanel({ slug, row, onDone }: { slug: string; row: StockRow; onDone: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("add");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState(defaultReason.add);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const n = Number(qty);
  const result = qty === "" ? null : mode === "add" ? row.stock + n : mode === "remove" ? row.stock - n : n;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api(`/api/stores/${slug}/stock`, "POST", { productId: row.productId, variantId: row.variantId, mode, qty: n, reason, note });
      router.refresh();
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 bg-zinc-50 p-4 sm:grid-cols-[auto_120px_180px_1fr_auto] sm:items-end">
      <div className="flex rounded-xl border border-zinc-200 bg-white p-0.5">
        {modes.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setMode(id);
              setReason(defaultReason[id]);
            }}
            className={cn("flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition", mode === id ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-100")}
          >
            <Icon className="size-3.5" /> {label}
          </button>
        ))}
      </div>
      <Field label={mode === "set" ? "Quantidade contada" : "Quantidade"} hint={result !== null ? `Fica com ${result} un.` : undefined}>
        <Input type="number" min={0} required autoFocus value={qty} onChange={(e) => setQty(e.target.value)} className={cn(result !== null && result < 0 && "border-red-300")} />
      </Field>
      <Field label="Motivo">
        <Select value={reason} onChange={(e) => setReason(e.target.value)}>
          {mode === "add" && <option value="restock">Entrada / reposição</option>}
          {mode !== "remove" && <option value="return">Devolução</option>}
          {mode === "remove" && <option value="loss">Perda / avaria</option>}
          <option value="adjustment">Ajuste / contagem</option>
        </Select>
      </Field>
      <Field label="Observação">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: NF 1234, fornecedor X" maxLength={200} />
      </Field>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" disabled={loading || qty === "" || (result !== null && result < 0)}>
          {loading && <Loader2 className="size-4 animate-spin" />} Salvar
        </Button>
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-5">{error}</p>}
    </form>
  );
}

export function StockManager({ slug, rows }: { slug: string; rows: StockRow[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [open, setOpen] = useState<string | null>(null);
  const tracked = rows.filter((r) => r.level !== "untracked");
  const visible = tracked.filter((r) => (filter === "all" || r.level === filter) && (!q || `${r.name} ${r.variant ?? ""} ${r.sku}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 p-3">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar produto, variação ou SKU…" className="pl-9" />
        </div>
        <div className="flex gap-1 rounded-xl bg-zinc-100 p-1">
          {(
            [
              ["all", "Todos", tracked.length],
              ["low", "Baixo", tracked.filter((r) => r.level === "low").length],
              ["out", "Esgotado", tracked.filter((r) => r.level === "out").length],
            ] as const
          ).map(([id, label, count]) => (
            <button key={id} onClick={() => setFilter(id)} className={cn("rounded-lg px-3 py-1.5 text-sm transition", filter === id ? "bg-white font-medium shadow-sm" : "text-zinc-500 hover:text-zinc-900")}>
              {label} <span className="text-xs text-zinc-400">{count}</span>
            </button>
          ))}
        </div>
      </div>
      {visible.length === 0 ? (
        <EmptyState title="Nada por aqui" description={filter === "all" ? undefined : "Nenhum item nesta situação. 🎉"} />
      ) : (
        <ul className="divide-y divide-zinc-100">
          {visible.map((r) => (
            <li key={r.key}>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <Thumb url={r.imageUrl} emoji={r.emoji} alt={r.name} className="size-10 rounded-lg" emojiClassName="text-lg" />
                <div className="min-w-40 flex-1">
                  <p className="text-sm font-medium">
                    {r.name}
                    {r.variant && <span className="font-normal text-zinc-500"> · {r.variant}</span>}
                  </p>
                  <p className="font-mono text-xs text-zinc-400">{r.sku || "sem SKU"}</p>
                </div>
                <div className="w-24 text-right text-xs text-zinc-500">{money(r.stock * r.price)}</div>
                <div className="flex w-28 items-center justify-end gap-2">
                  <span className={cn("text-lg font-semibold tabular-nums", r.level === "out" && "text-red-600", r.level === "low" && "text-amber-600")}>{r.stock}</span>
                  {r.level === "out" ? <Badge tone="red">Esgotado</Badge> : r.level === "low" ? <Badge tone="yellow">Baixo</Badge> : <span className="text-xs text-zinc-400">un.</span>}
                </div>
                <Button variant={open === r.key ? "primary" : "outline"} className="px-3 py-1.5 text-xs" onClick={() => setOpen(open === r.key ? null : r.key)}>
                  Ajustar
                </Button>
              </div>
              {open === r.key && <AdjustPanel slug={slug} row={r} onDone={() => setOpen(null)} />}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
