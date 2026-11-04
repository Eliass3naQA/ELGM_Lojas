"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { money, moneyShort } from "@/lib/format";
import { cn } from "../ui";

const TERMS = [12, 24, 36, 48, 60];
const DEFAULT_RATE = 1.79; // % ao mês: só o ponto de partida, o comprador pode alterar
const DEFAULT_DOWN = 0.2;

/** Parcela fixa (Tabela Price). */
export function installment(financed: number, months: number, monthlyRate: number) {
  if (financed <= 0) return 0;
  if (monthlyRate <= 0) return financed / months;
  return (financed * monthlyRate) / (1 - (1 + monthlyRate) ** -months);
}

export function FinanceSimulator({ open, onClose, name, price, whatsapp }: { open: boolean; onClose: () => void; name: string; price: number; whatsapp: string | null }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [down, setDown] = useState(Math.round(price * DEFAULT_DOWN));
  const [months, setMonths] = useState(48);
  const [rate, setRate] = useState(DEFAULT_RATE);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const entry = Math.min(price, Math.max(0, down));
  const financed = price - entry;
  const validRate = Math.min(10, Math.max(0, Number.isFinite(rate) ? rate : 0));
  const monthly = installment(financed, months, validRate / 100);
  const total = entry + monthly * months;
  const message = `Olá! Tenho interesse no ${name} (${moneyShort(price)}). Simulei entrada de ${moneyShort(entry)} em ${months}x de ${money(monthly)}, com taxa de ${validRate.toLocaleString("pt-BR")}% a.m. Podemos conversar?`;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="simulador-titulo"
      className="pdp-dialog m-auto w-[min(480px,calc(100vw-24px))] rounded-[28px] p-0"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="simulador-titulo" className="text-xl font-semibold tracking-tight">Simular financiamento</h2>
            <p className="pdp-muted mt-0.5 truncate text-sm">{name}</p>
          </div>
          <button type="button" onClick={onClose} className="pdp-icon-btn size-10 shrink-0" aria-label="Fechar simulador">
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 rounded-2xl bg-white/[0.07] p-4 text-center">
          <p className="pdp-muted text-sm">{months} parcelas de</p>
          <p className="text-4xl font-semibold tracking-tight tabular-nums">{money(monthly)}</p>
        </div>

        <label className="mt-5 block">
          <span className="flex items-baseline justify-between text-sm font-medium">
            Entrada <output className="tabular-nums">{moneyShort(entry)} <span className="pdp-muted font-normal">({price > 0 ? Math.round((entry / price) * 100) : 0}%)</span></output>
          </span>
          <input type="range" min={0} max={price} step={Math.max(1, Math.round(price / 200))} value={entry} onChange={(e) => setDown(Number(e.target.value))} className="pdp-range mt-2 w-full" />
        </label>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium">Prazo</legend>
          <div className="mt-2 grid grid-cols-5 gap-1.5">
            {TERMS.map((t) => (
              <button key={t} type="button" onClick={() => setMonths(t)} aria-pressed={months === t} className={cn("pdp-option h-10 text-sm tabular-nums", months === t && "pdp-option-active")}>
                {t}x
              </button>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 flex items-center justify-between gap-3 text-sm font-medium">
          Taxa de juros ao mês (%)
          <input
            type="number"
            min={0}
            max={10}
            step={0.01}
            value={Number.isNaN(rate) ? "" : rate}
            onChange={(e) => setRate(e.target.valueAsNumber)}
            className="pdp-input h-10 w-24 rounded-xl px-3 text-right tabular-nums"
          />
        </label>

        <dl className="mt-4 space-y-1.5 border-t border-white/10 pt-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="pdp-muted">Valor financiado</dt>
            <dd className="tabular-nums">{money(financed)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="pdp-muted">Total com entrada e juros</dt>
            <dd className="tabular-nums">{money(total)}</dd>
          </div>
        </dl>

        <p className="pdp-muted mt-3 text-xs leading-relaxed">Simulação ilustrativa, sem IOF e outras tarifas. A taxa e a aprovação dependem da análise de crédito.</p>

        {whatsapp && (
          <a href={`https://wa.me/55${whatsapp}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer" className="pdp-btn-light mt-4 flex h-12 items-center justify-center gap-2 rounded-full text-sm font-semibold">
            <MessageCircle className="size-4" /> Enviar simulação no WhatsApp
          </a>
        )}
      </div>
    </dialog>
  );
}
