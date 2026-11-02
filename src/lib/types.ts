// Modelos de domínio. Os nomes de campos foram pensados para mapear 1:1
// com as tabelas do Supabase (camelCase aqui, snake_case no banco).

export type PlanId = "starter" | "pro" | "enterprise";

export interface Plan {
  id: PlanId;
  name: string;
  priceMonthly: number;
  feePercent: number; // taxa sobre cada venda
  maxProducts: number | null; // null = ilimitado
  features: string[];
}

export type StoreStatus = "active" | "trial" | "suspended";

export interface Store {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  category: string;
  logo: string; // emoji — usado quando não há logoUrl
  logoUrl: string | null;
  coverUrl: string | null; // foto de capa da vitrine
  about: string; // "Sobre a loja"
  whatsapp: string | null;
  instagram: string | null;
  brandColor: string; // hex
  ownerName: string;
  ownerEmail: string;
  planId: PlanId;
  status: StoreStatus;
  shippingFlat: number;
  freeShippingOver: number | null;
  pixKey: string; // chave Pix que recebe os pagamentos (modo manual)
  customTerms: string | null; // termos próprios do lojista; null = modelo padrão
  termsUpdatedAt: string; // versão dos termos — mudou, o cliente precisa aceitar de novo
  createdAt: string;
}

// Opções de variação (ex.: Tamanho: P/M/G · Cor: Preto/Branco). Máx. 3 por produto.
export interface ProductOption {
  name: string;
  values: string[];
}

// Uma combinação vendável das opções, com estoque e (opcional) preço próprios.
export interface Variant {
  id: string;
  options: Record<string, string>; // { Tamanho: "M", Cor: "Preto" }
  sku: string;
  stock: number;
  price: number | null; // null = usa o preço do produto
}

// Preço promocional com período opcional (sem datas = vale até ser removida).
export interface Promo {
  price: number;
  startsAt: string | null;
  endsAt: string | null;
}

// Showroom 360°: fotos do produto em volta dele. O sistema monta o giro a partir delas.
export const SHOWCASE_RING = ["front", "frontRight", "right", "backRight", "back", "backLeft", "left", "frontLeft"] as const;
export type ShowcaseRingView = (typeof SHOWCASE_RING)[number];
export type ShowcaseView = ShowcaseRingView | "top" | "bottom";

// Cenários do estúdio fotográfico (o veículo é recortado da foto e aplicado sobre eles).
export const STUDIO_SCENES = ["dark", "beige", "white", "brand", "logo"] as const;
export type StudioScene = (typeof STUDIO_SCENES)[number];

/** Arquivos de origem de uma vista: foto original, recorte (PNG transparente) e versão quadrada para o catálogo. */
export interface ShowcaseSource {
  original: string;
  cutout: string | null;
  stage?: string | null; // veículo enquadrado sem fundo (imagem do showroom quando o estúdio está ligado)
  square: string | null;
  // onde o veículo estava na foto original (px), para converter pontos marcados entre a foto e o estúdio
  frame?: { w: number; h: number; x: number; y: number; cw: number; ch: number } | null;
}

export const HOTSPOT_KINDS = ["engine", "wheels", "interior", "trunk", "dashboard", "lights", "custom"] as const;
export type HotspotKind = (typeof HOTSPOT_KINDS)[number];

/** Ponto clicável sobre uma foto do giro, que abre fotos reais de um detalhe (motor, pneus, interior…). */
export interface Hotspot {
  id: string;
  view: ShowcaseRingView;
  x: number; // % da foto
  y: number;
  kind: HotspotKind;
  label: string;
  note: string;
  photos: string[];
}

export interface Showcase {
  views: Partial<Record<ShowcaseView, string>>; // URLs das fotos por ângulo
  headlights: { x: number; y: number }[]; // posição dos faróis na foto da frente (% da imagem)
  intro: boolean; // animação de chegada com os faróis piscando
  studio?: StudioScene | null; // cenário aplicado a todas as vistas (null = fotos como enviadas)
  sources?: Partial<Record<ShowcaseView, ShowcaseSource>>;
  hotspots?: Hotspot[];
}

// Ficha técnica livre (ex.: Ano: 2023 · Motor: 1.4 TSI).
export interface Spec {
  label: string;
  value: string;
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  description: string;
  price: number; // preço normal
  promo: Promo | null;
  sku: string;
  trackStock: boolean; // false = sob encomenda / sem limite
  stock: number; // sem variações: estoque do produto; com variações: soma das variações
  lowStockThreshold: number;
  options: ProductOption[];
  variants: Variant[];
  category: string;
  image: string; // emoji — usado quando não há fotos
  images: string[]; // URLs das fotos; a primeira é a principal
  showcase: Showcase | null;
  specs: Spec[];
  active: boolean;
  createdAt: string;
}

export type StockReason = "initial" | "sale" | "cancel" | "restock" | "adjustment" | "loss" | "return";

export interface StockMovement {
  id: string;
  storeId: string;
  productId: string;
  variantId: string | null;
  delta: number;
  balanceAfter: number;
  reason: StockReason;
  note: string;
  actor: string;
  at: string;
}

export type CouponType = "percent" | "fixed" | "free_shipping";

export interface Coupon {
  id: string;
  storeId: string;
  code: string;
  type: CouponType;
  value: number; // % ou R$ (ignorado em free_shipping)
  minSubtotal: number;
  startsAt: string | null;
  endsAt: string | null;
  maxUses: number | null;
  uses: number;
  active: boolean;
  createdAt: string;
}

export type AuthProvider = "google" | "microsoft" | "apple";

// Identidade global (vem do login social). Os dados por loja ficam em Customer.
export interface User {
  id: string;
  email: string;
  name: string;
  provider: AuthProvider;
  createdAt: string;
}

export interface Address {
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
}

export interface Customer {
  id: string;
  storeId: string;
  userId: string | null;
  provider: AuthProvider | null;
  name: string;
  email: string;
  phone: string;
  city: string;
  cpf: string | null;
  birthDate: string | null;
  address: Address | null;
  acceptedTermsAt: string | null;
  termsVersion: string | null;
  marketingOptIn: boolean;
  createdAt: string;
}

export type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled";
export type PaymentMethod = "pix" | "card" | "boleto";

export interface OrderItem {
  productId: string;
  variantId: string | null;
  variantLabel: string | null; // "M / Preto"
  name: string;
  image: string;
  imageUrl: string | null;
  price: number;
  qty: number;
}

export interface Order {
  id: string;
  number: number;
  storeId: string;
  customerId: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  couponCode: string | null;
  shipping: number;
  total: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  trackingCode: string | null;
  address: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentStatus = "awaiting" | "in_review" | "approved" | "rejected" | "cancelled";
export type PaymentProviderId = "manual" | "mercadopago";

export interface Receipt {
  fileId: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

// Um pagamento por pedido. No modo manual o cliente envia o comprovante e o lojista aprova;
// com Mercado Pago o status passa a vir do webhook (externalId = id do pagamento no MP).
export interface Payment {
  id: string;
  orderId: string;
  storeId: string;
  provider: PaymentProviderId;
  method: PaymentMethod;
  amount: number;
  status: PaymentStatus;
  receipt: Receipt | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  externalId: string | null;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
}

export type InsightLevel = "info" | "success" | "warning" | "danger";

export interface Insight {
  level: InsightLevel;
  title: string;
  detail: string;
  href?: string;
}
