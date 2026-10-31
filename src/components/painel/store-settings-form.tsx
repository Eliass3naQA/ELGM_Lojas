"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, FileText, ImageIcon, Loader2, MessageCircle, QrCode } from "lucide-react";
import { api } from "@/lib/api-client";
import type { Store } from "@/lib/types";
import { Button, ButtonLink, Card, CardHeader, Field, Input, Textarea } from "../ui";
import { SingleImageField } from "./image-fields";

const COLORS = ["#e11d48", "#f97316", "#b45309", "#16a34a", "#0891b2", "#4f46e5", "#9333ea", "#18181b"];

export function StoreSettingsForm({ store, defaultTermsText }: { store: Store; defaultTermsText: string }) {
  const router = useRouter();
  const [color, setColor] = useState(store.brandColor);
  const [freeShipping, setFreeShipping] = useState(store.freeShippingOver !== null);
  const [customTerms, setCustomTerms] = useState(store.customTerms !== null);
  const [logoUrl, setLogoUrl] = useState(store.logoUrl);
  const [coverUrl, setCoverUrl] = useState(store.coverUrl);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const n = (k: string) => Number(String(f.get(k)).replace(",", "."));
    setState("saving");
    setError(null);
    try {
      await api(`/api/stores/${store.slug}`, "PATCH", {
        name: String(f.get("name")),
        tagline: String(f.get("tagline")),
        category: String(f.get("category")),
        logo: String(f.get("logo")),
        brandColor: color,
        shippingFlat: n("shippingFlat"),
        freeShippingOver: freeShipping ? n("freeShippingOver") : null,
        pixKey: String(f.get("pixKey")),
        logoUrl,
        coverUrl,
        about: String(f.get("about") ?? ""),
        whatsapp: String(f.get("whatsapp") ?? ""),
        instagram: String(f.get("instagram") ?? ""),
        customTerms: customTerms ? String(f.get("customTerms")) : null,
      });
      setState("saved");
      router.refresh();
      setTimeout(() => setState("idle"), 1500);
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader title="Identidade da loja" description={`Endereço: /${store.slug}`} />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Nome da loja">
            <Input name="name" required defaultValue={store.name} />
          </Field>
          <Field label="Categoria">
            <Input name="category" required defaultValue={store.category} />
          </Field>
          <Field label="Slogan" className="sm:col-span-2">
            <Input name="tagline" defaultValue={store.tagline} />
          </Field>
          <Field label="Ícone (emoji)" hint="Usado quando não há logo">
            <Input name="logo" required defaultValue={store.logo} maxLength={8} />
          </Field>
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-zinc-700">Cor da marca</span>
            <div className="flex flex-wrap items-center gap-2">
              {COLORS.map((c) => (
                <button type="button" key={c} onClick={() => setColor(c)} className="grid size-8 place-items-center rounded-full ring-offset-2 transition" style={{ background: c, boxShadow: c === color ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined }} aria-label={c}>
                  {c === color && <Check className="size-4 text-white" />}
                </button>
              ))}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="size-8 cursor-pointer rounded-full border-0 bg-transparent" />
            </div>
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><ImageIcon className="size-4 text-zinc-400" /> Aparência da vitrine</span>} description="Logo, foto de capa e apresentação" />
        <div className="space-y-5 p-5">
          <div className="grid gap-5 sm:grid-cols-[auto_1fr]">
            <SingleImageField slug={store.slug} label="Logo" value={logoUrl} onChange={setLogoUrl} hint="Quadrada, mín. 200×200" />
            <SingleImageField slug={store.slug} label="Foto de capa" value={coverUrl} onChange={setCoverUrl} aspect="cover" hint="Horizontal, ideal 1800×600. Sem capa, usamos a cor da marca." />
          </div>
          <Field label="Sobre a loja" hint="Aparece no rodapé e na vitrine">
            <Textarea name="about" defaultValue={store.about} maxLength={1000} placeholder="Conte a história da sua marca, o que vocês fazem de diferente…" />
          </Field>
        </div>
      </Card>
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><MessageCircle className="size-4 text-zinc-400" /> Contato e redes</span>} />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="WhatsApp" hint="DDD + número. Mostra o botão de atendimento na loja.">
            <Input name="whatsapp" inputMode="tel" defaultValue={store.whatsapp ?? ""} placeholder="(11) 99999-9999" />
          </Field>
          <Field label="Instagram">
            <Input name="instagram" defaultValue={store.instagram ? `@${store.instagram}` : ""} placeholder="@sualoja" />
          </Field>
        </div>
      </Card>
      <Card>
        <CardHeader title="Frete" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Frete fixo (R$)">
            <Input name="shippingFlat" required inputMode="decimal" defaultValue={store.shippingFlat} />
          </Field>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
              <input type="checkbox" checked={freeShipping} onChange={(e) => setFreeShipping(e.target.checked)} className="accent-zinc-900" />
              Frete grátis acima de (R$)
            </label>
            <Input name="freeShippingOver" inputMode="decimal" disabled={!freeShipping} defaultValue={store.freeShippingOver ?? 199} />
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><QrCode className="size-4 text-zinc-400" /> Recebimento</span>} description="Pagamento manual: o cliente paga e envia o comprovante para você aprovar" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Chave Pix" hint="CPF/CNPJ, e-mail, telefone ou chave aleatória. Usada para gerar o QR Code do pedido.">
            <Input name="pixKey" required defaultValue={store.pixKey} />
          </Field>
          <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-sm text-zinc-500">
            <p className="font-medium text-zinc-700">Mercado Pago — em breve</p>
            <p className="mt-1 text-xs">Com a integração, Pix e cartão serão aprovados automaticamente, sem comprovante.</p>
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2"><FileText className="size-4 text-zinc-400" /> Termos de Uso</span>}
          description="Exibidos no cadastro e no rodapé da loja. Alterar o texto pede um novo aceite aos clientes."
          action={<ButtonLink href={`/${store.slug}/termos`} target="_blank" variant="ghost" className="px-2 py-1 text-xs">Ver página</ButtonLink>}
        />
        <div className="space-y-3 p-5">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={customTerms} onChange={(e) => setCustomTerms(e.target.checked)} className="accent-zinc-900" />
            Usar meus próprios termos (em vez do modelo padrão da plataforma)
          </label>
          {customTerms && (
            <Field label="Texto dos termos" hint="Separe as seções com uma linha em branco; a primeira linha de cada seção vira o título.">
              <Textarea name="customTerms" required defaultValue={store.customTerms ?? defaultTermsText} className="min-h-64 font-mono text-xs" />
            </Field>
          )}
          <p className="text-xs text-zinc-400">⚠️ O modelo padrão é um ponto de partida. Revise com um advogado antes de usar.</p>
        </div>
      </Card>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={state === "saving"}>
          {state === "saving" && <Loader2 className="size-4 animate-spin" />}
          {state === "saved" && <Check className="size-4" />}
          {state === "saved" ? "Salvo!" : "Salvar configurações"}
        </Button>
      </div>
    </form>
  );
}
