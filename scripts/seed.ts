// Popula o Supabase com os dados de demonstração (src/lib/data/seed.ts).
// Uso: npm run db:seed   (lê .env.local; só roda com o banco vazio)
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { buildSeed } from "../src/lib/data/seed";

process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local");
const sb = createClient(url, key, { auth: { persistSession: false } });

// os ids do seed ("st_1", "st_1_p3"...) viram UUIDs, mantendo as referências
const ids = new Map<string, string>();
const id = (old: string) => ids.get(old) ?? (ids.set(old, randomUUID()), ids.get(old)!);
const idOrNull = (old: string | null) => (old ? id(old) : null);

async function insert(table: string, rows: object[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from(table).insert(rows.slice(i, i + 500));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`  ${table}: ${rows.length}`);
}

async function main() {
  const { count, error } = await sb.from("stores").select("id", { count: "exact", head: true });
  if (error) throw new Error(`Não foi possível acessar o banco — o schema.sql já foi executado? (${error.message})`);
  if (count) {
    console.log(`O banco já tem ${count} loja(s); seed cancelado para não duplicar dados.`);
    return;
  }

  const db = buildSeed();
  console.log("Inserindo dados de demonstração…");

  await insert(
    "stores",
    db.stores.map((s) => ({
      id: id(s.id), slug: s.slug, name: s.name, tagline: s.tagline, category: s.category, logo: s.logo, logo_url: s.logoUrl, cover_url: s.coverUrl,
      about: s.about, whatsapp: s.whatsapp, instagram: s.instagram, brand_color: s.brandColor, owner_name: s.ownerName, owner_email: s.ownerEmail,
      plan_id: s.planId, status: s.status, shipping_flat: s.shippingFlat, free_shipping_over: s.freeShippingOver, pix_key: s.pixKey,
      custom_terms: s.customTerms, terms_updated_at: s.termsUpdatedAt, created_at: s.createdAt,
    })),
  );

  await insert(
    "products",
    db.products.map((p) => ({
      id: id(p.id), store_id: id(p.storeId), name: p.name, description: p.description, price: p.price,
      promo_price: p.promo?.price ?? null, promo_starts_at: p.promo?.startsAt ?? null, promo_ends_at: p.promo?.endsAt ?? null,
      sku: p.sku, track_stock: p.trackStock, stock: p.stock, low_stock_threshold: p.lowStockThreshold, options: p.options,
      category: p.category, image: p.image, images: p.images, showcase: p.showcase, specs: p.specs, active: p.active, created_at: p.createdAt,
    })),
  );

  await insert(
    "product_variants",
    db.products.flatMap((p) =>
      p.variants.map((v, position) => ({ id: id(v.id), product_id: id(p.id), store_id: id(p.storeId), options: v.options, sku: v.sku, stock: v.stock, price: v.price, position })),
    ),
  );

  await insert(
    "stock_movements",
    db.stockMovements.map((m) => ({
      store_id: id(m.storeId), product_id: id(m.productId), variant_id: idOrNull(m.variantId), delta: m.delta, balance_after: m.balanceAfter,
      reason: m.reason, note: m.note, actor: m.actor, at: m.at,
    })),
  );

  await insert(
    "customers",
    db.customers.map((c) => ({
      id: id(c.id), store_id: id(c.storeId), user_id: null, provider: c.provider, name: c.name, email: c.email, phone: c.phone, city: c.city,
      cpf: c.cpf, birth_date: c.birthDate, address: c.address, accepted_terms_at: c.acceptedTermsAt, terms_version: c.termsVersion,
      marketing_opt_in: c.marketingOptIn, created_at: c.createdAt,
    })),
  );

  await insert(
    "orders",
    db.orders.map((o) => ({
      id: id(o.id), number: o.number, store_id: id(o.storeId), customer_id: id(o.customerId),
      items: o.items.map((it) => ({ ...it, productId: id(it.productId), variantId: idOrNull(it.variantId) })),
      subtotal: o.subtotal, discount: o.discount, coupon_code: o.couponCode, shipping: o.shipping, total: o.total, status: o.status,
      payment_method: o.paymentMethod, tracking_code: o.trackingCode, address: o.address, created_at: o.createdAt, updated_at: o.updatedAt,
    })),
  );

  // comprovantes de exemplo dos pedidos "em análise" → bucket privado
  const receiptPaths = new Map<string, string>();
  for (const p of db.payments) {
    if (!p.receipt) continue;
    const file = db.files.get(p.receipt.fileId);
    if (!file) continue;
    const path = `${id(p.storeId)}/${id(p.orderId)}/${p.receipt.fileId}.svg`;
    const { error: upErr } = await sb.storage.from("receipts").upload(path, file.data, { contentType: file.mimeType, upsert: true });
    if (upErr) throw new Error(`receipts: ${upErr.message}`);
    receiptPaths.set(p.id, path);
  }
  console.log(`  comprovantes: ${receiptPaths.size}`);

  await insert(
    "payments",
    db.payments.map((p) => ({
      id: id(p.id), order_id: id(p.orderId), store_id: id(p.storeId), provider: p.provider, method: p.method, amount: p.amount, status: p.status,
      receipt_path: receiptPaths.get(p.id) ?? null, receipt_name: p.receipt?.fileName ?? null, receipt_mime: p.receipt?.mimeType ?? null,
      receipt_size: p.receipt ? (db.files.get(p.receipt.fileId)?.data.length ?? p.receipt.size) : null,
      submitted_at: p.submittedAt, reviewed_at: p.reviewedAt, reviewed_by: p.reviewedBy, rejection_reason: p.rejectionReason,
      external_id: p.externalId, created_at: p.createdAt,
    })),
  );

  await insert(
    "coupons",
    db.coupons.map((c) => ({
      store_id: id(c.storeId), code: c.code, type: c.type, value: c.value, min_subtotal: c.minSubtotal, starts_at: c.startsAt, ends_at: c.endsAt,
      max_uses: c.maxUses, uses: c.uses, active: c.active, created_at: c.createdAt,
    })),
  );

  await insert("audit_logs", db.audit.map((a) => ({ at: a.at, actor: a.actor, action: a.action, target: a.target })));
  console.log("Pronto! Ex.: http://localhost:3000/aurora-moda/home");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
