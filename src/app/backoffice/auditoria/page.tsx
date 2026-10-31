import { Badge, Card, PageHeader, Table } from "@/components/ui";
import { listAudit } from "@/lib/data/repository";
import { dateTime } from "@/lib/format";

export const metadata = { title: "Auditoria" };

export default async function AuditPage() {
  const logs = await listAudit();
  return (
    <>
      <PageHeader title="Auditoria" description="Registro de ações administrativas na plataforma." />
      <Card>
        <Table>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Quem</th>
              <th>Ação</th>
              <th>Alvo</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="text-zinc-500">{dateTime(l.at)}</td>
                <td>
                  <Badge tone={l.actor === "admin" ? "violet" : "zinc"}>{l.actor}</Badge>
                </td>
                <td>{l.action}</td>
                <td className="font-mono text-xs">{l.target}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
