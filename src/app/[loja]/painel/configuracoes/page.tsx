import { StoreSettingsForm } from "@/components/painel/store-settings-form";
import { loadStore } from "@/lib/data/load-store";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { getPlan } from "@/lib/data/repository";
import { money } from "@/lib/format";
import { defaultTerms } from "@/lib/legal";

export const metadata = { title: "Configurações" };

export default async function SettingsPage({ params }: { params: Promise<{ loja: string }> }) {
  const store = await loadStore((await params).loja);
  const plan = await getPlan(store.planId);
  return (
    <>
      <PageHeader title="Configurações" description="Personalize sua loja e regras de frete." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <StoreSettingsForm store={store} defaultTermsText={defaultTerms(store).map((s) => `${s.title}\n${s.body}`).join("\n\n")} />
        </div>
        <Card className="h-fit">
          <CardHeader title="Seu plano" />
          <div className="p-5">
            <p className="text-xl font-semibold">{plan.name}</p>
            <p className="text-sm text-zinc-500">
              {money(plan.priceMonthly)}/mês + {plan.feePercent}% por venda
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-zinc-600">
              {plan.features.map((f) => (
                <li key={f}>✓ {f}</li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </>
  );
}
