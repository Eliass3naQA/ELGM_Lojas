"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { money, slugify } from "@/lib/format";
import type { Plan, Store } from "@/lib/types";
import { Button, Card, Field, Input, Select } from "../ui";

export function NewStoreForm({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    try {
      const store = await api<Store>("/api/stores", "POST", {
        name,
        slug,
        tagline: String(f.get("tagline")),
        category: String(f.get("category")),
        logo: String(f.get("logo")) || "🛍️",
        brandColor: String(f.get("brandColor")),
        ownerName: String(f.get("ownerName")),
        ownerEmail: String(f.get("ownerEmail")),
        planId: String(f.get("planId")),
      });
      router.push(`/backoffice/lojas/${store.slug}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <Card className="max-w-2xl p-6">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome da loja">
          <Input
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
          />
        </Field>
        <Field label="Endereço" hint={`Vitrine: /${slug || "minha-loja"}/home`}>
          <Input
            required
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
          />
        </Field>
        <Field label="Slogan" className="sm:col-span-2">
          <Input name="tagline" />
        </Field>
        <Field label="Categoria">
          <Input name="category" required placeholder="Moda, Alimentos…" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Logo (emoji)">
            <Input name="logo" defaultValue="🛍️" maxLength={8} />
          </Field>
          <Field label="Cor">
            <Input name="brandColor" type="color" defaultValue="#6366f1" className="h-[38px] p-1" />
          </Field>
        </div>
        <Field label="Nome do dono">
          <Input name="ownerName" required />
        </Field>
        <Field label="E-mail do dono">
          <Input name="ownerEmail" type="email" required />
        </Field>
        <Field label="Plano" className="sm:col-span-2">
          <Select name="planId" defaultValue="starter">
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {money(p.priceMonthly)}/mês
              </option>
            ))}
          </Select>
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</p>}
        <div className="flex justify-end sm:col-span-2">
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />} Criar loja (inicia em trial)
          </Button>
        </div>
      </form>
    </Card>
  );
}
