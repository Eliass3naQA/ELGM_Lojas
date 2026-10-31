import { LegalPage } from "@/components/store/legal-page";
import { loadStore } from "@/lib/data/load-store";
import { termsFor } from "@/lib/legal";

export const metadata = { title: "Termos de Uso" };

export default async function TermsPage({ params }: { params: Promise<{ loja: string }> }) {
  const store = await loadStore((await params).loja);
  return <LegalPage title="Termos de Uso" storeName={store.name} updatedAt={store.termsUpdatedAt} sections={termsFor(store)} />;
}
