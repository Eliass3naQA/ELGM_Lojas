"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { VehicleSuggestion } from "@/lib/ai/vehicle-specs";
import { api } from "@/lib/api-client";
import { Button, Card, Input } from "../ui";

/** O vendedor informa modelo + ano e a IA sugere nome, categoria, ficha técnica e descrição para revisar. */
export function VehicleAssistant({ slug, onApply }: { slug: string; onApply: (s: VehicleSuggestion) => string }) {
  const [model, setModel] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear() - 2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ summary: string; note: string | null } | null>(null);
  const ready = !busy && model.trim().length >= 2 && year.length === 4;

  async function fill() {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const s = await api<VehicleSuggestion>(`/api/stores/${slug}/ai/vehicle-specs`, "POST", { model, year: Number(year) });
      setDone({ summary: onApply(s), note: s.note });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-800 p-5 text-white">
        <p className="flex items-center gap-2 font-medium">
          <Sparkles className="size-4 text-amber-300" /> Cadastro inteligente
        </p>
        <p className="mt-1 text-sm text-white/60">Informe o modelo e o ano. A IA preenche a ficha técnica de fábrica, a categoria e uma descrição para você revisar.</p>
        {/* fica dentro do formulário do produto: Enter aqui consulta a IA em vez de salvar o produto */}
        <div
          className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_auto]"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (ready) fill();
          }}
        >
          <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Ex.: Volkswagen Taos Highline 250 TSI" className="border-white/10 bg-white/10 text-white placeholder:text-white/40" aria-label="Modelo e versão" />
          <Input value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" className="border-white/10 bg-white/10 text-white" aria-label="Ano" />
          <Button type="button" onClick={fill} disabled={!ready} className="bg-white text-zinc-950 hover:bg-zinc-100">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} {busy ? "Consultando…" : "Preencher com IA"}
          </Button>
        </div>
      </div>
      {(error || done) && (
        <div className="space-y-1 p-4 text-sm">
          {error && <p className="text-red-600">{error}</p>}
          {done && (
            <>
              <p className="text-emerald-700">{done.summary}</p>
              {done.note && <p className="text-amber-700">Atenção: {done.note}</p>}
              <p className="text-xs text-zinc-500">São dados de fábrica sugeridos pela IA: confira, complete com quilometragem, cor e estado do veículo, e só então publique.</p>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
