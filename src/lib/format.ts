import type { CouponType, OrderStatus, PaymentMethod, PaymentStatus, StockReason, StoreStatus } from "./types";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlWhole = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export const money = (v: number) => brl.format(v);
export const compactNumber = (v: number) => compact.format(v);
/** Sem ",00" quando o valor é inteiro: "R$ 155.000". */
export const moneyShort = (v: number) => (Number.isInteger(v) ? brlWhole.format(v) : brl.format(v));

export const date = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export const pct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

export const orderStatusLabel: Record<OrderStatus, string> = {
  pending: "Aguardando pagamento",
  paid: "Pago",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

export const paymentLabel: Record<PaymentMethod, string> = {
  pix: "Pix",
  card: "Cartão",
  boleto: "Boleto",
};

export const paymentStatusLabel: Record<PaymentStatus, string> = {
  awaiting: "Aguardando pagamento",
  in_review: "Comprovante em análise",
  approved: "Pagamento aprovado",
  rejected: "Comprovante recusado",
  cancelled: "Cancelado",
};

export const stockReasonLabel: Record<StockReason, string> = {
  initial: "Estoque inicial",
  sale: "Venda",
  cancel: "Cancelamento",
  restock: "Entrada / reposição",
  adjustment: "Ajuste / contagem",
  loss: "Perda / avaria",
  return: "Devolução",
};

export const couponTypeLabel: Record<CouponType, string> = { percent: "% de desconto", fixed: "Valor fixo", free_shipping: "Frete grátis" };

export const fileSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

export const storeStatusLabel: Record<StoreStatus, string> = {
  active: "Ativa",
  trial: "Trial",
  suspended: "Suspensa",
};

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
