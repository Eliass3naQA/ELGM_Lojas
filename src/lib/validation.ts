import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { emailMatchesProvider } from "./auth/providers";
import { formatCpf, isValidCpf, onlyDigits } from "./cpf";
import { DomainError, mediaUrlPrefix } from "./data/repository";
import { HOTSPOT_KINDS, SHOWCASE_RING, STUDIO_SCENES } from "./types";

// mensagens de validação em português
z.config(z.locales.pt());

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida");
// só aceitamos fotos enviadas pela própria plataforma (bucket "media" do Supabase; nada de URLs externas)
const imageUrl = z.string().refine((v) => {
  if (!v.startsWith(mediaUrlPrefix())) return false;
  return /^[0-9a-f-]{36}\/img_[a-z0-9]+\.(jpg|png|webp)$/.test(v.slice(mediaUrlPrefix().length));
}, "Imagem inválida");
const isoDate = z.iso.datetime({ offset: true }).nullable();
const money = z.number().nonnegative().max(1_000_000);

export const storeCreateSchema = z.object({
  name: z.string().min(2).max(60),
  slug: z.string().min(3).max(40).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens"),
  tagline: z.string().max(120).default(""),
  category: z.string().min(2).max(40),
  logo: z.string().min(1).max(8).default("🛍️"),
  brandColor: hex.default("#6366f1"),
  ownerName: z.string().min(2).max(80),
  ownerEmail: z.string().email(),
  planId: z.enum(["starter", "pro", "enterprise"]),
});

export const storeUpdateSchema = z
  .object({
    name: z.string().min(2).max(60),
    tagline: z.string().max(120),
    category: z.string().min(2).max(40),
    logo: z.string().min(1).max(8),
    brandColor: hex,
    shippingFlat: z.number().min(0),
    freeShippingOver: z.number().min(0).nullable(),
    pixKey: z.string().trim().min(3, "Informe a chave Pix").max(77),
    logoUrl: imageUrl.nullable(),
    coverUrl: imageUrl.nullable(),
    about: z.string().max(1000),
    whatsapp: z
      .string()
      .transform((v) => v.replace(/\D/g, ""))
      .refine((v) => v.length === 0 || v.length === 10 || v.length === 11, "WhatsApp inválido — use DDD + número")
      .transform((v) => v || null)
      .nullable(),
    instagram: z
      .string()
      .transform((v) => v.trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/$/, ""))
      .refine((v) => /^[A-Za-z0-9._]{0,30}$/.test(v), "Usuário do Instagram inválido")
      .transform((v) => v || null)
      .nullable(),
    customTerms: z.string().max(20000).nullable(),
    // somente backoffice:
    slug: z.string().min(3).max(40).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use apenas letras minúsculas, números e hífens"),
    ownerName: z.string().trim().min(2).max(80),
    ownerEmail: z.string().trim().toLowerCase().email(),
    planId: z.enum(["starter", "pro", "enterprise"]),
    status: z.enum(["active", "trial", "suspended"]),
  })
  .partial();

const optionSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à variação").max(30),
  values: z.array(z.string().trim().min(1).max(30)).min(1, "Adicione ao menos um valor à variação").max(30),
});

export const productSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do produto").max(120),
  description: z.string().max(5000).default(""),
  category: z.string().trim().min(1, "Informe a categoria").max(40),
  price: z.number().positive("Informe o preço").max(1_000_000),
  promo: z.object({ price: z.number().positive("Informe o preço promocional"), startsAt: isoDate, endsAt: isoDate }).nullable().default(null),
  sku: z.string().trim().max(40).default(""),
  trackStock: z.boolean().default(true),
  stock: z.number().int().min(0, "Estoque não pode ser negativo").max(1_000_000).default(0),
  lowStockThreshold: z.number().int().min(0).max(10_000).default(5),
  options: z.array(optionSchema).max(3, "Use no máximo 3 tipos de variação").default([]),
  variants: z
    .array(
      z.object({
        id: z.string().optional(),
        options: z.record(z.string(), z.string()),
        sku: z.string().trim().max(40).default(""),
        stock: z.number().int().min(0).max(1_000_000),
        price: z.number().positive().max(1_000_000).nullable().default(null),
      }),
    )
    .max(200, "Máximo de 200 combinações por produto")
    .default([]),
  image: z.string().min(1).max(8).default("📦"),
  images: z.array(imageUrl).max(10, "Máximo de 10 fotos por produto").default([]),
  showcase: z
    .object({
      views: z.partialRecord(z.enum([...SHOWCASE_RING, "top", "bottom"]), imageUrl),
      headlights: z.array(z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) })).max(4).default([]),
      intro: z.boolean().default(true),
      studio: z.enum(STUDIO_SCENES).nullable().default(null),
      sources: z
        .partialRecord(
          z.enum([...SHOWCASE_RING, "top", "bottom"]),
          z.object({
            original: imageUrl,
            cutout: imageUrl.nullable(),
            stage: imageUrl.nullable().default(null),
            square: imageUrl.nullable(),
            frame: z
              .object({ w: z.number().positive(), h: z.number().positive(), x: z.number().min(0), y: z.number().min(0), cw: z.number().positive(), ch: z.number().positive() })
              .nullable()
              .default(null),
          }),
        )
        .default({}),
      hotspots: z
        .array(
          z.object({
            id: z.string().min(1).max(40),
            view: z.enum(SHOWCASE_RING),
            x: z.number().min(0).max(100),
            y: z.number().min(0).max(100),
            kind: z.enum(HOTSPOT_KINDS),
            label: z.string().trim().min(1, "Dê um nome ao ponto interativo").max(40),
            note: z.string().trim().max(500).default(""),
            photos: z.array(imageUrl).max(12, "Máximo de 12 fotos por ponto").default([]),
          }),
        )
        .max(16, "Máximo de 16 pontos interativos")
        .default([]),
    })
    .nullable()
    .default(null)
    .refine((s) => !s || SHOWCASE_RING.filter((v) => s.views[v]).length >= 2, "O showroom 360° precisa de pelo menos 2 fotos ao redor do produto (ex.: frente e traseira)."),
  specs: z
    .array(z.object({ label: z.string().trim().min(1).max(40), value: z.string().trim().min(1).max(120) }))
    .max(30, "Máximo de 30 itens na ficha técnica")
    .default([]),
  active: z.boolean().default(true),
});

export const productPatchSchema = z.object({
  active: z.boolean().optional(),
  price: z.number().positive().optional(),
  promo: z.object({ price: z.number().positive(), startsAt: isoDate, endsAt: isoDate }).nullable().optional(),
});

export const bulkProductsSchema = z.object({
  ids: z.array(z.string()).min(1, "Selecione ao menos um produto").max(500),
  action: z.enum(["activate", "deactivate", "delete"]),
});

export const stockAdjustSchema = z.object({
  productId: z.string(),
  variantId: z.string().nullable().default(null),
  mode: z.enum(["add", "remove", "set"]),
  qty: z.number().int().min(0).max(1_000_000),
  reason: z.enum(["restock", "adjustment", "loss", "return"]),
  note: z.string().trim().max(200).default(""),
});

const couponFields = {
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9_-]{3,20}$/, "Use de 3 a 20 letras, números, - ou _"),
  type: z.enum(["percent", "fixed", "free_shipping"]),
  value: money,
  minSubtotal: money,
  startsAt: isoDate,
  endsAt: isoDate,
  maxUses: z.number().int().positive().nullable(),
  active: z.boolean(),
};

export const couponSchema = z.object({
  ...couponFields,
  value: couponFields.value.default(0),
  minSubtotal: couponFields.minSubtotal.default(0),
  startsAt: couponFields.startsAt.default(null),
  endsAt: couponFields.endsAt.default(null),
  maxUses: couponFields.maxUses.default(null),
  active: couponFields.active.default(true),
});

// Sem defaults: no zod 4, .partial() ainda aplica .default() e sobrescreveria campos não enviados.
export const couponPatchSchema = z.object(couponFields).partial();

export const couponCheckSchema = z.object({ code: z.string().trim().min(1, "Digite o cupom"), subtotal: money });

// Dados do comprador vêm do perfil logado; o checkout só envia itens e forma de pagamento.
// Cartão entra junto com a integração do Mercado Pago.
export const checkoutSchema = z.object({
  items: z
    .array(z.object({ productId: z.string(), variantId: z.string().nullable().default(null), qty: z.number().int().min(1).max(99) }))
    .min(1, "Carrinho vazio")
    .max(50),
  paymentMethod: z.enum(["pix", "boleto"]),
  couponCode: z.string().trim().max(20).nullable().default(null),
});

export const mockLoginSchema = z
  .object({
    provider: z.enum(["google", "microsoft", "apple"]),
    email: z.string().trim().toLowerCase().email("E-mail inválido"),
    name: z.string().trim().min(2, "Informe seu nome"),
  })
  .refine((v) => emailMatchesProvider(v.email, v.provider), { message: "Este e-mail não pertence a esse provedor.", path: ["email"] });

export const profileSchema = z.object({
  name: z.string().trim().min(3, "Informe seu nome completo").max(120),
  cpf: z.string().refine(isValidCpf, "CPF inválido").transform(formatCpf),
  phone: z
    .string()
    .transform(onlyDigits)
    .refine((v) => v.length === 10 || v.length === 11, "Telefone inválido — use DDD + número"),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .refine((v) => !v || new Date(v) < new Date(), "Data de nascimento inválida"),
  address: z.object({
    cep: z.string().transform(onlyDigits).refine((v) => v.length === 8, "CEP inválido").transform((v) => `${v.slice(0, 5)}-${v.slice(5)}`),
    street: z.string().trim().min(2, "Informe a rua"),
    number: z.string().trim().min(1, "Informe o número"),
    complement: z.string().trim().max(80).default(""),
    district: z.string().trim().min(2, "Informe o bairro"),
    city: z.string().trim().min(2, "Informe a cidade"),
    state: z.string().trim().toUpperCase().length(2, "UF inválida"),
  }),
  acceptTerms: z.literal(true, { error: "Você precisa aceitar os Termos e a Política de Privacidade" }),
  marketingOptIn: z.boolean().default(false),
});

export const reviewSchema = z.object({
  approve: z.boolean(),
  reason: z.string().max(300).optional(),
});

export const orderUpdateSchema = z.object({
  status: z.enum(["pending", "paid", "shipped", "delivered", "cancelled"]).optional(),
  trackingCode: z.string().max(40).optional(),
});

/** Envolve um handler de API convertendo erros de domínio/validação em respostas JSON. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      const data = await fn(...args);
      if (data instanceof Response) return data;
      return NextResponse.json(data ?? { ok: true });
    } catch (e) {
      if (e instanceof SyntaxError) return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
      if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "Dados inválidos", issues: e.issues }, { status: 422 });
      if (e instanceof DomainError) return NextResponse.json({ error: e.message }, { status: e.status });
      console.error(e);
      return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
  };
}
