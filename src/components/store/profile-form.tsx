"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { api } from "@/lib/api-client";
import { formatCpf, isValidCpf, onlyDigits } from "@/lib/cpf";
import type { Address, Customer } from "@/lib/types";
import { Button, Card, Field, Input } from "../ui";

const formatPhone = (v: string) => {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
const formatCep = (v: string) => onlyDigits(v).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");

const emptyAddress: Address = { cep: "", street: "", number: "", complement: "", district: "", city: "", state: "" };

export function ProfileForm({ slug, next, defaultName, customer, termsChanged }: { slug: string; next: string; defaultName: string; customer: Customer | null; termsChanged: boolean }) {
  const router = useRouter();
  const [cpf, setCpf] = useState(customer?.cpf ?? "");
  const [phone, setPhone] = useState(customer?.phone ? formatPhone(customer.phone) : "");
  const [addr, setAddr] = useState<Address>(customer?.address ?? emptyAddress);
  const [cepState, setCepState] = useState<"idle" | "loading" | "notfound">("idle");
  const [accept, setAccept] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) => setAddr((a) => ({ ...a, [k]: e.target.value }));
  const cpfInvalid = onlyDigits(cpf).length === 11 && !isValidCpf(cpf);

  async function lookupCep(value: string) {
    const cep = onlyDigits(value);
    if (cep.length !== 8) return;
    setCepState("loading");
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`).then((res) => res.json());
      if (r.erro) return setCepState("notfound");
      setAddr((a) => ({ ...a, street: r.logradouro || a.street, district: r.bairro || a.district, city: r.localidade || a.city, state: r.uf || a.state }));
      setCepState("idle");
    } catch {
      setCepState("idle"); // sem internet / API fora: o cliente preenche manualmente
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    try {
      await api(`/api/stores/${slug}/me`, "PUT", {
        name: f.get("name"),
        cpf,
        phone,
        birthDate: f.get("birthDate") || null,
        address: addr,
        acceptTerms: accept,
        marketingOptIn: f.get("marketing") === "on",
      });
      router.push(next);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {termsChanged && (
        <p className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-800">Nossos termos foram atualizados. Revise e aceite novamente para continuar comprando.</p>
      )}
      <Card className="p-5">
        <h2 className="font-semibold">Dados pessoais</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Nome completo" className="sm:col-span-2">
            <Input name="name" required defaultValue={customer?.name ?? defaultName} autoComplete="name" />
          </Field>
          <Field label="CPF" hint={cpfInvalid ? undefined : "Necessário para emissão da nota fiscal"}>
            <Input required inputMode="numeric" value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} placeholder="000.000.000-00" aria-invalid={cpfInvalid} className={cpfInvalid ? "border-red-300" : ""} />
            {cpfInvalid && <span className="block text-xs text-red-600">CPF inválido</span>}
          </Field>
          <Field label="Celular / WhatsApp">
            <Input required inputMode="tel" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(11) 99999-9999" autoComplete="tel" />
          </Field>
          <Field label="Data de nascimento" hint="Opcional">
            <Input name="birthDate" type="date" defaultValue={customer?.birthDate ?? ""} max={new Date().toISOString().slice(0, 10)} />
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <MapPin className="size-4 text-zinc-400" /> Endereço de entrega
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-6">
          <Field label="CEP" className="sm:col-span-2" hint={cepState === "loading" ? "Buscando endereço…" : cepState === "notfound" ? "CEP não encontrado" : undefined}>
            <Input
              required
              inputMode="numeric"
              value={addr.cep}
              onChange={(e) => {
                const v = formatCep(e.target.value);
                setAddr((a) => ({ ...a, cep: v }));
                lookupCep(v);
              }}
              placeholder="00000-000"
              autoComplete="postal-code"
            />
          </Field>
          <Field label="Rua" className="sm:col-span-4">
            <Input required value={addr.street} onChange={set("street")} autoComplete="address-line1" />
          </Field>
          <Field label="Número" className="sm:col-span-2">
            <Input required value={addr.number} onChange={set("number")} />
          </Field>
          <Field label="Complemento" className="sm:col-span-4">
            <Input value={addr.complement} onChange={set("complement")} placeholder="Apto, bloco… (opcional)" />
          </Field>
          <Field label="Bairro" className="sm:col-span-2">
            <Input required value={addr.district} onChange={set("district")} />
          </Field>
          <Field label="Cidade" className="sm:col-span-3">
            <Input required value={addr.city} onChange={set("city")} autoComplete="address-level2" />
          </Field>
          <Field label="UF" className="sm:col-span-1">
            <Input required maxLength={2} value={addr.state} onChange={(e) => setAddr((a) => ({ ...a, state: e.target.value.toUpperCase() }))} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-3 p-5 text-sm">
        <label className="flex items-start gap-3">
          <input type="checkbox" required checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5 size-4 accent-zinc-900" />
          <span>
            Li e aceito os{" "}
            <Link href={`/${slug}/termos`} target="_blank" className="font-medium underline">
              Termos de Uso
            </Link>{" "}
            e a{" "}
            <Link href={`/${slug}/privacidade`} target="_blank" className="font-medium underline">
              Política de Privacidade
            </Link>
            . <span className="text-red-600">*</span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-zinc-600">
          <input type="checkbox" name="marketing" defaultChecked={customer?.marketingOptIn ?? false} className="mt-0.5 size-4 accent-zinc-900" />
          Quero receber ofertas e novidades por e-mail e WhatsApp. (opcional; você pode cancelar quando quiser)
        </label>
      </Card>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Button type="submit" variant="brand" className="w-full py-3" disabled={loading || cpfInvalid}>
        {loading && <Loader2 className="size-4 animate-spin" />} Salvar e continuar
      </Button>
    </form>
  );
}
