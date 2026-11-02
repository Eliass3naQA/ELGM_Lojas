"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Copy, Layers, ListChecks, Loader2, Plus, Rotate3d, Sparkles, Tag, Trash2, X } from "lucide-react";
import { api } from "@/lib/api-client";
import type { OptionTemplate } from "@/lib/catalog-templates";
import { money } from "@/lib/format";
import { combinations, priceOf, variantLabel } from "@/lib/pricing";
import type { Product, ProductOption, Showcase, Spec, Variant } from "@/lib/types";
import { Thumb } from "../media";
import { Badge, Button, Card, CardHeader, Field, Input, Textarea, cn } from "../ui";
import { GalleryField } from "./image-fields";
import { ShowcaseField, SpecsField } from "./showcase-field";

const EMOJIS = ["📦", "👕", "👗", "👟", "👜", "🕶️", "☕", "🫘", "🎁", "⌨️", "🎧", "📷", "🔌", "🌿", "🪴", "🏺", "💄", "📚", "🧸", "🍫"];

type VariantDraft = Omit<Variant, "id"> & { id?: string };

// datetime-local <-> ISO
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);
const num = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(",", ".")));
const skuPart = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase();

function ValuesInput({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState("");
  const commit = () => {
    const parts = text.split(",").map((t) => t.trim()).filter((t) => t && !values.includes(t));
    if (parts.length) onChange([...values, ...parts]);
    setText("");
  };
  return (
    <div className="flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2 py-1.5 focus-within:border-zinc-400">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2 py-0.5 text-xs font-medium">
          {v}
          <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="text-zinc-400 hover:text-zinc-900" aria-label={`Remover ${v}`}>
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !text && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={commit}
        placeholder={values.length ? "" : "Digite e tecle Enter"}
        className="min-w-24 flex-1 bg-transparent text-sm outline-none"
      />
    </div>
  );
}

export function ProductForm({ slug, brand, product, categories, templates }: { slug: string; brand: string; product?: Product; categories: string[]; templates: OptionTemplate[] }) {
  const router = useRouter();
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? categories[0] ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [images, setImages] = useState(product?.images ?? []);
  const [emoji, setEmoji] = useState(product?.image ?? "📦");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [promoOn, setPromoOn] = useState(!!product?.promo);
  const [promoPrice, setPromoPrice] = useState(product?.promo ? String(product.promo.price) : "");
  const [promoStart, setPromoStart] = useState(toLocal(product?.promo?.startsAt ?? null));
  const [promoEnd, setPromoEnd] = useState(toLocal(product?.promo?.endsAt ?? null));
  const [trackStock, setTrackStock] = useState(product?.trackStock ?? true);
  const [stock, setStock] = useState(String(product?.variants.length ? 0 : (product?.stock ?? 0)));
  const [threshold, setThreshold] = useState(String(product?.lowStockThreshold ?? 5));
  const [options, setOptions] = useState<ProductOption[]>(product?.options ?? []);
  const [variants, setVariants] = useState<VariantDraft[]>(product?.variants ?? []);
  const [active, setActive] = useState(product?.active ?? true);
  const [showcase, setShowcase] = useState<Showcase | null>(product?.showcase ?? null);
  const [specs, setSpecs] = useState<Spec[]>(product?.specs ?? []);
  const [bulkStock, setBulkStock] = useState("");
  const [loading, setLoading] = useState<"save" | "delete" | "duplicate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const back = `/${slug}/painel/produtos`;

  // Recalcula as combinações quando as opções mudam, preservando o que já foi preenchido.
  function applyOptions(next: ProductOption[]) {
    setOptions(next);
    const usable = next.filter((o) => o.name.trim() && o.values.length);
    if (!usable.length) return setVariants([]);
    setVariants((prev) =>
      combinations(usable).map((combo) => {
        const same = prev.find((v) => usable.every((o) => v.options[o.name] === combo[o.name]));
        const base = sku || skuPart(name) || "SKU";
        return same ? { ...same, options: combo } : { options: combo, sku: `${base}-${Object.values(combo).map(skuPart).join("-")}`, stock: 0, price: null };
      }),
    );
  }
  const setOption = (i: number, patch: Partial<ProductOption>) => applyOptions(options.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const setVariant = (i: number, patch: Partial<VariantDraft>) => setVariants((vs) => vs.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const unusedTemplates = templates.filter((t) => !options.some((o) => o.name.toLowerCase() === t.name.toLowerCase()));

  const totalStock = variants.length ? variants.reduce((s, v) => s + v.stock, 0) : Number(stock) || 0;
  const preview = useMemo(() => {
    const p = num(price);
    const pp = num(promoPrice);
    if (!(p > 0)) return null;
    return priceOf({ price: p, promo: promoOn && pp > 0 ? { price: pp, startsAt: fromLocal(promoStart), endsAt: fromLocal(promoEnd) } : null });
  }, [price, promoPrice, promoOn, promoStart, promoEnd]);
  const promoPct = num(price) > 0 && num(promoPrice) > 0 ? Math.round((1 - num(promoPrice) / num(price)) * 100) : null;

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const description = String(new FormData(e.currentTarget).get("description") ?? "");
    setError(null);
    if (!(num(price) > 0)) return setError("Informe o preço.");
    if (promoOn && !(num(promoPrice) > 0)) return setError("Informe o preço promocional.");
    setLoading("save");
    const body = {
      name,
      description,
      category,
      sku,
      price: num(price),
      promo: promoOn ? { price: num(promoPrice), startsAt: fromLocal(promoStart), endsAt: fromLocal(promoEnd) } : null,
      trackStock,
      stock: Number(stock) || 0,
      lowStockThreshold: Number(threshold) || 0,
      options: options.filter((o) => o.name.trim() && o.values.length),
      variants,
      image: emoji,
      images,
      showcase,
      specs: specs.filter((s) => s.label.trim() && s.value.trim()),
      active,
    };
    try {
      if (product) await api(`/api/stores/${slug}/products/${product.id}`, "PUT", body);
      else await api(`/api/stores/${slug}/products`, "POST", body);
      router.push(back);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(null);
    }
  }

  async function remove() {
    if (!product || !confirm(`Excluir "${product.name}" definitivamente? Esta ação não pode ser desfeita.`)) return;
    setLoading("delete");
    await api(`/api/stores/${slug}/products/${product.id}`, "DELETE");
    router.push(back);
    router.refresh();
  }

  async function duplicate() {
    if (!product) return;
    setLoading("duplicate");
    try {
      const copy = await api<Product>(`/api/stores/${slug}/products/${product.id}/duplicate`, "POST");
      router.push(`${back}/${copy.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(null);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader title="Informações" />
          <div className="space-y-4 p-5">
            <Field label="Nome do produto">
              <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Camiseta Básica Algodão" />
            </Field>
            <Field label="Descrição">
              <Textarea name="description" defaultValue={product?.description} placeholder="Materiais, medidas, modo de uso, diferenciais…" className="min-h-32" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Categoria">
                <Input required list="categories" value={category} onChange={(e) => setCategory(e.target.value)} />
                <datalist id="categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="SKU / código" hint="Opcional. Único na loja.">
                <Input value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} placeholder="CAM-001" />
              </Field>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Fotos" description="A primeira foto aparece na vitrine e nos pedidos" />
          <div className="space-y-4 p-5">
            <GalleryField slug={slug} value={images} onChange={setImages} />
            {images.length === 0 && (
              <div>
                <p className="text-xs font-medium text-zinc-700">Sem fotos? Escolha um ícone provisório</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {EMOJIS.map((em) => (
                    <button type="button" key={em} onClick={() => setEmoji(em)} className={cn("rounded-lg p-1.5 text-xl transition hover:bg-zinc-100", em === emoji && "bg-zinc-100 ring-2 ring-zinc-900")}>
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Rotate3d className="size-4 text-zinc-400" /> Showroom 360°</span>} description="Experiência imersiva na página do produto" />
          <div className="p-5">
            <ShowcaseField slug={slug} value={showcase} onChange={setShowcase} preview={{ name, brand, specs: specs.filter((s) => s.label.trim() && s.value.trim()) }} />
          </div>
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><ListChecks className="size-4 text-zinc-400" /> Ficha técnica</span>} description="Aparece no showroom e na aba Detalhes" />
          <div className="p-5">
            <SpecsField value={specs} onChange={setSpecs} />
          </div>
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Tag className="size-4 text-zinc-400" /> Preço e promoção</span>} />
          <div className="space-y-4 p-5">
            <Field label="Preço (R$)" className="max-w-48">
              <Input required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" />
            </Field>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={promoOn} onChange={(e) => setPromoOn(e.target.checked)} className="size-4 accent-zinc-900" />
              Colocar em promoção
            </label>
            {promoOn && (
              <div className="grid gap-4 rounded-xl bg-zinc-50 p-4 sm:grid-cols-3">
                <Field label="Preço promocional (R$)" hint={promoPct !== null ? (promoPct > 0 ? `${promoPct}% de desconto` : "Deve ser menor que o preço") : undefined}>
                  <Input inputMode="decimal" value={promoPrice} onChange={(e) => setPromoPrice(e.target.value)} />
                </Field>
                <Field label="Começa em" hint="Vazio = agora">
                  <Input type="datetime-local" value={promoStart} onChange={(e) => setPromoStart(e.target.value)} />
                </Field>
                <Field label="Termina em" hint="Vazio = sem prazo">
                  <Input type="datetime-local" value={promoEnd} onChange={(e) => setPromoEnd(e.target.value)} />
                </Field>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title={<span className="flex items-center gap-2"><Layers className="size-4 text-zinc-400" /> Estoque e variações</span>}
            description="Tamanhos, cores, pesos, voltagens… cada combinação tem seu próprio estoque"
          />
          <div className="space-y-5 p-5">
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={trackStock} onChange={(e) => setTrackStock(e.target.checked)} className="size-4 accent-zinc-900" />
                Controlar estoque
              </label>
              {!trackStock && <span className="text-xs text-zinc-500">Vendas ilimitadas, para produtos sob encomenda, serviços ou digitais.</span>}
            </div>
            {trackStock && (
              <div className="grid gap-4 sm:grid-cols-3">
                {!variants.length && (
                  <Field label="Quantidade em estoque">
                    <Input type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
                  </Field>
                )}
                <Field label="Alerta de estoque baixo" hint="Avisar quando chegar a">
                  <Input type="number" min={0} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
                </Field>
              </div>
            )}

            <div className="space-y-3">
              {options.map((o, i) => (
                <div key={i} className="grid items-start gap-2 rounded-xl border border-zinc-200 p-3 sm:grid-cols-[180px_1fr_auto]">
                  <Input value={o.name} onChange={(e) => setOption(i, { name: e.target.value })} placeholder="Ex.: Tamanho" aria-label="Nome da variação" />
                  <ValuesInput values={o.values} onChange={(values) => setOption(i, { values })} />
                  <Button type="button" variant="ghost" className="px-2" onClick={() => applyOptions(options.filter((_, j) => j !== i))} aria-label="Remover variação">
                    <Trash2 className="size-4 text-zinc-400" />
                  </Button>
                </div>
              ))}
              {options.length < 3 && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" className="text-xs" onClick={() => setOptions([...options, { name: "", values: [] }])}>
                    <Plus className="size-3.5" /> Adicionar variação
                  </Button>
                  {unusedTemplates.length > 0 && (
                    <span className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                      <Sparkles className="size-3.5 text-violet-500" /> Sugestões para {category || "sua loja"}:
                      {unusedTemplates.map((t) => (
                        <button key={t.name} type="button" onClick={() => applyOptions([...options, { name: t.name, values: [...t.values] }])} className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 font-medium text-zinc-700 hover:border-zinc-300">
                          + {t.name}
                        </button>
                      ))}
                    </span>
                  )}
                </div>
              )}
            </div>

            {variants.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-zinc-200">
                <div className="flex flex-wrap items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-xs">
                  <span className="font-medium">{variants.length} combinações</span>
                  <span className="text-zinc-400">· {totalStock} un. no total</span>
                  {trackStock && (
                    <span className="ml-auto flex items-center gap-1.5">
                      <Input type="number" min={0} value={bulkStock} onChange={(e) => setBulkStock(e.target.value)} placeholder="Qtd." className="h-7 w-20 py-1 text-xs" />
                      <Button type="button" variant="outline" className="h-7 px-2 py-0 text-xs" disabled={bulkStock === ""} onClick={() => setVariants((vs) => vs.map((v) => ({ ...v, stock: Number(bulkStock) || 0 })))}>
                        <Copy className="size-3" /> Aplicar a todas
                      </Button>
                    </span>
                  )}
                </div>
                <div className="max-h-96 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white text-xs text-zinc-500">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Variação</th>
                        <th className="px-3 py-2 text-left font-medium">SKU</th>
                        <th className="px-3 py-2 text-left font-medium">Preço próprio</th>
                        {trackStock && <th className="px-3 py-2 text-left font-medium">Estoque</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((v, i) => (
                        <tr key={variantLabel(v)} className="border-t border-zinc-100">
                          <td className="px-3 py-1.5 font-medium">{variantLabel(v)}</td>
                          <td className="px-3 py-1.5">
                            <Input value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value.toUpperCase() })} className="h-8 py-1 font-mono text-xs" />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input
                              inputMode="decimal"
                              value={v.price ?? ""}
                              onChange={(e) => setVariant(i, { price: e.target.value === "" ? null : num(e.target.value) || null })}
                              placeholder={price || "—"}
                              className="h-8 w-28 py-1 text-xs"
                            />
                          </td>
                          {trackStock && (
                            <td className="px-3 py-1.5">
                              <Input type="number" min={0} value={v.stock} onChange={(e) => setVariant(i, { stock: Math.max(0, Number(e.target.value) || 0) })} className={cn("h-8 w-24 py-1 text-xs", v.stock === 0 && "border-red-200 bg-red-50")} />
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="lg:sticky lg:top-6">
          <CardHeader title="Prévia na vitrine" />
          <div className="p-5">
            <Thumb url={images[0]} emoji={emoji} alt={name} className="aspect-square w-full rounded-2xl" emojiClassName="text-7xl" />
            <p className="mt-3 text-xs text-zinc-500">{category || "Categoria"}</p>
            <p className="text-sm font-medium">{name || "Nome do produto"}</p>
            {preview && (
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-semibold">
                  {variants.some((v) => v.price !== null) && "a partir de "}
                  {money(preview.price)}
                </span>
                {preview.onSale && <span className="text-sm text-zinc-400 line-through">{money(preview.regular)}</span>}
                {preview.onSale && <Badge tone="red">-{preview.discountPct}%</Badge>}
              </div>
            )}
            {promoOn && preview && !preview.onSale && num(promoPrice) > 0 && num(promoPrice) < num(price) && <p className="mt-1 text-xs text-sky-600">Promoção agendada para {promoStart.replace("T", " ")}</p>}
            <p className="mt-2 text-xs text-zinc-500">{trackStock ? `${totalStock} em estoque` : "Estoque ilimitado"}</p>

            <label className="mt-5 flex items-center justify-between border-t border-zinc-100 pt-4 text-sm">
              <span>
                <span className="font-medium">Visível na loja</span>
                <span className="block text-xs text-zinc-500">Desative para esconder dos clientes</span>
              </span>
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-5 accent-zinc-900" />
            </label>

            {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <Button type="submit" className="mt-4 w-full" disabled={!!loading}>
              {loading === "save" && <Loader2 className="size-4 animate-spin" />} {product ? "Salvar alterações" : "Criar produto"}
            </Button>
            {product && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" className="text-xs" disabled={!!loading} onClick={duplicate}>
                  {loading === "duplicate" ? <Loader2 className="size-3.5 animate-spin" /> : <Copy className="size-3.5" />} Duplicar
                </Button>
                <Button type="button" variant="outline" className="text-xs text-red-600" disabled={!!loading} onClick={remove}>
                  {loading === "delete" ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} Excluir
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </form>
  );
}
