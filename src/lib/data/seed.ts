import { generateCpf } from "../cpf";
import { combinations, priceOf, variantLabel } from "../pricing";
import type { AuditLog, Coupon, Customer, Order, OrderStatus, Payment, PaymentMethod, Plan, Product, ProductOption, StockMovement, Store, User } from "../types";

// PRNG determinístico para que os dados de exemplo sejam estáveis entre reloads.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    priceMonthly: 49,
    feePercent: 2.5,
    maxProducts: 50,
    features: ["Até 50 produtos", "Loja personalizada", "Pix e cartão", "Suporte por e-mail"],
  },
  {
    id: "pro",
    name: "Pro",
    priceMonthly: 149,
    feePercent: 1.5,
    maxProducts: 1000,
    features: ["Até 1.000 produtos", "Insights inteligentes", "Cupons e frete grátis", "Suporte prioritário"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceMonthly: 499,
    feePercent: 0.8,
    maxProducts: null,
    features: ["Produtos ilimitados", "Domínio próprio", "API e webhooks", "Gerente de conta"],
  },
];

type StoreSeed = Omit<Store, "id" | "createdAt" | "pixKey" | "customTerms" | "termsUpdatedAt" | "logoUrl" | "coverUrl" | "about" | "whatsapp" | "instagram"> & {
  catalog: Array<[name: string, image: string, category: string, price: number, compareAt: number | null, stock: number]>;
};

const storeSeeds: StoreSeed[] = [
  {
    slug: "aurora-moda",
    name: "Aurora Moda",
    tagline: "Peças atemporais, feitas para durar.",
    category: "Moda",
    logo: "🌅",
    brandColor: "#e11d48",
    ownerName: "Marina Costa",
    ownerEmail: "marina@auroramoda.com",
    planId: "pro",
    status: "active",
    shippingFlat: 19.9,
    freeShippingOver: 299,
    catalog: [
      ["Camisa de Linho Off-White", "👔", "Camisas", 189.9, 239.9, 24],
      ["Vestido Midi Floral", "👗", "Vestidos", 259.9, null, 12],
      ["Jaqueta Jeans Oversized", "🧥", "Casacos", 329.9, 399.9, 6],
      ["Calça Alfaiataria Preta", "👖", "Calças", 219.9, null, 30],
      ["Tênis Couro Branco", "👟", "Calçados", 399.9, 459.9, 3],
      ["Bolsa Tote Caramelo", "👜", "Acessórios", 279.9, null, 15],
      ["Óculos de Sol Retrô", "🕶️", "Acessórios", 149.9, 189.9, 0],
      ["Chapéu Bucket Areia", "👒", "Acessórios", 89.9, null, 40],
    ],
  },
  {
    slug: "cafe-do-ze",
    name: "Café do Zé",
    tagline: "Cafés especiais torrados toda semana.",
    category: "Alimentos",
    logo: "☕",
    brandColor: "#b45309",
    ownerName: "José Almeida",
    ownerEmail: "ze@cafedoze.com.br",
    planId: "starter",
    status: "active",
    shippingFlat: 14.9,
    freeShippingOver: 150,
    catalog: [
      ["Café Bourbon Amarelo 250g", "☕", "Cafés", 48.9, null, 80],
      ["Café Catuaí Vermelho 500g", "🫘", "Cafés", 79.9, 89.9, 45],
      ["Kit Degustação 4 origens", "🎁", "Kits", 139.9, 169.9, 18],
      ["Prensa Francesa 600ml", "🫖", "Acessórios", 129.9, null, 9],
      ["Moedor Manual Cerâmico", "⚙️", "Acessórios", 189.9, 219.9, 4],
      ["Caneca Esmaltada", "🍵", "Acessórios", 59.9, null, 60],
    ],
  },
  {
    slug: "techlab",
    name: "TechLab",
    tagline: "Gadgets e periféricos para quem cria.",
    category: "Eletrônicos",
    logo: "⚡",
    brandColor: "#4f46e5",
    ownerName: "Rafael Nunes",
    ownerEmail: "rafael@techlab.store",
    planId: "enterprise",
    status: "active",
    shippingFlat: 24.9,
    freeShippingOver: 499,
    catalog: [
      ["Teclado Mecânico 75%", "⌨️", "Periféricos", 549.9, 649.9, 22],
      ["Mouse Sem Fio Ergonômico", "🖱️", "Periféricos", 289.9, null, 35],
      ["Headset Bluetooth ANC", "🎧", "Áudio", 799.9, 999.9, 8],
      ["Hub USB-C 8 em 1", "🔌", "Acessórios", 239.9, null, 50],
      ["Webcam 4K", "📷", "Vídeo", 689.9, 749.9, 2],
      ["Suporte de Monitor Articulado", "🖥️", "Acessórios", 359.9, null, 14],
      ["Caixa de Som Portátil", "🔊", "Áudio", 449.9, 529.9, 19],
    ],
  },
  {
    slug: "verde-vivo",
    name: "Verde Vivo",
    tagline: "Plantas que transformam seu espaço.",
    category: "Casa & Jardim",
    logo: "🌿",
    brandColor: "#16a34a",
    ownerName: "Carla Mendes",
    ownerEmail: "carla@verdevivo.com",
    planId: "starter",
    status: "trial",
    shippingFlat: 29.9,
    freeShippingOver: null,
    catalog: [
      ["Costela-de-Adão M", "🌿", "Plantas", 119.9, null, 10],
      ["Suculentas Kit 6", "🪴", "Plantas", 69.9, 79.9, 25],
      ["Vaso Cerâmica Terracota", "🏺", "Vasos", 89.9, null, 16],
      ["Substrato Premium 5kg", "🪨", "Cuidados", 34.9, null, 40],
    ],
  },
  {
    slug: "bike-urbana",
    name: "Bike Urbana",
    tagline: "Mobilidade com estilo.",
    category: "Esportes",
    logo: "🚲",
    brandColor: "#0891b2",
    ownerName: "Pedro Lima",
    ownerEmail: "pedro@bikeurbana.com",
    planId: "pro",
    status: "suspended",
    shippingFlat: 49.9,
    freeShippingOver: null,
    catalog: [
      ["Capacete Urbano", "⛑️", "Segurança", 219.9, null, 12],
      ["Farol LED Recarregável", "🔦", "Acessórios", 99.9, 119.9, 30],
    ],
  },
];

// Variações de exemplo por produto — mostram o uso em segmentos diferentes.
const variantSeeds: Record<string, ProductOption[]> = {
  "Camisa de Linho Off-White": [{ name: "Tamanho", values: ["P", "M", "G", "GG"] }],
  "Vestido Midi Floral": [
    { name: "Tamanho", values: ["P", "M", "G"] },
    { name: "Cor", values: ["Azul", "Rosa"] },
  ],
  "Tênis Couro Branco": [{ name: "Numeração", values: ["36", "37", "38", "39", "40"] }],
  "Café Catuaí Vermelho 500g": [{ name: "Moagem", values: ["Grãos", "Média", "Fina"] }],
  "Headset Bluetooth ANC": [{ name: "Cor", values: ["Preto", "Branco"] }],
  "Vaso Cerâmica Terracota": [{ name: "Tamanho", values: ["P", "M", "G"] }],
};
// Variações com preço próprio (ex.: vaso G custa mais).
const variantPrices: Record<string, Record<string, number>> = { "Vaso Cerâmica Terracota": { G: 129.9 } };

const skuPart = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase();

const firstNames = ["Ana", "Bruno", "Camila", "Diego", "Eduarda", "Felipe", "Gabriela", "Henrique", "Isabela", "João", "Larissa", "Mateus", "Natália", "Otávio", "Paula", "Renato", "Sofia", "Thiago", "Vitória", "Lucas"];
const lastNames = ["Silva", "Souza", "Oliveira", "Santos", "Pereira", "Lima", "Ferreira", "Rodrigues", "Almeida", "Gomes"];
const cities = ["São Paulo, SP", "Rio de Janeiro, RJ", "Belo Horizonte, MG", "Curitiba, PR", "Porto Alegre, RS", "Recife, PE", "Salvador, BA", "Florianópolis, SC", "Goiânia, GO", "Fortaleza, CE"];

export interface StoredFile {
  name: string;
  mimeType: string;
  data: Buffer;
}

export interface Db {
  plans: Plan[];
  stores: Store[];
  users: User[];
  products: Product[];
  customers: Customer[];
  orders: Order[];
  payments: Payment[];
  coupons: Coupon[];
  stockMovements: StockMovement[];
  files: Map<string, StoredFile>; // comprovantes (no Supabase: Storage bucket privado)
  media: Map<string, StoredFile & { storeId: string }>; // fotos públicas (no Supabase: bucket público)
  audit: AuditLog[];
  seq: number;
}

// Comprovante fictício para os pedidos de exemplo que já estão "em análise".
function sampleReceipt(amount: number, payer: string, at: Date) {
  const v = amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="520" viewBox="0 0 360 520">
<rect width="360" height="520" rx="16" fill="#fff"/><rect width="360" height="88" rx="16" fill="#0f766e"/>
<text x="24" y="52" font-family="Arial" font-size="22" fill="#fff" font-weight="bold">Comprovante Pix</text>
<text x="24" y="140" font-family="Arial" font-size="13" fill="#71717a">Valor</text>
<text x="24" y="172" font-family="Arial" font-size="30" fill="#18181b" font-weight="bold">${v}</text>
<text x="24" y="220" font-family="Arial" font-size="13" fill="#71717a">Pagador</text>
<text x="24" y="244" font-family="Arial" font-size="16" fill="#18181b">${payer}</text>
<text x="24" y="292" font-family="Arial" font-size="13" fill="#71717a">Data</text>
<text x="24" y="316" font-family="Arial" font-size="16" fill="#18181b">${at.toLocaleString("pt-BR")}</text>
<text x="24" y="364" font-family="Arial" font-size="13" fill="#71717a">ID da transação</text>
<text x="24" y="388" font-family="monospace" font-size="13" fill="#18181b">E${Math.floor(at.getTime() / 1000)}SIMULADO</text>
<text x="24" y="480" font-family="Arial" font-size="11" fill="#a1a1aa">Documento de demonstração</text></svg>`;
  return Buffer.from(svg);
}

export function buildSeed(): Db {
  const rand = mulberry32(42);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const now = Date.now();
  const day = 86_400_000;

  const db: Db = { plans, stores: [], users: [], products: [], customers: [], orders: [], payments: [], coupons: [], stockMovements: [], files: new Map(), media: new Map(), audit: [], seq: 1000 };

  storeSeeds.forEach((seed, si) => {
    const { catalog, ...storeData } = seed;
    const storeId = `st_${si + 1}`;
    const createdAt = new Date(now - (300 - si * 50) * day).toISOString();
    db.stores.push({
      ...storeData,
      id: storeId,
      logoUrl: null,
      coverUrl: null,
      about: `A ${storeData.name} nasceu da paixão por ${storeData.category.toLowerCase()}. Selecionamos cada produto com cuidado e enviamos para todo o Brasil.`,
      whatsapp: null,
      instagram: storeData.slug.replace(/-/g, ""),
      pixKey: storeData.ownerEmail,
      customTerms: null,
      termsUpdatedAt: createdAt,
      createdAt,
    });

    const products: Product[] = catalog.map(([name, image, category, price, compareAt, stock], pi) => {
      const id = `${storeId}_p${pi + 1}`;
      const sku = `${skuPart(storeData.slug)}-${String(pi + 1).padStart(3, "0")}`;
      const options = variantSeeds[name] ?? [];
      const combos = options.length ? combinations(options) : [];
      // distribui o estoque entre as variações, deixando algumas zeradas
      const variants = combos.map((combo, vi) => ({
        id: `${id}_v${vi + 1}`,
        options: combo,
        sku: `${sku}-${Object.values(combo).map(skuPart).join("-")}`,
        stock: rand() < 0.2 ? 0 : Math.max(0, Math.round((stock / combos.length) * (0.5 + rand()))),
        price: variantPrices[name]?.[Object.values(combo)[0]] ?? null,
      }));
      // "preço de" antigo vira preço normal + promoção ativa; a jaqueta termina em 3 dias
      const promo = compareAt ? { price, startsAt: null, endsAt: name.startsWith("Jaqueta") ? new Date(now + 3 * day).toISOString() : null } : null;
      return {
        id,
        storeId,
        name,
        description: `${name} — selecionado com cuidado pela equipe ${storeData.name}. Qualidade garantida e troca fácil em até 30 dias.`,
        price: compareAt ?? price,
        promo,
        sku,
        trackStock: true,
        stock: variants.length ? variants.reduce((s, v) => s + v.stock, 0) : stock,
        lowStockThreshold: 5,
        options,
        variants,
        category,
        image,
        images: [],
        showcase: null,
        specs: [],
        active: true,
        createdAt: new Date(now - (120 - pi * 5) * day).toISOString(),
      };
    });
    db.products.push(...products);
    for (const p of products) {
      const entries = p.variants.length ? p.variants.map((v) => ({ variantId: v.id as string | null, qty: v.stock })) : [{ variantId: null, qty: p.stock }];
      for (const e of entries)
        db.stockMovements.push({ id: `sm_${p.id}_${e.variantId ?? "base"}`, storeId, productId: p.id, variantId: e.variantId, delta: e.qty, balanceAfter: e.qty, reason: "initial", note: "Estoque inicial", actor: storeData.ownerName, at: p.createdAt });
    }

    const customerCount = seed.status === "suspended" ? 4 : 10 + Math.floor(rand() * 14);
    const customers: Customer[] = Array.from({ length: customerCount }, (_, ci) => {
      const first = pick(firstNames);
      const last = pick(lastNames);
      const city = pick(cities);
      const [cityName, state] = city.split(", ");
      const createdAt = new Date(now - Math.floor(rand() * 90) * day).toISOString();
      return {
        id: `${storeId}_c${ci + 1}`,
        storeId,
        userId: null,
        provider: null,
        name: `${first} ${last}`,
        email: `${first}.${last}${ci}@email.com`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),
        phone: `(11) 9${Math.floor(1000 + rand() * 8999)}-${Math.floor(1000 + rand() * 8999)}`,
        city,
        cpf: generateCpf(rand),
        birthDate: null,
        address: { cep: "01310-100", street: "Rua Exemplo", number: String(Math.floor(rand() * 900) + 10), complement: "", district: "Centro", city: cityName, state },
        acceptedTermsAt: createdAt,
        termsVersion: db.stores[si].termsUpdatedAt,
        marketingOptIn: rand() < 0.6,
        createdAt,
      };
    });
    db.customers.push(...customers);

    // Volume de pedidos varia por loja; lojas maiores vendem mais e com tendência de crescimento.
    const volume = { "aurora-moda": 70, "cafe-do-ze": 55, techlab: 85, "verde-vivo": 12, "bike-urbana": 6 }[seed.slug] ?? 20;
    let number = 1000;
    for (let i = 0; i < volume; i++) {
      // Distribuição enviesada para dias recentes => gráfico de crescimento.
      const ageDays = Math.floor(Math.pow(rand(), 1.4) * 60);
      const createdAt = new Date(now - ageDays * day - Math.floor(rand() * day));
      const itemCount = 1 + Math.floor(rand() * 3);
      const items = Array.from({ length: itemCount }, () => {
        const p = pick(products);
        const v = p.variants.length ? pick(p.variants) : null;
        return { productId: p.id, variantId: v?.id ?? null, variantLabel: v ? variantLabel(v) : null, name: p.name, image: p.image, imageUrl: null, price: priceOf(p, v).price, qty: 1 + Math.floor(rand() * 2) };
      });
      const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
      const shipping = seed.freeShippingOver && subtotal >= seed.freeShippingOver ? 0 : seed.shippingFlat;
      let status: OrderStatus;
      if (ageDays > 10) status = rand() < 0.08 ? "cancelled" : "delivered";
      else if (ageDays > 4) status = rand() < 0.5 ? "shipped" : "delivered";
      else status = pick<OrderStatus>(["pending", "paid", "paid", "shipped"]);
      const customer = pick(customers);
      const orderId = `${storeId}_o${i + 1}`;
      const method = pick<PaymentMethod>(["pix", "pix", "card", "card", "boleto"]);
      const total = round(subtotal + shipping);
      // Pedidos pendentes recentes: metade já tem comprovante enviado aguardando análise do lojista.
      const inReview = status === "pending" && rand() < 0.6;
      const paymentStatus = status === "pending" ? (inReview ? "in_review" : "awaiting") : status === "cancelled" ? "cancelled" : "approved";
      const receiptAt = new Date(createdAt.getTime() + 20 * 60_000);
      if (inReview) db.files.set(`f_${orderId}`, { name: "comprovante-pix.svg", mimeType: "image/svg+xml", data: sampleReceipt(total, customer.name, receiptAt) });
      db.payments.push({
        id: `pay_${orderId}`,
        orderId,
        storeId,
        provider: "manual",
        method: status === "pending" && method === "card" ? "pix" : method,
        amount: total,
        status: paymentStatus,
        receipt: inReview ? { fileId: `f_${orderId}`, fileName: "comprovante-pix.svg", mimeType: "image/svg+xml", size: 2048, uploadedAt: receiptAt.toISOString() } : null,
        submittedAt: inReview ? receiptAt.toISOString() : null,
        reviewedAt: paymentStatus === "approved" ? receiptAt.toISOString() : null,
        reviewedBy: paymentStatus === "approved" ? storeData.ownerName : null,
        rejectionReason: null,
        externalId: null,
        createdAt: createdAt.toISOString(),
      });
      db.orders.push({
        id: orderId,
        number: ++number,
        storeId,
        customerId: customer.id,
        items,
        subtotal: round(subtotal),
        discount: 0,
        couponCode: null,
        shipping,
        total,
        status,
        paymentMethod: db.payments.at(-1)!.method,
        trackingCode: status === "shipped" || status === "delivered" ? `BR${Math.floor(1e8 + rand() * 9e8)}BR` : null,
        address: `Rua Exemplo, ${Math.floor(rand() * 900) + 10} — ${customer.city}`,
        createdAt: createdAt.toISOString(),
        updatedAt: createdAt.toISOString(),
      });
    }
  });

  const coupon = (storeId: string, code: string, type: Coupon["type"], value: number, extra: Partial<Coupon> = {}): Coupon => ({
    id: `cp_${code}`,
    storeId,
    code,
    type,
    value,
    minSubtotal: 0,
    startsAt: null,
    endsAt: null,
    maxUses: null,
    uses: 0,
    active: true,
    createdAt: new Date(now - 20 * day).toISOString(),
    ...extra,
  });
  db.coupons.push(
    coupon("st_1", "BEMVINDO10", "percent", 10, { uses: 14 }),
    coupon("st_1", "VERAO25", "percent", 25, { minSubtotal: 300, endsAt: new Date(now - 5 * day).toISOString(), uses: 31 }),
    coupon("st_2", "FRETEGRATIS", "free_shipping", 0, { minSubtotal: 100, uses: 9 }),
    coupon("st_3", "TECH50", "fixed", 50, { minSubtotal: 500, maxUses: 100, uses: 42 }),
  );

  db.audit.push(
    { id: "a1", at: new Date(now - 2 * day).toISOString(), actor: "admin", action: "Loja suspensa por inadimplência", target: "bike-urbana" },
    { id: "a2", at: new Date(now - 5 * day).toISOString(), actor: "admin", action: "Plano alterado para Enterprise", target: "techlab" },
    { id: "a3", at: new Date(now - 9 * day).toISOString(), actor: "sistema", action: "Trial iniciado", target: "verde-vivo" },
  );

  return db;
}

export const round = (v: number) => Math.round(v * 100) / 100;
