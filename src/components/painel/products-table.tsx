"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Copy, Eye, EyeOff, Loader2, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { money } from "@/lib/format";
import { fromPrice, stockLevel } from "@/lib/pricing";
import type { Product } from "@/lib/types";
import { Thumb } from "../media";
import { Badge, Button, Card, EmptyState, Input, Select, cn } from "../ui";

type Filter = "all" | "active" | "hidden" | "promo" | "low" | "out";
const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "active", label: "Ativos" },
  { id: "hidden", label: "Ocultos" },
  { id: "promo", label: "Em promoção" },
  { id: "low", label: "Estoque baixo" },
  { id: "out", label: "Esgotados" },
];

export function ProductsTable({ slug, products, now }: { slug: string; products: Product[]; now: number }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = `/${slug}/painel/produtos`;

  const rows = useMemo(
    () =>
      products.map((p) => {
        const price = fromPrice(p, now);
        // com variações, o nível de estoque considera a pior variação
        const levels = p.variants.length ? p.variants.map((v) => stockLevel(v.stock, p.lowStockThreshold, p.trackStock)) : [stockLevel(p.stock, p.lowStockThreshold, p.trackStock)];
        const level = levels.every((l) => l === "out") ? "out" : levels.includes("out") || levels.includes("low") ? "low" : levels[0];
        const outVariants = levels.filter((l) => l === "out").length;
        return { p, price, level, outVariants };
      }),
    [products, now],
  );
  const categories = [...new Set(products.map((p) => p.category))].sort();
  const counts = Object.fromEntries(filters.map((f) => [f.id, rows.filter((r) => matches(r, f.id)).length]));
  const visible = rows.filter((r) => matches(r, filter) && (!category || r.p.category === category) && (!q || `${r.p.name} ${r.p.sku} ${r.p.variants.map((v) => v.sku).join(" ")}`.toLowerCase().includes(q.toLowerCase())));
  const allChecked = visible.length > 0 && visible.every((r) => selected.has(r.p.id));

  function matches(r: (typeof rows)[number], f: Filter) {
    if (f === "active") return r.p.active;
    if (f === "hidden") return !r.p.active;
    if (f === "promo") return r.price.onSale;
    if (f === "low") return r.level === "low";
    if (f === "out") return r.level === "out";
    return true;
  }

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const bulk = (action: "activate" | "deactivate" | "delete") => {
    if (action === "delete" && !confirm(`Excluir ${selected.size} produto(s) definitivamente?`)) return;
    run(action, async () => {
      await api(`/api/stores/${slug}/products/bulk`, "POST", { ids: [...selected], action });
      setSelected(new Set());
    });
  };

  if (products.length === 0) return null;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 p-3">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou SKU…" className="pl-9" />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-auto">
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-zinc-100 px-3 py-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition", filter === f.id ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900")}
          >
            {f.label} <span className="text-xs opacity-60">{counts[f.id]}</span>
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-zinc-900 px-4 py-2 text-sm text-white">
          <span className="font-medium">{selected.size} selecionado(s)</span>
          <button onClick={() => setSelected(new Set())} className="text-xs text-zinc-400 hover:text-white">
            limpar
          </button>
          <div className="ml-auto flex gap-1">
            <Button variant="ghost" className="px-3 py-1 text-xs text-white hover:bg-white/10" disabled={!!busy} onClick={() => bulk("activate")}>
              <Eye className="size-3.5" /> Mostrar na loja
            </Button>
            <Button variant="ghost" className="px-3 py-1 text-xs text-white hover:bg-white/10" disabled={!!busy} onClick={() => bulk("deactivate")}>
              <EyeOff className="size-3.5" /> Ocultar
            </Button>
            <Button variant="ghost" className="px-3 py-1 text-xs text-red-300 hover:bg-white/10" disabled={!!busy} onClick={() => bulk("delete")}>
              <Trash2 className="size-3.5" /> Excluir
            </Button>
          </div>
        </div>
      )}
      {error && <p className="bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      {visible.length === 0 ? (
        <EmptyState title="Nenhum produto neste filtro" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50/70 text-xs text-zinc-500">
              <tr>
                <th className="w-10 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={() => setSelected(allChecked ? new Set() : new Set(visible.map((r) => r.p.id)))}
                    className="accent-zinc-900"
                    aria-label="Selecionar todos"
                  />
                </th>
                <th className="px-3 py-2.5 font-medium">Produto</th>
                <th className="px-3 py-2.5 font-medium">Preço</th>
                <th className="px-3 py-2.5 font-medium">Estoque</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {visible.map(({ p, price, level, outVariants }) => (
                <tr key={p.id} className={cn("border-t border-zinc-100 hover:bg-zinc-50/60", selected.has(p.id) && "bg-zinc-50")}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() =>
                        setSelected((s) => {
                          const n = new Set(s);
                          if (n.has(p.id)) n.delete(p.id);
                          else n.add(p.id);
                          return n;
                        })
                      }
                      className="accent-zinc-900"
                      aria-label={`Selecionar ${p.name}`}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Link href={`${base}/${p.id}`} className="flex items-center gap-3">
                      <Thumb url={p.images[0]} emoji={p.image} alt={p.name} className="size-11 rounded-lg" emojiClassName="text-xl" />
                      <span className="min-w-0">
                        <span className="block font-medium hover:underline">{p.name}</span>
                        <span className="block text-xs text-zinc-400">
                          {p.category}
                          {p.sku && <span className="font-mono"> · {p.sku}</span>}
                          {p.variants.length > 0 && ` · ${p.variants.length} variações`}
                          {p.images.length > 0 && ` · ${p.images.length} foto(s)`}
                        </span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {p.variants.some((v) => v.price !== null) && <span className="text-xs text-zinc-400">a partir de </span>}
                    <span className={price.onSale ? "font-medium text-red-600" : ""}>{money(price.price)}</span>
                    {price.onSale && <span className="ml-1.5 text-xs text-zinc-400 line-through">{money(price.regular)}</span>}
                    {p.promo && !price.onSale && (p.promo.startsAt && new Date(p.promo.startsAt).getTime() > now ? <Badge tone="blue" className="ml-1.5">Promo agendada</Badge> : <Badge className="ml-1.5">Promo encerrada</Badge>)}
                  </td>
                  <td className="px-3 py-3">
                    {level === "untracked" ? (
                      <span className="text-xs text-zinc-400">ilimitado</span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <span className={cn(level === "out" && "text-red-600", level === "low" && "text-amber-600")}>{p.stock} un.</span>
                        {level === "out" && <Badge tone="red">Esgotado</Badge>}
                        {level === "low" && <Badge tone="yellow">{outVariants ? `${outVariants} var. esgotada(s)` : "Baixo"}</Badge>}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => run(`t${p.id}`, () => api(`/api/stores/${slug}/products/${p.id}`, "PATCH", { active: !p.active }))}
                      disabled={!!busy}
                      title={p.active ? "Clique para ocultar" : "Clique para mostrar"}
                    >
                      {busy === `t${p.id}` ? <Loader2 className="size-4 animate-spin" /> : p.active ? <Badge tone="green">Ativo</Badge> : <Badge>Oculto</Badge>}
                    </button>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Button
                      variant="ghost"
                      className="px-2 py-1"
                      title="Duplicar"
                      disabled={!!busy}
                      onClick={() => run(`d${p.id}`, async () => router.push(`${base}/${(await api<Product>(`/api/stores/${slug}/products/${p.id}/duplicate`, "POST")).id}`))}
                    >
                      {busy === `d${p.id}` ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4 text-zinc-400" />}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
