// Publica os modelos de recorte do estúdio no Storage do Supabase (bucket público "models"),
// para que todas as lojas baixem de um lugar só, rápido e sem depender do Hugging Face.
// Arquivos grandes são divididos em partes de 45 MB (o plano gratuito limita 50 MB por arquivo);
// o navegador baixa as partes em paralelo e remonta (ver src/lib/studio/segment.worker.ts).
// Uso: npm run models:upload
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const BUCKET = "models";
const PART = 45 * 1024 * 1024;
// pasta no Storage → repositório de origem no Hugging Face (licença MIT) e arquivos usados
const MODELS = {
  "birefnet-lite-1024": { repo: "onnx-community/BiRefNet_lite-ONNX", files: ["config.json", "preprocessor_config.json", "onnx/model_fp16.onnx"] },
  "birefnet-lite-512": { repo: "studioludens/birefnet-lite-512", files: ["config.json", "preprocessor_config.json", "onnx/model.onnx"] },
};

async function upload(path, data, contentType) {
  const { error } = await sb.storage.from(BUCKET).upload(path, data, { upsert: true, contentType, cacheControl: "31536000" });
  if (error) throw new Error(`${path}: ${error.message}`);
}

const { error: bucketError } = await sb.storage.createBucket(BUCKET, { public: true });
if (bucketError && !/exist/i.test(bucketError.message)) throw bucketError;

for (const [dir, { repo, files }] of Object.entries(MODELS)) {
  for (const file of files) {
    const url = `https://huggingface.co/${repo}/resolve/main/${file}`;
    process.stdout.write(`↓ ${repo}/${file} … `);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    const data = Buffer.from(await res.arrayBuffer());
    console.log(`${(data.length / 1e6).toFixed(1)} MB`);
    const path = `${dir}/${file}`;
    if (data.length <= PART) {
      await upload(path, data, file.endsWith(".json") ? "application/json" : "application/octet-stream");
      console.log(`  ↑ ${path}`);
      continue;
    }
    const parts = Math.ceil(data.length / PART);
    for (let i = 0; i < parts; i++) {
      await upload(`${path}.part${i}`, data.subarray(i * PART, (i + 1) * PART), "application/octet-stream");
      console.log(`  ↑ ${path}.part${i}`);
    }
    // manifesto: quantas partes e o tamanho total
    await upload(`${path}.parts.json`, Buffer.from(JSON.stringify({ parts, size: data.length })), "application/json");
    console.log(`  ↑ ${path}.parts.json (${parts} partes)`);
  }
}
// Motor de execução (ONNX Runtime em WebAssembly): por padrão viria do CDN jsDelivr, sem progresso e às vezes lento.
// Publica os arquivos da versão instalada em models/ort/<versão>/.
const { readFileSync, readdirSync } = await import("node:fs");
const ortDir = "node_modules/onnxruntime-web/dist";
const ortVersion = JSON.parse(readFileSync("node_modules/onnxruntime-web/package.json", "utf8")).version;
for (const file of readdirSync(ortDir).filter((f) => /^ort-wasm-simd-threaded.*\.(wasm|mjs)$/.test(f))) {
  await upload(`ort/${ortVersion}/${file}`, readFileSync(`${ortDir}/${file}`), file.endsWith(".wasm") ? "application/wasm" : "text/javascript");
  console.log(`↑ ort/${ortVersion}/${file}`);
}
console.log(`Pronto: ${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`);
