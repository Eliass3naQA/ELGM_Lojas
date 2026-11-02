// Camada de acesso a dados (Supabase / Postgres).
// Toda a aplicação (páginas e API) fala SOMENTE com estas funções.
// Operações que precisam ser atômicas (checkout, cancelamento, ajuste de estoque)
// são funções SQL em supabase/schema.sql, chamadas via rpc().

import "server-only";
import { randomUUID } from "node:crypto";
import type { PostgrestError } from "@supabase/supabase-js";
import { IMAGE_TYPES, MAX_UPLOAD_BYTES, sniffType } from "../files";
import { availableStock, priceOf, variantLabel } from "../pricing";
import type {
  Address,
  AuditLog,
  AuthProvider,
  Coupon,
  Customer,
  Order,
  OrderStatus,
  Payment,
  PaymentMethod,
  Plan,
  PlanId,
  Product,
  ProductOption,
  StockMovement,
  StockReason,
  Store,
  StoreStatus,
  User,
  Variant,
} from "../types";
import { orderStatusLabel } from "../format";
import { MEDIA_BUCKET, RECEIPTS_BUCKET, supabase as sb } from "./supabase";

const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const DAY = 86_400_000;

export const round = (v: number) => Math.round(v * 100) / 100;

export class DomainError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const RESERVED_SLUGS = ["backoffice", "api", "admin", "login", "cadastro", "_next", "static"];

/* ------------------------------------------------------------------ Infra */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Ids vindos da URL: um valor que não é uuid simplesmente não existe (evita erro 500 no Postgres). */
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

function fail(error: PostgrestError): never {
  // raise exception das funções SQL: mensagem para o usuário; hint = status HTTP
  if (error.code === "P0001") throw new DomainError(error.message, Number(error.hint) || 400);
  if (error.code === "22P02") throw new DomainError("Registro não encontrado.", 404);
  if (error.code === "23505") throw new DomainError("Já existe um registro com estes dados.", 409);
  throw new Error(`Supabase: ${error.message} (${error.code})`);
}

/** Executa uma query e devolve `data`, convertendo erros do banco. */
async function run<T = Row>(query: PromiseLike<{ data: unknown; error: PostgrestError | null }>): Promise<T> {
  const { data, error } = await query;
  if (error) fail(error);
  return data as T;
}

const iso = (v: string | null | undefined) => (v ? new Date(v).toISOString() : null);
const snake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
const camel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/** camelCase → snake_case (só o primeiro nível: jsonb como items/address/options fica intacto). */
function toRow(obj: object): Row {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined).map(([k, v]) => [snake(k), v]));
}

/** snake_case → camelCase, com datas normalizadas em ISO (mesmo formato de antes). */
function fromRow<T>(row: Row): T {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => {
      const key = camel(k);
      return [key, (key.endsWith("At") || key === "termsVersion") && typeof v === "string" ? iso(v) : v];
    }),
  ) as T;
}

const PRODUCT_SELECT = "*, product_variants(*)";

function toProduct(r: Row): Product {
  const variants = [...((r.product_variants as Row[]) ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((v): Variant => ({ id: v.id, options: v.options, sku: v.sku, stock: v.stock, price: v.price }));
  return {
    id: r.id,
    storeId: r.store_id,
    name: r.name,
    description: r.description,
    price: r.price,
    promo: r.promo_price != null ? { price: r.promo_price, startsAt: iso(r.promo_starts_at), endsAt: iso(r.promo_ends_at) } : null,
    sku: r.sku,
    trackStock: r.track_stock,
    stock: r.stock,
    lowStockThreshold: r.low_stock_threshold,
    options: r.options,
    variants,
    category: r.category,
    image: r.image,
    images: r.images,
    showcase: r.showcase ?? null,
    specs: r.specs ?? [],
    active: r.active,
    createdAt: iso(r.created_at)!,
  };
}

function toPayment(r: Row): Payment {
  const { receiptPath, receiptName, receiptMime, receiptSize, ...rest } = fromRow<Row>(r);
  return {
    ...(rest as Omit<Payment, "receipt">),
    receipt: receiptPath ? { fileId: receiptPath, fileName: receiptName, mimeType: receiptMime, size: receiptSize, uploadedAt: rest.submittedAt } : null,
  };
}

const toStore = (r: Row) => fromRow<Store>(r);
const toOrder = (r: Row) => fromRow<Order>(r);
const toCustomer = (r: Row) => fromRow<Customer>(r);
const toCoupon = (r: Row) => fromRow<Coupon>(r);

/* ------------------------------------------------------------------ Planos */

export async function listPlans() {
  return (await run<Row[]>(sb().from("plans").select("*").order("price_monthly"))).map((r) => fromRow<Plan>(r));
}

export async function getPlan(id: PlanId) {
  return fromRow<Plan>(await run(sb().from("plans").select("*").eq("id", id).single()));
}

/* ------------------------------------------------------------------ Lojas */

export async function listStores() {
  return (await run<Row[]>(sb().from("stores").select("*").order("created_at", { ascending: false }))).map(toStore);
}

export async function getStoreBySlug(slug: string) {
  const row = await run<Row | null>(sb().from("stores").select("*").eq("slug", slug).maybeSingle());
  return row ? toStore(row) : null;
}

export async function createStore(input: Pick<Store, "slug" | "name" | "tagline" | "category" | "logo" | "brandColor" | "ownerName" | "ownerEmail" | "planId">) {
  if (RESERVED_SLUGS.includes(input.slug)) throw new DomainError("Este endereço é reservado.");
  if (await getStoreBySlug(input.slug)) throw new DomainError("Já existe uma loja com este endereço.", 409);
  const now = new Date().toISOString();
  const row = await run(
    sb()
      .from("stores")
      .insert(toRow({ ...input, status: "trial", shippingFlat: 19.9, freeShippingOver: null, about: "", pixKey: input.ownerEmail, customTerms: null, termsUpdatedAt: now, createdAt: now }))
      .select()
      .single(),
  );
  await log("admin", "Loja criada", input.slug);
  return toStore(row);
}

export async function updateStore(slug: string, patch: Partial<Omit<Store, "id" | "createdAt">>, actor = "lojista") {
  const store = await requireStore(slug);
  if (patch.slug === store.slug) delete patch.slug;
  if (patch.slug) {
    if (RESERVED_SLUGS.includes(patch.slug)) throw new DomainError("Este endereço é reservado.");
    if (await getStoreBySlug(patch.slug)) throw new DomainError("Já existe uma loja com este endereço.", 409);
  }
  const row = toRow(patch);
  // nova versão dos termos: clientes precisarão aceitar de novo na próxima compra
  if (patch.customTerms !== undefined && patch.customTerms !== store.customTerms) row.terms_updated_at = new Date().toISOString();
  if (!Object.keys(row).length) return store;
  const updated = toStore(await run(sb().from("stores").update(row).eq("id", store.id).select().single()));
  const target = updated.slug;
  if (patch.slug) {
    // mantém o histórico da auditoria ligado à loja
    await run(sb().from("audit_logs").update({ target }).eq("target", slug));
    await log(actor, `Endereço alterado de /${slug} para /${target}`, target);
  }
  if (patch.status) await log(actor, `Status alterado para ${patch.status}`, target);
  if (patch.planId) await log(actor, `Plano alterado para ${patch.planId}`, target);
  const labels: Partial<Record<keyof typeof patch, string>> = { name: "nome", tagline: "slogan", category: "categoria", logo: "logo", brandColor: "cor", ownerName: "responsável", ownerEmail: "e-mail", whatsapp: "WhatsApp" };
  const changed = (Object.keys(labels) as (keyof typeof patch)[]).filter((k) => patch[k] !== undefined && patch[k] !== store[k]).map((k) => labels[k]);
  if (actor === "admin" && changed.length) await log(actor, `Dados alterados: ${changed.join(", ")}`, target);
  return updated;
}

/** Remove todos os arquivos de uma pasta do Storage (inclusive subpastas). */
async function removeFolder(bucket: string, prefix: string) {
  for (;;) {
    const { data, error } = await sb().storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) throw new Error(`Storage: ${error.message}`);
    if (!data.length) return;
    const files = data.filter((f) => f.id).map((f) => `${prefix}/${f.name}`);
    for (const dir of data.filter((f) => !f.id)) await removeFolder(bucket, `${prefix}/${dir.name}`);
    if (files.length) await sb().storage.from(bucket).remove(files);
    if (data.length < 1000) return;
  }
}

/** Exclui a loja e tudo dela: produtos, estoque, cupons, clientes, pedidos, pagamentos, fotos e comprovantes. */
export async function deleteStore(slug: string, actor = "admin") {
  const store = await requireStore(slug);
  await removeFolder(MEDIA_BUCKET, store.id);
  await removeFolder(RECEIPTS_BUCKET, store.id);
  await run(sb().from("stores").delete().eq("id", store.id)); // o resto sai em cascata
  await log(actor, `Loja excluída: ${store.name} (${store.ownerName})`, store.slug);
}

async function requireStore(slug: string) {
  const store = await getStoreBySlug(slug);
  if (!store) throw new DomainError("Loja não encontrada.", 404);
  return store;
}

/* ------------------------------------------------------------------ Produtos */

export async function listProducts(storeId: string, opts: { includeInactive?: boolean; q?: string; category?: string } = {}) {
  let query = sb().from("products").select(PRODUCT_SELECT).eq("store_id", storeId);
  if (!opts.includeInactive) query = query.eq("active", true);
  if (opts.category) query = query.eq("category", opts.category);
  const products = (await run<Row[]>(query.order("created_at"))).map(toProduct);
  const q = opts.q?.toLowerCase().trim();
  if (!q) return products;
  return products.filter(
    (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.variants.some((v) => v.sku.toLowerCase().includes(q)),
  );
}

export async function getProduct(storeId: string, id: string) {
  if (!isUuid(id)) return null;
  const row = await run<Row | null>(sb().from("products").select(PRODUCT_SELECT).eq("store_id", storeId).eq("id", id).maybeSingle());
  return row ? toProduct(row) : null;
}

export interface ProductInput {
  name: string;
  description: string;
  category: string;
  price: number;
  promo: Product["promo"];
  sku: string;
  trackStock: boolean;
  stock: number; // usado só quando não há variações
  lowStockThreshold: number;
  options: ProductOption[];
  variants: (Omit<Variant, "id"> & { id?: string })[];
  image: string;
  images: string[];
  showcase: Product["showcase"];
  specs: Product["specs"];
  active: boolean;
}

const sameCombo = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);

/** Regras de consistência do catálogo (o schema Zod já validou formatos). */
async function checkProduct(storeId: string, input: ProductInput, selfId?: string) {
  if (input.promo) {
    if (input.promo.price >= input.price) throw new DomainError("O preço promocional deve ser menor que o preço normal.");
    if (input.promo.startsAt && input.promo.endsAt && input.promo.endsAt <= input.promo.startsAt) throw new DomainError("O fim da promoção deve ser depois do início.");
  }
  const names = input.options.map((o) => o.name.toLowerCase());
  if (new Set(names).size !== names.length) throw new DomainError("Há variações com o mesmo nome.");
  for (const o of input.options) if (new Set(o.values).size !== o.values.length) throw new DomainError(`Valores repetidos em "${o.name}".`);
  if (input.options.length && !input.variants.length) throw new DomainError("Gere ao menos uma combinação de variação.");
  for (const v of input.variants) {
    const keys = Object.keys(v.options);
    const valid = keys.length === input.options.length && input.options.every((o) => o.values.includes(v.options[o.name]));
    if (!valid) throw new DomainError("Uma das combinações não corresponde às opções do produto.");
  }
  input.variants.forEach((v, i) => {
    if (input.variants.findIndex((w) => sameCombo(w.options, v.options)) !== i) throw new DomainError(`Combinação repetida: ${variantLabel(v)}.`);
  });
  // SKU único na loja (produtos e variações)
  const own = [input.sku, ...input.variants.map((v) => v.sku)].filter(Boolean);
  if (new Set(own).size !== own.length) throw new DomainError("Há SKUs repetidos neste produto.");
  const others = await run<Row[]>(sb().from("products").select("id, sku, product_variants(sku)").eq("store_id", storeId));
  const taken = new Set(others.filter((p) => p.id !== selfId).flatMap((p) => [p.sku as string, ...(p.product_variants as Row[]).map((v) => v.sku as string)]).filter(Boolean));
  for (const sku of own) if (taken.has(sku)) throw new DomainError(`O SKU ${sku} já está em uso em outro produto.`);
}

function productRow(input: ProductInput, stock: number) {
  return {
    name: input.name,
    description: input.description,
    category: input.category,
    price: input.price,
    promo_price: input.promo?.price ?? null,
    promo_starts_at: input.promo?.startsAt ?? null,
    promo_ends_at: input.promo?.endsAt ?? null,
    sku: input.sku,
    track_stock: input.trackStock,
    stock,
    low_stock_threshold: input.lowStockThreshold,
    options: input.options,
    image: input.image,
    images: input.images,
    showcase: input.showcase,
    specs: input.specs,
    active: input.active,
  };
}

const variantRows = (storeId: string, productId: string, variants: Variant[]) =>
  variants.map((v, position) => ({ id: v.id, product_id: productId, store_id: storeId, options: v.options, sku: v.sku, stock: v.stock, price: v.price, position }));

async function recordMovements(movements: Omit<StockMovement, "id" | "at">[]) {
  const rows = movements.filter((m) => m.delta !== 0).map((m) => toRow(m));
  if (rows.length) await run(sb().from("stock_movements").insert(rows));
}

export async function createProduct(storeSlug: string, input: ProductInput, actor = "lojista") {
  const store = await requireStore(storeSlug);
  const plan = await getPlan(store.planId);
  const { count, error } = await sb().from("products").select("id", { count: "exact", head: true }).eq("store_id", store.id);
  if (error) fail(error);
  if (plan.maxProducts !== null && (count ?? 0) >= plan.maxProducts) {
    throw new DomainError(`Seu plano ${plan.name} permite até ${plan.maxProducts} produtos.`, 403);
  }
  await checkProduct(store.id, input);
  const variants: Variant[] = input.variants.map((v) => ({ ...v, id: randomUUID() }));
  const stock = variants.length ? variants.reduce((s, v) => s + v.stock, 0) : input.stock;
  const { id } = await run(sb().from("products").insert({ ...productRow(input, stock), store_id: store.id }).select("id").single());
  if (variants.length) {
    try {
      await run(sb().from("product_variants").insert(variantRows(store.id, id, variants)));
    } catch (e) {
      await sb().from("products").delete().eq("id", id); // não deixa produto pela metade
      throw e;
    }
  }
  const entries = variants.length ? variants.map((v) => [v.id, v.stock] as const) : ([[null, stock]] as const);
  await recordMovements(entries.map(([variantId, qty]) => ({ storeId: store.id, productId: id, variantId, delta: qty, balanceAfter: qty, reason: "initial", note: "Cadastro do produto", actor })));
  return (await getProduct(store.id, id))!;
}

export async function updateProduct(storeSlug: string, id: string, input: ProductInput, actor = "lojista") {
  const store = await requireStore(storeSlug);
  const product = await getProduct(store.id, id);
  if (!product) throw new DomainError("Produto não encontrado.", 404);
  await checkProduct(store.id, input, product.id);

  // preserva ids das variações existentes (pelo id ou pela combinação) para manter o histórico de estoque
  const variants: Variant[] = input.variants.map((v) => {
    const prev = product.variants.find((p) => p.id === v.id) ?? product.variants.find((p) => sameCombo(p.options, v.options));
    return { ...v, id: prev?.id ?? randomUUID() };
  });
  // registra no histórico as mudanças de estoque feitas pelo formulário
  const movements: Omit<StockMovement, "id" | "at">[] = [];
  if (variants.length) {
    for (const v of variants) {
      const before = product.variants.find((p) => p.id === v.id)?.stock ?? 0;
      movements.push({ storeId: store.id, productId: product.id, variantId: v.id, delta: v.stock - before, balanceAfter: v.stock, reason: "adjustment", note: "Editado no cadastro do produto", actor });
    }
  } else if (!product.variants.length) {
    movements.push({ storeId: store.id, productId: product.id, variantId: null, delta: input.stock - product.stock, balanceAfter: input.stock, reason: "adjustment", note: "Editado no cadastro do produto", actor });
  }

  const keep = variants.map((v) => v.id);
  let removed = sb().from("product_variants").delete().eq("product_id", product.id);
  if (keep.length) removed = removed.not("id", "in", `(${keep.join(",")})`);
  await run(removed);
  if (variants.length) await run(sb().from("product_variants").upsert(variantRows(store.id, product.id, variants)));
  const stock = variants.length ? variants.reduce((s, v) => s + v.stock, 0) : input.stock;
  await run(sb().from("products").update(productRow(input, stock)).eq("id", product.id));
  await recordMovements(movements);
  return (await getProduct(store.id, product.id))!;
}

/** Alterações rápidas (ex.: ativar/ocultar na lista) sem passar pelo formulário inteiro. */
export async function patchProduct(storeSlug: string, id: string, patch: Partial<Pick<Product, "active" | "promo" | "price">>) {
  const store = await requireStore(storeSlug);
  const product = await getProduct(store.id, id);
  if (!product) throw new DomainError("Produto não encontrado.", 404);
  const next = { ...product, ...patch };
  if (next.promo && next.promo.price >= next.price) throw new DomainError("O preço promocional deve ser menor que o preço normal.");
  const row: Row = {};
  if (patch.active !== undefined) row.active = patch.active;
  if (patch.price !== undefined) row.price = patch.price;
  if (patch.promo !== undefined) Object.assign(row, { promo_price: patch.promo?.price ?? null, promo_starts_at: patch.promo?.startsAt ?? null, promo_ends_at: patch.promo?.endsAt ?? null });
  if (Object.keys(row).length) await run(sb().from("products").update(row).eq("id", product.id));
  return next;
}

export async function duplicateProduct(storeSlug: string, id: string, actor = "lojista") {
  const store = await requireStore(storeSlug);
  const src = await getProduct(store.id, id);
  if (!src) throw new DomainError("Produto não encontrado.", 404);
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return createProduct(
    storeSlug,
    {
      ...src,
      name: `${src.name} (cópia)`,
      sku: src.sku ? `${src.sku}-${suffix}` : "",
      // a cópia começa sem estoque e oculta, para o lojista revisar antes de publicar
      stock: 0,
      variants: src.variants.map((v) => ({ options: v.options, price: v.price, sku: v.sku ? `${v.sku}-${suffix}` : "", stock: 0 })),
      images: [...src.images],
      options: src.options.map((o) => ({ ...o, values: [...o.values] })),
      active: false,
    },
    actor,
  );
}

export async function deleteProduct(storeSlug: string, id: string) {
  const store = await requireStore(storeSlug);
  if (!isUuid(id)) throw new DomainError("Produto não encontrado.", 404);
  const rows = await run<Row[]>(sb().from("products").delete().eq("store_id", store.id).eq("id", id).select("id"));
  if (!rows.length) throw new DomainError("Produto não encontrado.", 404);
}

export async function bulkProducts(storeSlug: string, ids: string[], action: "activate" | "deactivate" | "delete") {
  const store = await requireStore(storeSlug);
  const valid = ids.filter(isUuid);
  if (valid.length) {
    const scope = sb().from("products");
    if (action === "delete") await run(scope.delete().eq("store_id", store.id).in("id", valid));
    else await run(scope.update({ active: action === "activate" }).eq("store_id", store.id).in("id", valid));
  }
  return { count: ids.length };
}

/* ------------------------------------------------------------------ Estoque */

export interface StockAdjustInput {
  productId: string;
  variantId: string | null;
  mode: "add" | "remove" | "set";
  qty: number;
  reason: Extract<StockReason, "restock" | "adjustment" | "loss" | "return">;
  note: string;
}

export async function adjustStock(storeSlug: string, input: StockAdjustInput, actor = "lojista") {
  const store = await requireStore(storeSlug);
  const product = await getProduct(store.id, input.productId);
  if (!product) throw new DomainError("Produto não encontrado.", 404);
  const variant = input.variantId ? product.variants.find((v) => v.id === input.variantId) : null;
  if (input.variantId && !variant) throw new DomainError("Variação não encontrada.", 404);
  if (!input.variantId && product.variants.length) throw new DomainError("Escolha a variação a ajustar.");

  // a função SQL trava a linha, valida o saldo e grava a movimentação na mesma transação
  await run(
    sb().rpc("adjust_stock", {
      p_store_id: store.id,
      p_product_id: product.id,
      p_variant_id: variant?.id ?? null,
      p_mode: input.mode,
      p_qty: input.qty,
      p_reason: input.reason,
      p_note: input.note,
      p_actor: actor,
    }),
  );
  return (await getProduct(store.id, product.id))!;
}

export async function listStockMovements(storeId: string, opts: { productId?: string; limit?: number } = {}) {
  let query = sb().from("stock_movements").select("*").eq("store_id", storeId);
  if (opts.productId) {
    if (!isUuid(opts.productId)) return [];
    query = query.eq("product_id", opts.productId);
  }
  return (await run<Row[]>(query.order("at", { ascending: false }).limit(opts.limit ?? 200))).map((r) => fromRow<StockMovement>(r));
}

/* ------------------------------------------------------------------ Cupons */

export async function listCoupons(storeId: string) {
  return (await run<Row[]>(sb().from("coupons").select("*").eq("store_id", storeId).order("created_at", { ascending: false }))).map(toCoupon);
}

export type CouponInput = Pick<Coupon, "code" | "type" | "value" | "minSubtotal" | "startsAt" | "endsAt" | "maxUses" | "active">;

async function checkCoupon(storeId: string, input: CouponInput, selfId?: string) {
  let dup = sb().from("coupons").select("id").eq("store_id", storeId).eq("code", input.code);
  if (selfId) dup = dup.neq("id", selfId);
  if ((await run<Row[]>(dup)).length) throw new DomainError(`Já existe um cupom ${input.code}.`, 409);
  if (input.type === "percent" && (input.value <= 0 || input.value > 90)) throw new DomainError("O desconto percentual deve ser entre 1% e 90%.");
  if (input.type === "fixed" && input.value <= 0) throw new DomainError("Informe o valor do desconto.");
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) throw new DomainError("A validade final deve ser depois do início.");
}

export async function createCoupon(storeSlug: string, input: CouponInput) {
  const store = await requireStore(storeSlug);
  await checkCoupon(store.id, input);
  return toCoupon(await run(sb().from("coupons").insert(toRow({ ...input, storeId: store.id, uses: 0 })).select().single()));
}

async function findCoupon(storeId: string, id: string) {
  if (!isUuid(id)) return null;
  const row = await run<Row | null>(sb().from("coupons").select("*").eq("store_id", storeId).eq("id", id).maybeSingle());
  return row ? toCoupon(row) : null;
}

export async function updateCoupon(storeSlug: string, id: string, patch: Partial<CouponInput>) {
  const store = await requireStore(storeSlug);
  const coupon = await findCoupon(store.id, id);
  if (!coupon) throw new DomainError("Cupom não encontrado.", 404);
  await checkCoupon(store.id, { ...coupon, ...patch }, coupon.id);
  return toCoupon(await run(sb().from("coupons").update(toRow(patch)).eq("id", coupon.id).select().single()));
}

export async function deleteCoupon(storeSlug: string, id: string) {
  const store = await requireStore(storeSlug);
  if (isUuid(id)) await run(sb().from("coupons").delete().eq("store_id", store.id).eq("id", id));
}

export type CouponStatus = "active" | "scheduled" | "expired" | "exhausted" | "disabled";

export function couponStatus(c: Coupon, now = Date.now()): CouponStatus {
  if (!c.active) return "disabled";
  if (c.maxUses !== null && c.uses >= c.maxUses) return "exhausted";
  if (c.endsAt && new Date(c.endsAt).getTime() <= now) return "expired";
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return "scheduled";
  return "active";
}

/** Calcula o efeito do cupom sobre um carrinho. Lança erro com a mensagem para o cliente. */
export async function evaluateCoupon(store: Store, rawCode: string, subtotal: number, shipping: number) {
  const code = rawCode.trim().toUpperCase();
  const row = await run<Row | null>(sb().from("coupons").select("*").eq("store_id", store.id).eq("code", code).maybeSingle());
  const coupon = row && toCoupon(row);
  const status = coupon && couponStatus(coupon);
  if (!coupon || status === "disabled") throw new DomainError("Cupom inválido.");
  if (status === "expired") throw new DomainError("Este cupom expirou.");
  if (status === "scheduled") throw new DomainError("Este cupom ainda não está valendo.");
  if (status === "exhausted") throw new DomainError("Este cupom atingiu o limite de usos.");
  if (subtotal < coupon.minSubtotal) throw new DomainError(`Cupom válido para compras a partir de ${coupon.minSubtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`);
  const discount = coupon.type === "percent" ? round((subtotal * coupon.value) / 100) : coupon.type === "fixed" ? Math.min(coupon.value, subtotal) : 0;
  return { coupon, discount, shipping: coupon.type === "free_shipping" ? 0 : shipping };
}

/* ------------------------------------------------------------------ Mídia (fotos públicas) */

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf", "image/svg+xml": "svg" };

/** Prefixo das URLs públicas do bucket "media" (usado também na validação). */
export const mediaUrlPrefix = () => `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${MEDIA_BUCKET}/`;

export async function saveImage(storeSlug: string, file: { name: string; data: Buffer }) {
  const store = await requireStore(storeSlug);
  if (file.data.length === 0) throw new DomainError("Arquivo vazio.");
  if (file.data.length > MAX_UPLOAD_BYTES) throw new DomainError("A imagem deve ter no máximo 5 MB.", 413);
  const mimeType = sniffType(file.data);
  if (!mimeType || !IMAGE_TYPES.includes(mimeType)) throw new DomainError("Envie uma imagem JPG, PNG ou WEBP.", 415);
  const id = uid("img");
  const path = `${store.id}/${id}.${EXT[mimeType]}`;
  const { error } = await sb().storage.from(MEDIA_BUCKET).upload(path, file.data, { contentType: mimeType, cacheControl: "31536000" });
  if (error) throw new Error(`Storage: ${error.message}`);
  return { id, url: sb().storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl };
}

/* ------------------------------------------------------------------ Usuários (login social) */

export async function getUser(id: string) {
  if (!isUuid(id)) return null; // ex.: cookie antigo da versão em memória
  const row = await run<Row | null>(sb().from("users").select("*").eq("id", id).maybeSingle());
  return row ? fromRow<User>(row) : null;
}

export async function upsertUser(input: { email: string; name: string; provider: AuthProvider }) {
  const email = input.email.trim().toLowerCase();
  // ignoreDuplicates: quem já existe mantém nome e provedor originais
  await run(sb().from("users").upsert({ email, name: input.name.trim(), provider: input.provider }, { onConflict: "email", ignoreDuplicates: true }));
  return fromRow<User>(await run(sb().from("users").select("*").eq("email", email).single()));
}

/* ------------------------------------------------------------------ Clientes */

/** Perfil do usuário nesta loja. Vincula automaticamente um cliente antigo com o mesmo e-mail. */
export async function getCustomerForUser(storeId: string, user: User) {
  const byUser = await run<Row | null>(sb().from("customers").select("*").eq("store_id", storeId).eq("user_id", user.id).limit(1).maybeSingle());
  if (byUser) return toCustomer(byUser);
  const byEmail = await run<Row | null>(sb().from("customers").select("*").eq("store_id", storeId).eq("email", user.email).maybeSingle());
  if (!byEmail) return null;
  if (!byEmail.user_id) return toCustomer(await run(sb().from("customers").update({ user_id: user.id, provider: user.provider }).eq("id", byEmail.id).select().single()));
  return toCustomer(byEmail);
}

export function isProfileComplete(customer: Customer | null, store: Store) {
  return !!customer?.cpf && !!customer.address && !!customer.phone && customer.termsVersion === store.termsUpdatedAt;
}

export interface ProfileInput {
  name: string;
  cpf: string;
  phone: string;
  birthDate: string | null;
  address: Address;
  acceptTerms: true;
  marketingOptIn: boolean;
}

export async function saveCustomerProfile(storeSlug: string, user: User, input: ProfileInput) {
  const store = await requireStore(storeSlug);
  const fields = toRow({
    name: input.name,
    cpf: input.cpf,
    phone: input.phone,
    birthDate: input.birthDate,
    address: input.address,
    city: `${input.address.city}, ${input.address.state}`,
    marketingOptIn: input.marketingOptIn,
    termsVersion: store.termsUpdatedAt,
    acceptedTermsAt: new Date().toISOString(),
  });
  const customer = await getCustomerForUser(store.id, user);
  const saved = customer
    ? await run(sb().from("customers").update(fields).eq("id", customer.id).select().single())
    : await run(sb().from("customers").insert({ ...fields, store_id: store.id, user_id: user.id, provider: user.provider, email: user.email }).select().single());
  return toCustomer(saved);
}

export interface CustomerWithStats extends Customer {
  orders: number;
  spent: number;
  lastOrderAt: string | null;
}

export async function listCustomers(storeId: string): Promise<CustomerWithStats[]> {
  const [customers, orders] = await Promise.all([
    run<Row[]>(sb().from("customers").select("*").eq("store_id", storeId)),
    run<Row[]>(sb().from("orders").select("customer_id, total, created_at").eq("store_id", storeId).neq("status", "cancelled")),
  ]);
  return customers
    .map(toCustomer)
    .map((c) => {
      const mine = orders.filter((o) => o.customer_id === c.id);
      return {
        ...c,
        orders: mine.length,
        spent: round(mine.reduce((s, o) => s + o.total, 0)),
        lastOrderAt: iso(mine.map((o) => iso(o.created_at)!).sort().at(-1)),
      };
    })
    .sort((a, b) => b.spent - a.spent);
}

export async function getCustomer(id: string) {
  if (!isUuid(id)) return null;
  const row = await run<Row | null>(sb().from("customers").select("*").eq("id", id).maybeSingle());
  return row ? toCustomer(row) : null;
}

/* ------------------------------------------------------------------ Pedidos */

export async function listOrders(filter: { storeId?: string; status?: OrderStatus; customerEmail?: string } = {}) {
  let query = sb().from("orders").select("*");
  if (filter.storeId) query = query.eq("store_id", filter.storeId);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.customerEmail) {
    const ids = (await run<Row[]>(sb().from("customers").select("id").eq("email", filter.customerEmail))).map((c) => c.id as string);
    if (!ids.length) return [];
    query = query.in("customer_id", ids);
  }
  return (await run<Row[]>(query.order("created_at", { ascending: false }))).map(toOrder);
}

export async function getOrder(storeId: string, id: string) {
  if (!isUuid(id)) return null;
  const row = await run<Row | null>(sb().from("orders").select("*").eq("store_id", storeId).eq("id", id).maybeSingle());
  return row ? toOrder(row) : null;
}

export interface CheckoutInput {
  items: { productId: string; variantId?: string | null; qty: number }[];
  paymentMethod: PaymentMethod;
  couponCode?: string | null;
}

export const formatAddress = (a: Address) =>
  `${a.street}, ${a.number}${a.complement ? ` — ${a.complement}` : ""} · ${a.district} · ${a.city}/${a.state} · CEP ${a.cep}`;

export async function createOrder(storeSlug: string, user: User, input: CheckoutInput) {
  const store = await requireStore(storeSlug);
  if (store.status === "suspended") throw new DomainError("Esta loja está temporariamente indisponível.", 403);
  const customer = await getCustomerForUser(store.id, user);
  if (!customer || !isProfileComplete(customer, store)) throw new DomainError("Complete seu cadastro e aceite os termos antes de comprar.", 403);

  // Agrupa linhas repetidas e valida tudo antes de mexer no estoque.
  const grouped = new Map<string, { productId: string; variantId: string | null; qty: number }>();
  for (const it of input.items) {
    const key = `${it.productId}:${it.variantId ?? ""}`;
    const g = grouped.get(key) ?? { productId: it.productId, variantId: it.variantId ?? null, qty: 0 };
    g.qty += it.qty;
    grouped.set(key, g);
  }
  const ids = [...new Set([...grouped.values()].map((g) => g.productId))].filter(isUuid);
  const products = ids.length ? (await run<Row[]>(sb().from("products").select(PRODUCT_SELECT).eq("store_id", store.id).in("id", ids))).map(toProduct) : [];
  const lines = [...grouped.values()].map(({ productId, variantId, qty }) => {
    const product = products.find((p) => p.id === productId);
    if (!product || !product.active) throw new DomainError("Um dos produtos não está mais disponível.");
    const variant = variantId ? (product.variants.find((v) => v.id === variantId) ?? null) : null;
    if (product.variants.length && !variant) throw new DomainError(`Escolha uma opção de "${product.name}".`);
    if (availableStock(product, variant) < qty) throw new DomainError(`Estoque insuficiente para "${product.name}${variant ? ` (${variantLabel(variant)})` : ""}".`);
    return { product, variant, qty, unitPrice: priceOf(product, variant).price };
  });

  const subtotal = round(lines.reduce((s, l) => s + l.unitPrice * l.qty, 0));
  let shipping = store.freeShippingOver !== null && subtotal >= store.freeShippingOver ? 0 : store.shippingFlat;
  let discount = 0;
  let coupon: Coupon | null = null;
  if (input.couponCode) {
    const applied = await evaluateCoupon(store, input.couponCode, subtotal, shipping);
    ({ coupon, discount, shipping } = applied);
  }

  // A função SQL baixa o estoque (conferindo o saldo de novo, com a linha travada),
  // consome o cupom e cria pedido + pagamento numa única transação.
  const row = await run(
    sb().rpc("create_order", {
      p_store_id: store.id,
      p_customer_id: customer.id,
      p_items: lines.map(({ product, variant, qty, unitPrice }) => ({
        productId: product.id,
        variantId: variant?.id ?? null,
        variantLabel: variant ? variantLabel(variant) : null,
        name: product.name,
        image: product.image,
        imageUrl: product.images[0] ?? null,
        price: unitPrice,
        qty,
      })),
      p_stock: lines
        .filter((l) => l.product.trackStock)
        .map(({ product, variant, qty }) => ({ productId: product.id, variantId: variant?.id ?? null, qty, label: `${product.name}${variant ? ` (${variantLabel(variant)})` : ""}` })),
      p_subtotal: subtotal,
      p_discount: discount,
      p_shipping: shipping,
      p_total: round(subtotal - discount + shipping),
      p_coupon_id: coupon?.id ?? null,
      p_coupon_code: coupon?.code ?? null,
      p_payment_method: input.paymentMethod,
      p_address: formatAddress(customer.address!),
    }),
  );
  return toOrder(row);
}

// pending → paid acontece somente via reviewPayment().
const transitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ["cancelled"],
  paid: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export const nextStatuses = (s: OrderStatus) => transitions[s];

export async function updateOrder(storeSlug: string, id: string, patch: { status?: OrderStatus; trackingCode?: string }) {
  const store = await requireStore(storeSlug);
  let order = await getOrder(store.id, id);
  if (!order) throw new DomainError("Pedido não encontrado.", 404);

  const row: Row = {};
  if (patch.status && patch.status !== order.status) {
    if (!transitions[order.status].includes(patch.status)) {
      if (order.status === "pending" && patch.status !== "cancelled") throw new DomainError("Aprove o pagamento antes de avançar o pedido.");
      throw new DomainError(`Não é possível mudar de "${orderStatusLabel[order.status]}" para "${orderStatusLabel[patch.status]}".`);
    }
    if (patch.status === "shipped" && !(patch.trackingCode || order.trackingCode)) {
      throw new DomainError("Informe o código de rastreio para marcar como enviado.");
    }
    // cancelar devolve o estoque e cancela o pagamento — tudo na função SQL
    if (patch.status === "cancelled") order = toOrder(await run(sb().rpc("cancel_order", { p_order_id: order.id })));
    else row.status = patch.status;
  }
  if (patch.trackingCode !== undefined) row.tracking_code = patch.trackingCode || null;
  if (!Object.keys(row).length) return order;

  // só aplica se ninguém mudou o status no meio do caminho
  const updated = await run<Row | null>(
    sb().from("orders").update({ ...row, updated_at: new Date().toISOString() }).eq("id", order.id).eq("status", order.status).select().maybeSingle(),
  );
  if (!updated) throw new DomainError("O pedido foi alterado por outra pessoa. Recarregue a página.", 409);
  return toOrder(updated);
}

/* ------------------------------------------------------------------ Pagamentos */

export async function getPayment(orderId: string) {
  if (!isUuid(orderId)) return null;
  const row = await run<Row | null>(sb().from("payments").select("*").eq("order_id", orderId).maybeSingle());
  return row ? toPayment(row) : null;
}

export async function listPayments(filter: { storeId?: string; status?: Payment["status"] } = {}) {
  let query = sb().from("payments").select("*");
  if (filter.storeId) query = query.eq("store_id", filter.storeId);
  if (filter.status) query = query.eq("status", filter.status);
  return (await run<Row[]>(query)).map(toPayment);
}

export const RECEIPT_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

/** Cliente informa que pagou e envia o comprovante. */
export async function submitReceipt(storeSlug: string, orderId: string, user: User, file: { name: string; mimeType: string; data: Buffer }) {
  const store = await requireStore(storeSlug);
  const order = await getOrder(store.id, orderId);
  const customer = await getCustomerForUser(store.id, user);
  if (!order || !customer || order.customerId !== customer.id) throw new DomainError("Pedido não encontrado.", 404);
  const payment = await getPayment(order.id);
  if (!payment || !["awaiting", "rejected"].includes(payment.status)) throw new DomainError("Este pedido não está aguardando pagamento.");
  // confere o conteúdo real do arquivo, não só o tipo declarado pelo navegador
  const sniffed = sniffType(file.data);
  if (!sniffed || !RECEIPT_TYPES.includes(sniffed)) throw new DomainError("Envie uma imagem (JPG, PNG, WEBP) ou PDF.", 415);
  if (file.data.length > RECEIPT_MAX_BYTES) throw new DomainError("O arquivo deve ter no máximo 5 MB.", 413);
  if (file.data.length === 0) throw new DomainError("Arquivo vazio.");

  const path = `${store.id}/${order.id}/${uid("f")}.${EXT[sniffed]}`;
  const { error } = await sb().storage.from(RECEIPTS_BUCKET).upload(path, file.data, { contentType: sniffed });
  if (error) throw new Error(`Storage: ${error.message}`);
  const now = new Date().toISOString();
  const updated = await run<Row | null>(
    sb()
      .from("payments")
      .update({ status: "in_review", receipt_path: path, receipt_name: file.name, receipt_mime: sniffed, receipt_size: file.data.length, submitted_at: now, rejection_reason: null })
      .eq("id", payment.id)
      .in("status", ["awaiting", "rejected"])
      .select()
      .maybeSingle(),
  );
  if (!updated) {
    await sb().storage.from(RECEIPTS_BUCKET).remove([path]);
    throw new DomainError("Este pedido não está aguardando pagamento.");
  }
  if (payment.receipt) await sb().storage.from(RECEIPTS_BUCKET).remove([payment.receipt.fileId]);
  return toPayment(updated);
}

export async function getReceiptFile(storeId: string, orderId: string) {
  const payment = await getPayment(orderId);
  if (!payment || payment.storeId !== storeId || !payment.receipt) return null;
  const { data, error } = await sb().storage.from(RECEIPTS_BUCKET).download(payment.receipt.fileId);
  if (error || !data) return null;
  return { name: payment.receipt.fileName, mimeType: payment.receipt.mimeType, data: Buffer.from(await data.arrayBuffer()) };
}

/** Lojista aprova (libera o envio) ou recusa o pagamento. */
export async function reviewPayment(storeSlug: string, orderId: string, decision: { approve: boolean; reason?: string }, actor: string) {
  const store = await requireStore(storeSlug);
  const order = await getOrder(store.id, orderId);
  const payment = order && (await getPayment(order.id));
  if (!order || !payment) throw new DomainError("Pedido não encontrado.", 404);
  if (!["awaiting", "in_review"].includes(payment.status)) throw new DomainError("Este pagamento já foi analisado.");
  if (!decision.approve && !decision.reason?.trim()) throw new DomainError("Informe o motivo da recusa para o cliente.");
  const now = new Date().toISOString();
  const updated = await run<Row | null>(
    sb()
      .from("payments")
      .update(
        decision.approve
          ? { status: "approved", reviewed_at: now, reviewed_by: actor, rejection_reason: null }
          : { status: "rejected", reviewed_at: now, reviewed_by: actor, rejection_reason: decision.reason!.trim() },
      )
      .eq("id", payment.id)
      .in("status", ["awaiting", "in_review"])
      .select()
      .maybeSingle(),
  );
  if (!updated) throw new DomainError("Este pagamento já foi analisado.");
  await run(sb().from("orders").update({ ...(decision.approve && order.status === "pending" ? { status: "paid" } : {}), updated_at: now }).eq("id", order.id));
  return toPayment(updated);
}

/* ------------------------------------------------------------------ Analytics */

type OrderLite = Pick<Order, "storeId" | "customerId" | "items" | "total" | "status" | "paymentMethod" | "createdAt">;

function dailySeries(orders: OrderLite[], days: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(today.getTime() - (days - 1 - i) * DAY);
    return { date: d.toISOString().slice(0, 10), label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }), revenue: 0, orders: 0 };
  });
  const index = new Map(buckets.map((b, i) => [b.date, i]));
  for (const o of orders) {
    const i = index.get(new Date(o.createdAt).toISOString().slice(0, 10));
    if (i !== undefined) {
      buckets[i].revenue = round(buckets[i].revenue + o.total);
      buckets[i].orders++;
    }
  }
  return buckets;
}

const within = (o: OrderLite, fromMs: number, toMs: number) => {
  const t = new Date(o.createdAt).getTime();
  return t >= fromMs && t < toMs;
};

const growth = (curr: number, prev: number) => (prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100);

export async function storeMetrics(storeId: string, days = 30) {
  const now = Date.now();
  const all = (await run<Row[]>(sb().from("orders").select("store_id, customer_id, items, total, status, payment_method, created_at").eq("store_id", storeId))).map((r) => fromRow<OrderLite>(r));
  const valid = all.filter((o) => o.status !== "cancelled");
  const curr = valid.filter((o) => within(o, now - days * DAY, now + 1));
  const prev = valid.filter((o) => within(o, now - 2 * days * DAY, now - days * DAY));
  const revenue = round(curr.reduce((s, o) => s + o.total, 0));
  const prevRevenue = round(prev.reduce((s, o) => s + o.total, 0));

  const productAgg = new Map<string, { name: string; image: string; qty: number; revenue: number }>();
  for (const o of curr)
    for (const it of o.items) {
      const a = productAgg.get(it.productId) ?? { name: it.name, image: it.image, qty: 0, revenue: 0 };
      a.qty += it.qty;
      a.revenue = round(a.revenue + it.price * it.qty);
      productAgg.set(it.productId, a);
    }

  const statusCount = Object.fromEntries(
    (["pending", "paid", "shipped", "delivered", "cancelled"] as OrderStatus[]).map((s) => [s, all.filter((o) => o.status === s).length]),
  ) as Record<OrderStatus, number>;

  const paymentMix = (["pix", "card", "boleto"] as PaymentMethod[]).map((m) => ({ method: m, count: curr.filter((o) => o.paymentMethod === m).length }));

  return {
    revenue,
    revenueGrowth: growth(revenue, prevRevenue),
    orders: curr.length,
    ordersGrowth: growth(curr.length, prev.length),
    avgTicket: curr.length ? round(revenue / curr.length) : 0,
    prevAvgTicket: prev.length ? round(prevRevenue / prev.length) : 0,
    customers: new Set(curr.map((o) => o.customerId)).size,
    series: dailySeries(curr, days),
    topProducts: [...productAgg.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    statusCount,
    paymentMix,
  };
}

export async function platformMetrics(days = 30) {
  const now = Date.now();
  const since = new Date(now - 2 * days * DAY).toISOString();
  const [orderRows, stores, plans, productRows] = await Promise.all([
    run<Row[]>(sb().from("orders").select("store_id, customer_id, total, status, payment_method, created_at").neq("status", "cancelled").gte("created_at", since)),
    listStores(),
    listPlans(),
    run<Row[]>(sb().from("products").select("store_id")),
  ]);
  const valid = orderRows.map((r) => fromRow<OrderLite>({ ...r, items: [] }));
  const curr = valid.filter((o) => within(o, now - days * DAY, now + 1));
  const prev = valid.filter((o) => within(o, now - 2 * days * DAY, now - days * DAY));
  const gmv = round(curr.reduce((s, o) => s + o.total, 0));
  const prevGmv = round(prev.reduce((s, o) => s + o.total, 0));

  const plansById = Object.fromEntries(plans.map((p) => [p.id, p]));
  const paying = stores.filter((s) => s.status === "active");
  const mrr = paying.reduce((s, st) => s + plansById[st.planId].priceMonthly, 0);
  const storeById = Object.fromEntries(stores.map((s) => [s.id, s]));
  const feeRevenue = round(curr.reduce((s, o) => s + (o.total * plansById[storeById[o.storeId].planId].feePercent) / 100, 0));

  const perStore = stores
    .map((s) => {
      const mine = curr.filter((o) => o.storeId === s.id);
      const minePrev = prev.filter((o) => o.storeId === s.id);
      const g = round(mine.reduce((x, o) => x + o.total, 0));
      return {
        store: s,
        gmv: g,
        orders: mine.length,
        growth: growth(g, minePrev.reduce((x, o) => x + o.total, 0)),
        products: productRows.filter((p) => p.store_id === s.id).length,
      };
    })
    .sort((a, b) => b.gmv - a.gmv);

  const statusCount = Object.fromEntries(
    (["active", "trial", "suspended"] as StoreStatus[]).map((st) => [st, stores.filter((s) => s.status === st).length]),
  ) as Record<StoreStatus, number>;

  const planMix = plans.map((p) => ({ plan: p.name, stores: stores.filter((s) => s.planId === p.id).length }));

  return {
    gmv,
    gmvGrowth: growth(gmv, prevGmv),
    mrr,
    arr: mrr * 12,
    feeRevenue,
    orders: curr.length,
    ordersGrowth: growth(curr.length, prev.length),
    stores: stores.length,
    statusCount,
    planMix,
    perStore,
    series: dailySeries(curr, days),
  };
}

/* ------------------------------------------------------------------ Auditoria */

export async function listAudit() {
  return (await run<Row[]>(sb().from("audit_logs").select("*").order("at", { ascending: false }).limit(500))).map((r) => fromRow<AuditLog>(r));
}

export async function log(actor: string, action: string, target: string) {
  return fromRow<AuditLog>(await run(sb().from("audit_logs").insert({ actor, action, target }).select().single()));
}
