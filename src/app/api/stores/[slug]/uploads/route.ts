import { DomainError, saveImage } from "@/lib/data/repository";
import { handle } from "@/lib/validation";

type Ctx = { params: Promise<{ slug: string }> };

// Upload de fotos (logo, capa, produtos). multipart/form-data, campo "file".
// TODO(auth): exigir dono da loja. No Supabase: bucket público "media/{store_id}/...".
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) throw new DomainError("Selecione uma imagem.");
  return saveImage((await params).slug, { name: file.name, data: Buffer.from(await file.arrayBuffer()) });
});
