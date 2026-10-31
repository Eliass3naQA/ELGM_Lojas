import { getImage } from "@/lib/data/repository";

// Fotos públicas da vitrine. O tipo vem da detecção feita no upload, nunca do cliente.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const file = await getImage((await params).id);
  if (!file) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
