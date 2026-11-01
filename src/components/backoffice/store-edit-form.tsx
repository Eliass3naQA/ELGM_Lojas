"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { slugify } from "@/lib/format";
import type { Store } from "@/lib/types";
import { Button, Card, CardHeader, Field, Input } from "../ui";

/** Dados cadastrais da empresa (backoffice). Catálogo, preços e vendas ficam no painel do dono. */
export function StoreEditForm({ store }: { store: Store }) {
  const router = useRouter();
  const [slug, setSlug] = useState(store.slug);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (slug !== store.slug && !confirm(`Mudar o endereço para /${slug}? Links antigos (/${store.slug}) deixarão de funcionar.`)) return;
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api<Store>(
        `/api/stores/${store.slug}`,
        "PATCH",
        {
          name: String(f.get("name")),
          slug,
          tagline: String(f.get("tagline")),
          category: String(f.get("category")),
          logo: String(f.get("logo")) || "🛍️",
          brandColor: String(f.get("brandColor")),
          ownerName: String(f.get("ownerName")),
          ownerEmail: String(f.get("ownerEmail")),
          whatsapp: String(f.get("whatsapp")),
        },
        { "x-actor": "admin" },
      );
      setSaved(true);
      if (updated.slug !== store.slug) router.replace(`/backoffice/lojas/${updated.slug}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader title="Dados da empresa" description="Informações cadastrais — alterações ficam na auditoria" />
      <form onSubmit={submit} className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Nome da loja">
          <Input name="name" required minLength={2} maxLength={60} defaultValue={store.name} />
        </Field>
        <Field label="Endereço" hint={`Vitrine: /${slug || "…"}/home`}>
          <Input required minLength={3} maxLength={40} value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
        </Field>
        <Field label="Slogan" className="sm:col-span-2">
          <Input name="tagline" maxLength={120} defaultValue={store.tagline} />
        </Field>
        <Field label="Categoria">
          <Input name="category" required minLength={2} maxLength={40} defaultValue={store.category} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Logo (emoji)">
            <Input name="logo" maxLength={8} defaultValue={store.logo} />
          </Field>
          <Field label="Cor">
            <Input name="brandColor" type="color" defaultValue={store.brandColor} className="h-[38px] p-1" />
          </Field>
        </div>
        <Field label="Responsável">
          <Input name="ownerName" required minLength={2} maxLength={80} defaultValue={store.ownerName} />
        </Field>
        <Field label="E-mail do responsável">
          <Input name="ownerEmail" type="email" required defaultValue={store.ownerEmail} />
        </Field>
        <Field label="WhatsApp" hint="DDD + número (opcional)">
          <Input name="whatsapp" inputMode="tel" defaultValue={store.whatsapp ?? ""} />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</p>}
        <div className="flex items-center justify-end gap-3 sm:col-span-2">
          {saved && <span className="text-sm text-emerald-600">Salvo!</span>}
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />} Salvar alterações
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Exclusão definitiva: exige digitar o endereço da loja. */
export function DeleteStoreCard({ store }: { store: Store }) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setLoading(true);
    setError(null);
    try {
      await api(`/api/stores/${store.slug}`, "DELETE");
      router.replace("/backoffice/lojas");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <Card className="border-red-200">
      <CardHeader title={<span className="text-red-700">Zona de perigo</span>} description="Excluir a loja apaga produtos, estoque, cupons, clientes, pedidos, pagamentos, fotos e comprovantes. Não dá para desfazer." />
      <div className="space-y-3 p-5">
        <Field label={`Digite "${store.slug}" para confirmar`}>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={store.slug} autoComplete="off" />
        </Field>
        <Button variant="danger" className="w-full" disabled={typed !== store.slug || loading} onClick={remove}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Excluir loja definitivamente
        </Button>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
    </Card>
  );
}
