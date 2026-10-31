"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Check, CheckCircle2, Clock, Copy, FileUp, Loader2, Paperclip, XCircle } from "lucide-react";
import { api } from "@/lib/api-client";
import { date, fileSize, money } from "@/lib/format";
import type { PaymentInstructions } from "@/lib/payments/provider";
import type { Payment } from "@/lib/types";
import { Button, Card, cn } from "../ui";

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <div className="mt-1 flex gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-700">{value}</code>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 px-3 py-2 text-xs"
          onClick={() => {
            navigator.clipboard?.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
    </div>
  );
}

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

function ReceiptUpload({ slug, orderId, label }: { slug: string; orderId: string; label: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(f: File | undefined) {
    setError(null);
    if (!f) return;
    if (!ACCEPT.split(",").includes(f.type)) return setError("Envie uma imagem (JPG, PNG, WEBP) ou PDF.");
    if (f.size > 5 * 1024 * 1024) return setError("O arquivo deve ter no máximo 5 MB.");
    setFile(f);
    setPreview(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }

  async function send() {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setLoading(true);
    try {
      await api(`/api/stores/${slug}/orders/${orderId}/receipt`, "POST", form);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          pick(e.dataTransfer.files[0]);
        }}
        className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-zinc-200 px-4 py-6 text-center transition hover:border-zinc-300 hover:bg-zinc-50"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Prévia do comprovante" className="max-h-40 rounded-lg" />
        ) : file ? (
          <Paperclip className="size-6 text-zinc-400" />
        ) : (
          <FileUp className="size-6 text-zinc-400" />
        )}
        <span className="text-sm font-medium text-zinc-700">{file ? `${file.name} · ${fileSize(file.size)}` : "Clique ou arraste o comprovante aqui"}</span>
        <span className="text-xs text-zinc-400">JPG, PNG, WEBP ou PDF · até 5 MB</span>
      </button>
      <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Button type="button" variant="brand" className="w-full py-3" disabled={!file || loading} onClick={send}>
        {loading && <Loader2 className="size-4 animate-spin" />} {label}
      </Button>
    </div>
  );
}

export function PaymentPanel({ slug, orderId, payment, instructions }: { slug: string; orderId: string; payment: Payment; instructions: PaymentInstructions | null }) {
  if (payment.status === "approved")
    return (
      <Card className="flex items-center gap-3 p-5">
        <CheckCircle2 className="size-6 text-emerald-500" />
        <div>
          <p className="font-medium">Pagamento aprovado</p>
          <p className="text-sm text-zinc-500">A loja já está preparando seu pedido para envio.</p>
        </div>
      </Card>
    );

  if (payment.status === "cancelled") return null;

  if (payment.status === "in_review")
    return (
      <Card className="flex items-center gap-3 p-5">
        <Clock className="size-6 text-amber-500" />
        <div>
          <p className="font-medium">Comprovante enviado — em análise</p>
          <p className="text-sm text-zinc-500">
            Recebemos seu comprovante{payment.receipt ? ` (${payment.receipt.fileName})` : ""}. Você será avisado assim que a loja confirmar o pagamento.
          </p>
        </div>
      </Card>
    );

  // awaiting | rejected → mostrar instruções e upload
  return (
    <Card className="overflow-hidden">
      {payment.status === "rejected" && (
        <div className="flex gap-3 bg-red-50 p-4 text-sm text-red-800">
          <XCircle className="size-5 shrink-0" />
          <div>
            <p className="font-medium">Comprovante recusado pela loja</p>
            <p className="mt-0.5">Motivo: {payment.rejectionReason}</p>
            <p className="mt-0.5 text-red-700">Confira o pagamento e envie um novo comprovante.</p>
          </div>
        </div>
      )}
      <div className="grid gap-6 p-5 md:grid-cols-[auto_1fr]">
        {instructions?.pix && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={instructions.pix.qrDataUrl} alt="QR Code Pix" className="mx-auto size-48 rounded-xl border border-zinc-100 p-2" />
            <div className="min-w-0 space-y-4">
              <div>
                <p className="font-semibold">Pague {money(payment.amount)} com Pix</p>
                <p className="text-sm text-zinc-500">Abra o app do seu banco, escaneie o QR Code ou use o copia e cola.</p>
              </div>
              <CopyField label="Pix copia e cola" value={instructions.pix.payload} />
              <CopyField label="Chave Pix" value={instructions.pix.key} />
            </div>
          </>
        )}
        {instructions?.boleto && (
          <div className="min-w-0 space-y-4 md:col-span-2">
            <div>
              <p className="font-semibold">Pague o boleto de {money(payment.amount)}</p>
              <p className="text-sm text-zinc-500">Vencimento: {date(instructions.boleto.dueDate)}. Pague no app do banco ou em lotéricas.</p>
            </div>
            <CopyField label="Linha digitável (simulada)" value={instructions.boleto.digitableLine} />
          </div>
        )}
      </div>
      <div className={cn("border-t border-zinc-100 bg-zinc-50/50 p-5")}>
        <p className="mb-3 text-sm font-medium">Já pagou? Envie o comprovante para a loja liberar seu pedido.</p>
        <ReceiptUpload slug={slug} orderId={orderId} label={payment.status === "rejected" ? "Enviar novo comprovante" : "Informar pagamento"} />
      </div>
    </Card>
  );
}
