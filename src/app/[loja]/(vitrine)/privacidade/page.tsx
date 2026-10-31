import { LegalPage } from "@/components/store/legal-page";
import { loadStore } from "@/lib/data/load-store";
import { privacyPolicy } from "@/lib/legal";

export const metadata = { title: "Política de Privacidade" };

export default async function PrivacyPage({ params }: { params: Promise<{ loja: string }> }) {
  const store = await loadStore((await params).loja);
  return <LegalPage title="Política de Privacidade" storeName={store.name} updatedAt={store.termsUpdatedAt} sections={privacyPolicy(store)} />;
}
