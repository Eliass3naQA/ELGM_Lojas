// Camada de acesso a dados.
// Hoje: banco em memória (dados de exemplo). Amanhã: Supabase.
// Toda a aplicação (páginas e API) fala SOMENTE com estas funções — para migrar,
// basta reimplementá-las com o client do Supabase mantendo as mesmas assinaturas.

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
import { buildSeed, round, type Db } from "./seed";

const g = globalThis as unknown as { __lojaflowDb?: Db };
const db = (g.__lojaflowDb ??= buildSeed()); // sobrevive ao hot-reload do dev server

const uid = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const DAY = 86_400_000;

export class DomainError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export const RESERVED_SLUGS = ["backoffice", "api", "admin", "login", "cadastro", "_next", "static"];

/* ------------------------------------------------------------------ Planos */

export async function listPlans() {
  return db.plans;
}

export async function getPlan(id: PlanId) {
  return db.plans.find((p) => p.id === id)!;
}

/* ------------------------------------------------------------------ Lojas */

export async function listStores() {
  return [...db.stores].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getStoreBySlug(slug: string) {
  return db.stores.find((s) => s.slug === slug) ?? null;
}

export async function createStore(input: Pick<Store, "slug" | "name" | "tagline" | "category" | "logo" | "brandColor" | "ownerName" | "ownerEmail" | "planId">) {
  if (RESERVED_SLUGS.includes(input.slug)) throw new DomainError("Este endereço é reservado.");
  if (db.stores.some((s) => s.slug === input.slug)) throw new DomainError("Já existe uma loja com este endereço.", 409);
  const store: Store = {
    ...input,
    id: uid("st"),
    status: "trial",
    shippingFlat: 19.9,
    freeShippingOver: null,
    logoUrl: null,
    coverUrl: null,
    about: "",
    whatsapp: null,
    instagram: null,
    pixKey: input.ownerEmail,
    customTerms: null,
    termsUpdatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  db.stores.push(store);
  await log("admin", "Loja criada", store.slug);
  return store;
}

export async function updateStore(slug: string, patch: Partial<Omit<Store, "id" | "slug" | "createdAt">>, actor = "lojista") {
  const store = await requireStore(slug);
  const termsChanged = patch.customTerms !== undefined && patch.customTerms !== store.customTerms;
  Object.assign(store, patch);
  // nova versão dos termos: clientes precisarão aceitar de novo na próxima compra
  if (termsChanged) store.termsUpdatedAt = new Date().toISOString();
  if (patch.status) await log(actor, `Status alterado para ${patch.status}`, slug);
  if (patch.planId) await log(actor, `Plano alterado para ${patch.planId}`, slug);
  return store;
}

async function requireStore(slug: string) {
  const store = await getStoreBySlug(slug);
  if (!store) throw new DomainError("Loja não encontrada.", 404);
  return store;
}

/* ------------------------------------------------------------------ Produtos */

export async function listProducts(storeId: string, opts: { includeInactive?: boolean; q?: string; category?: string } = {}) {
  const q = opts.q?.toLowerCase().trim();
  return db.products.filter(
    (p) =>
      p.storeId === storeId &&
      (opts.includeInactive || p.active) &&
      (!opts.category || p.category === opts.category) &&
      (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.variants.some((v) => v.sku.toLowerCase().includes(q))),
  );
}

export async function getProduct(storeId: string, id: string) {
  return db.products.find((p) => p.storeId === storeId && p.id === id) ?? null;
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
  active: boolean;
}

const sameCombo = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);

/** Regras de consistência do catálogo (o schema Zod já validou formatos). */
function checkProduct(storeId: string, input: ProductInput, selfId?: string) {
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
  const taken = new Set(db.products.filter((p) => p.storeId === storeId && p.id !== selfId).flatMap((p) => [p.sku, ...p.variants.map((v) => v.sku)]).filter(Boolean));
  for (const sku of [input.sku, ...input.variants.map((v) => v.sku)].filter(Boolean)) if (taken.has(sku)) throw new DomainError(`O SKU ${sku} já está em uso em outro produto.`);
}

function recordMovement(m: Omit<StockMovement, "id" | "at">) {
  if (m.delta === 0) return;
  db.stockMovements.push({ ...m, id: uid("sm"), at: new Date().toISOString() });
}

export async function createProduct(storeSlug: string, input: ProductInput, actor = "lojista") {
  const store = await requireStore(storeSlug);
  const plan = await getPlan(store.planId);
  const count = db.products.filter((p) => p.storeId === store.id).length;
  if (plan.maxProducts !== null && count >= plan.maxProducts) {
    throw new DomainError(`Seu plano ${plan.name} permite até ${plan.maxProducts} produtos.`, 403);
  }
  checkProduct(store.id, input);
  const variants = input.variants.map((v) => ({ ...v, id: uid("v") }));
  const product: Product = {
    ...input,
    variants,
    stock: variants.length ? variants.reduce((s, v) => s + v.stock, 0) : input.stock,
    id: uid("p"),
    storeId: store.id,
    createdAt: new Date().toISOString(),
  };
  db.products.push(product);
  const entries = variants.length ? variants.map((v) => [v.id, v.stock] as const) : ([[null, product.stock]] as const);
  for (const [variantId, qty] of entries) recordMovement({ storeId: store.id, productId: product.id, variantId, delta: qty, balanceAfter: qty, reason: "initial", note: "Cadastro do produto", actor });
  return product;
}

export async function updateProduct(storeSlug: string, id: string, input: ProductInput, actor = "lojista") {
  const store = await requireStore(storeSlug);
  const product = await getProduct(store.id, id);
  if (!product) throw new DomainError("Produto não encontrado.", 404);
  checkProduct(store.id, input, product.id);

  // preserva ids das variações existentes (pelo id ou pela combinação) para manter o histórico de estoque
  const variants: Variant[] = input.variants.map((v) => {
    const prev = product.variants.find((p) => p.id === v.id) ?? product.variants.find((p) => sameCombo(p.options, v.options));
    return { ...v, id: prev?.id ?? uid("v") };
  });
  // registra no histórico as mudanças de estoque feitas pelo formulário
  if (variants.length) {
    for (const v of variants) {
      const before = product.variants.find((p) => p.id === v.id)?.stock ?? 0;
      recordMovement({ storeId: store.id, productId: product.id, variantId: v.id, delta: v.stock - before, balanceAfter: v.stock, reason: "adjustment", note: "Editado no cadastro do produto", actor });
    }
  } else if (!product.variants.length) {
    recordMovement({ storeId: store.id, productId: product.id, variantId: null, delta: input.stock - product.stock, balanceAfter: input.stock, reason: "adjustment", note: "Editado no cadastro do produto", actor });
  }
  Object.assign(product, { ...input, variants, stock: variants.length ? variants.reduce((s, v) => s + v.stock, 0) : input.stock });
  return product;
}

/** Alterações rápidas (ex.: ativar/ocultar na lista) sem passar pelo formulário inteiro. */
export async function patchProduct(storeSlug: string, id: string, patch: Partial<Pick<Product, "active" | "promo" | "price">>) {
  const store = await requireStore(storeSlug);
  const product = await getProduct(store.id, id);
  if (!product) throw new DomainError("Produto não encontrado.", 404);
  const next = { ...product, ...patch };
  if (next.promo && next.promo.price >= next.price) throw new DomainError("O preço promocional deve ser menor que o preço normal.");
  Object.assign(product, patch);
  return product;
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
  const idx = db.products.findIndex((p) => p.storeId === store.id && p.id === id);
  if (idx < 0) throw new DomainError("Produto não encontrado.", 404);
  db.products.splice(idx, 1);
}

export async function bulkProducts(storeSlug: string, ids: string[], action: "activate" | "deactivate" | "delete") {
  const store = await requireStore(storeSlug);
  const set = new Set(ids);
  if (action === "delete") db.products = db.products.filter((p) => !(p.storeId === store.id && set.has(p.id)));
  else db.products.filter((p) => p.storeId === store.id && set.has(p.id)).forEach((p) => (p.active = action === "activate"));
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

  const current = variant ? variant.stock : product.stock;
  const next = input.mode === "add" ? current + input.qty : input.mode === "remove" ? current - input.qty : input.qty;
  if (next < 0) throw new DomainError(`Não é possível retirar ${input.qty}: há apenas ${current} em estoque.`);
  if (variant) {
    variant.stock = next;
    product.stock = product.variants.reduce((s, v) => s + v.stock, 0);
  } else product.stock = next;
  recordMovement({ storeId: store.id, productId: product.id, variantId: variant?.id ?? null, delta: next - current, balanceAfter: next, reason: input.reason, note: input.note, actor });
  return product;
}

export async function listStockMovements(storeId: string, opts: { productId?: string; limit?: number } = {}) {
  return db.stockMovements
    .filter((m) => m.storeId === storeId && (!opts.productId || m.productId === opts.productId))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, opts.limit ?? 200);
}

/* ------------------------------------------------------------------ Cupons */

export async function listCoupons(storeId: string) {
  return db.coupons.filter((c) => c.storeId === storeId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type CouponInput = Pick<Coupon, "code" | "type" | "value" | "minSubtotal" | "startsAt" | "endsAt" | "maxUses" | "active">;

function checkCoupon(storeId: string, input: CouponInput, selfId?: string) {
  if (db.coupons.some((c) => c.storeId === storeId && c.id !== selfId && c.code === input.code)) throw new DomainError(`Já existe um cupom ${input.code}.`, 409);
  if (input.type === "percent" && (input.value <= 0 || input.value > 90)) throw new DomainError("O desconto percentual deve ser entre 1% e 90%.");
  if (input.type === "fixed" && input.value <= 0) throw new DomainError("Informe o valor do desconto.");
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) throw new DomainError("A validade final deve ser depois do início.");
}

export async function createCoupon(storeSlug: string, input: CouponInput) {
  const store = await requireStore(storeSlug);
  checkCoupon(store.id, input);
  const coupon: Coupon = { ...input, id: uid("cp"), storeId: store.id, uses: 0, createdAt: new Date().toISOString() };
  db.coupons.push(coupon);
  return coupon;
}

export async function updateCoupon(storeSlug: string, id: string, patch: Partial<CouponInput>) {
  const store = await requireStore(storeSlug);
  const coupon = db.coupons.find((c) => c.storeId === store.id && c.id === id);
  if (!coupon) throw new DomainError("Cupom não encontrado.", 404);
  checkCoupon(store.id, { ...coupon, ...patch }, coupon.id);
  Object.assign(coupon, patch);
  return coupon;
}

export async function deleteCoupon(storeSlug: string, id: string) {
  const store = await requireStore(storeSlug);
  db.coupons = db.coupons.filter((c) => !(c.storeId === store.id && c.id === id));
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
  const coupon = db.coupons.find((c) => c.storeId === store.id && c.code === code);
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

export async function saveImage(storeSlug: string, file: { name: string; data: Buffer }) {
  const store = await requireStore(storeSlug);
  if (file.data.length === 0) throw new DomainError("Arquivo vazio.");
  if (file.data.length > MAX_UPLOAD_BYTES) throw new DomainError("A imagem deve ter no máximo 5 MB.", 413);
  const mimeType = sniffType(file.data);
  if (!mimeType || !IMAGE_TYPES.includes(mimeType)) throw new DomainError("Envie uma imagem JPG, PNG ou WEBP.", 415);
  const id = uid("img");
  db.media.set(id, { name: file.name, mimeType, data: file.data, storeId: store.id });
  return { id, url: `/api/files/${id}` };
}

export async function getImage(id: string) {
  return db.media.get(id) ?? null;
}

/* ------------------------------------------------------------------ Usuários (login social) */

export async function getUser(id: string) {
  return db.users.find((u) => u.id === id) ?? null;
}

export async function upsertUser(input: { email: string; name: string; provider: AuthProvider }) {
  const email = input.email.trim().toLowerCase();
  let user = db.users.find((u) => u.email === email);
  if (!user) {
    user = { id: uid("u"), email, name: input.name.trim(), provider: input.provider, createdAt: new Date().toISOString() };
    db.users.push(user);
  }
  return user;
}

/* ------------------------------------------------------------------ Clientes */

/** Perfil do usuário nesta loja. Vincula automaticamente um cliente antigo com o mesmo e-mail. */
export async function getCustomerForUser(storeId: string, user: User) {
  const customer = db.customers.find((c) => c.storeId === storeId && (c.userId === user.id || c.email === user.email)) ?? null;
  if (customer && !customer.userId) {
    customer.userId = user.id;
    customer.provider = user.provider;
  }
  return customer;
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
  const now = new Date().toISOString();
  const fields = {
    name: input.name,
    cpf: input.cpf,
    phone: input.phone,
    birthDate: input.birthDate,
    address: input.address,
    city: `${input.address.city}, ${input.address.state}`,
    marketingOptIn: input.marketingOptIn,
    termsVersion: store.termsUpdatedAt,
    acceptedTermsAt: now,
  };
  let customer = await getCustomerForUser(store.id, user);
  if (customer) Object.assign(customer, fields);
  else {
    customer = { ...fields, id: uid("c"), storeId: store.id, userId: user.id, provider: user.provider, email: user.email, createdAt: now };
    db.customers.push(customer);
  }
  return customer;
}


export interface CustomerWithStats extends Customer {
  orders: number;
  spent: number;
  lastOrderAt: string | null;
}

export async function listCustomers(storeId: string): Promise<CustomerWithStats[]> {
  const orders = db.orders.filter((o) => o.storeId === storeId && o.status !== "cancelled");
  return db.customers
    .filter((c) => c.storeId === storeId)
    .map((c) => {
      const mine = orders.filter((o) => o.customerId === c.id);
      return {
        ...c,
        orders: mine.length,
        spent: round(mine.reduce((s, o) => s + o.total, 0)),
        lastOrderAt: mine.map((o) => o.createdAt).sort().at(-1) ?? null,
      };
    })
    .sort((a, b) => b.spent - a.spent);
}

export async function getCustomer(id: string) {
  return db.customers.find((c) => c.id === id) ?? null;
}

/* ------------------------------------------------------------------ Pedidos */

export async function listOrders(filter: { storeId?: string; status?: OrderStatus; customerEmail?: string } = {}) {
  const customerIds = filter.customerEmail
    ? new Set(db.customers.filter((c) => c.email === filter.customerEmail).map((c) => c.id))
    : null;
  return db.orders
    .filter(
      (o) =>
        (!filter.storeId || o.storeId === filter.storeId) &&
        (!filter.status || o.status === filter.status) &&
        (!customerIds || customerIds.has(o.customerId)),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getOrder(storeId: string, id: string) {
  return db.orders.find((o) => o.storeId === storeId && o.id === id) ?? null;
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

  // Agrupa linhas repetidas e valida tudo antes de mexer no estoque
  // (no Supabase isto vira uma RPC transacional com SELECT ... FOR UPDATE).
  const grouped = new Map<string, { productId: string; variantId: string | null; qty: number }>();
  for (const it of input.items) {
    const key = `${it.productId}:${it.variantId ?? ""}`;
    const g = grouped.get(key) ?? { productId: it.productId, variantId: it.variantId ?? null, qty: 0 };
    g.qty += it.qty;
    grouped.set(key, g);
  }
  const lines = await Promise.all(
    [...grouped.values()].map(async ({ productId, variantId, qty }) => {
      const product = await getProduct(store.id, productId);
      if (!product || !product.active) throw new DomainError("Um dos produtos não está mais disponível.");
      const variant = variantId ? (product.variants.find((v) => v.id === variantId) ?? null) : null;
      if (product.variants.length && !variant) throw new DomainError(`Escolha uma opção de "${product.name}".`);
      if (availableStock(product, variant) < qty) throw new DomainError(`Estoque insuficiente para "${product.name}${variant ? ` (${variantLabel(variant)})` : ""}".`);
      return { product, variant, qty, unitPrice: priceOf(product, variant).price };
    }),
  );

  const subtotal = round(lines.reduce((s, l) => s + l.unitPrice * l.qty, 0));
  let shipping = store.freeShippingOver !== null && subtotal >= store.freeShippingOver ? 0 : store.shippingFlat;
  let discount = 0;
  let coupon: Coupon | null = null;
  if (input.couponCode) {
    const applied = await evaluateCoupon(store, input.couponCode, subtotal, shipping);
    ({ coupon, discount, shipping } = applied);
  }

  // tudo validado: baixa o estoque e registra as movimentações
  for (const { product, variant, qty } of lines) {
    if (!product.trackStock) continue;
    if (variant) variant.stock -= qty;
    const balance = variant ? variant.stock : (product.stock -= qty);
    if (variant) product.stock = product.variants.reduce((s, v) => s + v.stock, 0);
    recordMovement({ storeId: store.id, productId: product.id, variantId: variant?.id ?? null, delta: -qty, balanceAfter: balance, reason: "sale", note: "Venda", actor: "sistema" });
  }
  if (coupon) coupon.uses++;
  const lastNumber = Math.max(1000, ...db.orders.filter((o) => o.storeId === store.id).map((o) => o.number));
  const now = new Date().toISOString();
  const order: Order = {
    id: uid("o"),
    number: lastNumber + 1,
    storeId: store.id,
    customerId: customer.id,
    items: lines.map(({ product, variant, qty, unitPrice }) => ({
      productId: product.id,
      variantId: variant?.id ?? null,
      variantLabel: variant ? variantLabel(variant) : null,
      name: product.name,
      image: product.image,
      imageUrl: product.images[0] ?? null,
      price: unitPrice,
      qty,
    })),
    subtotal,
    discount,
    couponCode: coupon?.code ?? null,
    shipping,
    total: round(subtotal - discount + shipping),
    // Fica aguardando até o lojista aprovar o comprovante (ou, no futuro, o webhook do Mercado Pago).
    status: "pending",
    paymentMethod: input.paymentMethod,
    trackingCode: null,
    address: formatAddress(customer.address!),
    createdAt: now,
    updatedAt: now,
  };
  db.orders.push(order);
  db.payments.push({
    id: uid("pay"),
    orderId: order.id,
    storeId: store.id,
    provider: "manual",
    method: input.paymentMethod,
    amount: order.total,
    status: "awaiting",
    receipt: null,
    submittedAt: null,
    reviewedAt: null,
    reviewedBy: null,
    rejectionReason: null,
    externalId: null,
    createdAt: now,
  });
  return order;
}

// pending → paid acontece somente via approvePayment().
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
  const order = await getOrder(store.id, id);
  if (!order) throw new DomainError("Pedido não encontrado.", 404);

  if (patch.status && patch.status !== order.status) {
    if (!transitions[order.status].includes(patch.status)) {
      if (order.status === "pending" && patch.status !== "cancelled") throw new DomainError("Aprove o pagamento antes de avançar o pedido.");
      throw new DomainError(`Não é possível mudar de "${orderStatusLabel[order.status]}" para "${orderStatusLabel[patch.status]}".`);
    }
    if (patch.status === "shipped" && !(patch.trackingCode || order.trackingCode)) {
      throw new DomainError("Informe o código de rastreio para marcar como enviado.");
    }
    if (patch.status === "cancelled") {
      const payment = await getPayment(order.id);
      if (payment && payment.status !== "approved") payment.status = "cancelled";
      // devolve ao estoque (produto/variação ainda existentes e com controle de estoque)
      for (const it of order.items) {
        const p = db.products.find((x) => x.id === it.productId);
        if (!p || !p.trackStock) continue;
        const v = it.variantId ? p.variants.find((x) => x.id === it.variantId) : null;
        if (it.variantId && !v) continue;
        if (v) v.stock += it.qty;
        const balance = v ? v.stock : (p.stock += it.qty);
        if (v) p.stock = p.variants.reduce((s, x) => s + x.stock, 0);
        recordMovement({ storeId: store.id, productId: p.id, variantId: v?.id ?? null, delta: it.qty, balanceAfter: balance, reason: "cancel", note: `Pedido #${order.number} cancelado`, actor: "sistema" });
      }
    }
    order.status = patch.status;
  }
  if (patch.trackingCode !== undefined) order.trackingCode = patch.trackingCode || null;
  order.updatedAt = new Date().toISOString();
  return order;
}

/* ------------------------------------------------------------------ Pagamentos */

export async function getPayment(orderId: string) {
  return db.payments.find((p) => p.orderId === orderId) ?? null;
}

export async function listPayments(filter: { storeId?: string; status?: Payment["status"] } = {}) {
  return db.payments.filter((p) => (!filter.storeId || p.storeId === filter.storeId) && (!filter.status || p.status === filter.status));
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
  file = { ...file, mimeType: sniffed };
  if (file.data.length > RECEIPT_MAX_BYTES) throw new DomainError("O arquivo deve ter no máximo 5 MB.", 413);
  if (file.data.length === 0) throw new DomainError("Arquivo vazio.");

  const fileId = uid("f");
  db.files.set(fileId, { name: file.name, mimeType: file.mimeType, data: file.data });
  if (payment.receipt) db.files.delete(payment.receipt.fileId);
  const now = new Date().toISOString();
  Object.assign(payment, {
    status: "in_review",
    receipt: { fileId, fileName: file.name, mimeType: file.mimeType, size: file.data.length, uploadedAt: now },
    submittedAt: now,
    rejectionReason: null,
  });
  return payment;
}

export async function getReceiptFile(storeId: string, orderId: string) {
  const payment = await getPayment(orderId);
  if (!payment || payment.storeId !== storeId || !payment.receipt) return null;
  return db.files.get(payment.receipt.fileId) ?? null;
}

/** Lojista aprova (libera o envio) ou recusa o pagamento. */
export async function reviewPayment(storeSlug: string, orderId: string, decision: { approve: boolean; reason?: string }, actor: string) {
  const store = await requireStore(storeSlug);
  const order = await getOrder(store.id, orderId);
  const payment = order && (await getPayment(order.id));
  if (!order || !payment) throw new DomainError("Pedido não encontrado.", 404);
  if (!["awaiting", "in_review"].includes(payment.status)) throw new DomainError("Este pagamento já foi analisado.");
  const now = new Date().toISOString();
  if (decision.approve) {
    Object.assign(payment, { status: "approved", reviewedAt: now, reviewedBy: actor, rejectionReason: null });
    order.status = "paid";
  } else {
    if (!decision.reason?.trim()) throw new DomainError("Informe o motivo da recusa para o cliente.");
    Object.assign(payment, { status: "rejected", reviewedAt: now, reviewedBy: actor, rejectionReason: decision.reason.trim() });
  }
  order.updatedAt = now;
  return payment;
}

/* ------------------------------------------------------------------ Analytics */

function dailySeries(orders: Order[], days: number) {
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

const within = (o: Order, fromMs: number, toMs: number) => {
  const t = new Date(o.createdAt).getTime();
  return t >= fromMs && t < toMs;
};

const growth = (curr: number, prev: number) => (prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100);

export async function storeMetrics(storeId: string, days = 30) {
  const now = Date.now();
  const valid = db.orders.filter((o) => o.storeId === storeId && o.status !== "cancelled");
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

  const all = db.orders.filter((o) => o.storeId === storeId);
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
  const valid = db.orders.filter((o) => o.status !== "cancelled");
  const curr = valid.filter((o) => within(o, now - days * DAY, now + 1));
  const prev = valid.filter((o) => within(o, now - 2 * days * DAY, now - days * DAY));
  const gmv = round(curr.reduce((s, o) => s + o.total, 0));
  const prevGmv = round(prev.reduce((s, o) => s + o.total, 0));

  const plansById = Object.fromEntries(db.plans.map((p) => [p.id, p]));
  const paying = db.stores.filter((s) => s.status === "active");
  const mrr = paying.reduce((s, st) => s + plansById[st.planId].priceMonthly, 0);
  const storeById = Object.fromEntries(db.stores.map((s) => [s.id, s]));
  const feeRevenue = round(curr.reduce((s, o) => s + (o.total * plansById[storeById[o.storeId].planId].feePercent) / 100, 0));

  const perStore = db.stores
    .map((s) => {
      const mine = curr.filter((o) => o.storeId === s.id);
      const minePrev = prev.filter((o) => o.storeId === s.id);
      const g = round(mine.reduce((x, o) => x + o.total, 0));
      return {
        store: s,
        gmv: g,
        orders: mine.length,
        growth: growth(g, minePrev.reduce((x, o) => x + o.total, 0)),
        products: db.products.filter((p) => p.storeId === s.id).length,
      };
    })
    .sort((a, b) => b.gmv - a.gmv);

  const statusCount = Object.fromEntries(
    (["active", "trial", "suspended"] as StoreStatus[]).map((st) => [st, db.stores.filter((s) => s.status === st).length]),
  ) as Record<StoreStatus, number>;

  const planMix = db.plans.map((p) => ({ plan: p.name, stores: db.stores.filter((s) => s.planId === p.id).length }));

  return {
    gmv,
    gmvGrowth: growth(gmv, prevGmv),
    mrr,
    arr: mrr * 12,
    feeRevenue,
    orders: curr.length,
    ordersGrowth: growth(curr.length, prev.length),
    stores: db.stores.length,
    statusCount,
    planMix,
    perStore,
    series: dailySeries(curr, days),
  };
}

/* ------------------------------------------------------------------ Auditoria */

export async function listAudit() {
  return [...db.audit].sort((a, b) => b.at.localeCompare(a.at));
}

export async function log(actor: string, action: string, target: string) {
  const entry: AuditLog = { id: uid("a"), at: new Date().toISOString(), actor, action, target };
  db.audit.push(entry);
  return entry;
}
