import { date } from "@/lib/format";
import type { LegalSection } from "@/lib/legal";

export function LegalPage({ title, storeName, updatedAt, sections }: { title: string; storeName: string; updatedAt: string; sections: LegalSection[] }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <p className="text-brand-strong text-sm font-medium">{storeName}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-zinc-500">Última atualização: {date(updatedAt)}</p>
      <div className="mt-10 space-y-8">
        {sections.map((s, i) => (
          <section key={i}>
            {s.title && <h2 className="font-semibold text-zinc-900">{s.title}</h2>}
            <p className="mt-2 whitespace-pre-line leading-relaxed text-zinc-600">{s.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
