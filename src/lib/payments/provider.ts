// Abstração de provedor de pagamento.
// Hoje: "manual" (Pix/boleto + comprovante analisado pelo lojista).
// Depois: implementar `mercadopagoProvider` com a mesma interface — o checkout cria a cobrança
// no MP, devolve o QR/ticket do MP e um webhook chama approvePayment() automaticamente.

import QRCode from "qrcode";
import type { Order, Payment, PaymentProviderId, Store } from "../types";
import { buildPixPayload } from "./pix";

export interface PaymentInstructions {
  pix?: { payload: string; qrDataUrl: string; key: string };
  boleto?: { digitableLine: string; dueDate: string };
  /** se true, o cliente precisa enviar comprovante para o lojista analisar */
  requiresReceipt: boolean;
}

export interface PaymentProvider {
  id: PaymentProviderId;
  getInstructions(order: Order, payment: Payment, store: Store): Promise<PaymentInstructions>;
}

export const manualProvider: PaymentProvider = {
  id: "manual",
  async getInstructions(order, payment, store) {
    if (payment.method === "pix") {
      const payload = buildPixPayload({ key: store.pixKey, name: store.name, city: "SAO PAULO", amount: payment.amount, txid: `PED${order.number}` });
      const qrDataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 240 });
      return { pix: { payload, qrDataUrl, key: store.pixKey }, requiresReceipt: true };
    }
    // Boleto simulado: linha digitável fictícia, determinística por pedido.
    const seed = (order.number * 7919 + Math.round(payment.amount * 100)).toString().padStart(10, "0");
    const amount = Math.round(payment.amount * 100).toString().padStart(10, "0");
    const due = new Date(new Date(order.createdAt).getTime() + 3 * 86_400_000);
    return {
      boleto: { digitableLine: `34191.79001 ${seed.slice(0, 5)}.${seed.slice(5)} 61234.567890 1 ${amount}`, dueDate: due.toISOString() },
      requiresReceipt: true,
    };
  },
};

export const providers: Record<PaymentProviderId, PaymentProvider | undefined> = {
  manual: manualProvider,
  mercadopago: undefined, // TODO(mercadopago)
};
