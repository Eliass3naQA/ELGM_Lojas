"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, ExternalLink, FileText, Loader2, XCircle } from "lucide-react";
import { api } from "@/lib/api-client";
import { dateTime, fileSize, money, paymentLabel } from "@/lib/format";
import type { Payment } from "@/lib/types";
import { Button, Card, CardHeader, Field, PaymentStatusBadge, Textarea } from "../ui";

const QUICK_REASONS = ["Valor diferente do pedido", "Comprovante ilegível", "Pagamento não identificado na conta", "Comprovante de outro pedido"];

export function PaymentReview({ slug, payment }: { slug: string; payment: Payment }) {
  const router = useRouter();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const receiptUrl = `/api/stores/${slug}/orders/${payment.orderId}/receipt?painel=1`;
  const canReview = payment.status === "in_review" || payment.status === "awaiting";

  async function review(approve: boolean) {
    if (approve && !payment.receipt && !confirm("Este pedido não tem comprovante. Aprovar mesmo assim (ex.: você conferiu o extrato)?")) return;
    setLoading(approve ? "approve" : "reject");
    setError(null);
    try {
      await api(`/api/stores/${slug}/orders/${payment.orderId}/review`, "POST", { approve, reason });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card>
      <CardHeader title="Pagamento" description={`${paymentLabel[payment.method]} · ${money(payment.amount)} · modo manual`} action={<PaymentStatusBadge status={payment.status} />} />
      <div className="space-y-4 p-5">
        {payment.receipt ? (
          <div className="overflow-hidden rounded-xl border border-zinc-200">
            {payment.receipt.mimeType.startsWith("image/") ? (
              <a href={receiptUrl} target="_blank" rel="noreferrer" className="block bg-zinc-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={receiptUrl} alt="Comprovante enviado pelo cliente" className="mx-auto max-h-80 object-contain" />
              </a>
            ) : (
              <div className="flex items-center gap-3 bg-zinc-50 p-4">
                <FileText className="size-8 text-zinc-400" />
                <span className="text-sm">Documento PDF</span>
              </div>
            )}
            <a href={receiptUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 border-t border-zinc-100 px-4 py-2.5 text-xs text-zinc-600 hover:bg-zinc-50">
              <ExternalLink className="size-3.5" />
              <span className="min-w-0 flex-1 truncate">{payment.receipt.fileName}</span>
              <span className="text-zinc-400">
                {fileSize(payment.receipt.size)} · {dateTime(payment.receipt.uploadedAt)}
              </span>
            </a>
          </div>
        ) : (
          <p className="rounded-xl bg-zinc-50 p-4 text-sm text-zinc-500">
            {payment.status === "awaiting" ? "O cliente ainda não enviou o comprovante." : "Nenhum comprovante anexado."}
          </p>
        )}

        {payment.status === "approved" && (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="size-4" /> Aprovado por {payment.reviewedBy} em {payment.reviewedAt && dateTime(payment.reviewedAt)}. Pode enviar o pedido.
          </p>
        )}
        {payment.status === "rejected" && (
          <p className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            <XCircle className="mt-0.5 size-4 shrink-0" /> Recusado: {payment.rejectionReason}. Aguardando novo comprovante do cliente.
          </p>
        )}

        {canReview && !rejecting && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={!!loading} onClick={() => setRejecting(true)}>
              <XCircle className="size-4 text-red-600" /> Recusar
            </Button>
            <Button disabled={!!loading} onClick={() => review(true)} className="bg-emerald-600 hover:bg-emerald-500">
              {loading === "approve" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Aprovar
            </Button>
          </div>
        )}
        {canReview && rejecting && (
          <div className="space-y-3 rounded-xl bg-zinc-50 p-4">
            <Field label="Motivo (o cliente verá esta mensagem)">
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-16" autoFocus />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REASONS.map((r) => (
                <button key={r} type="button" onClick={() => setReason(r)} className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs text-zinc-600 hover:border-zinc-300">
                  {r}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setRejecting(false)}>
                Voltar
              </Button>
              <Button variant="danger" className="flex-1" disabled={!reason.trim() || !!loading} onClick={() => review(false)}>
                {loading === "reject" && <Loader2 className="size-4 animate-spin" />} Recusar comprovante
              </Button>
            </div>
          </div>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
    </Card>
  );
}
