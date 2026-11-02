import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // há outro package-lock.json na home do usuário; fixa a raiz neste projeto
  outputFileTracingRoot: path.join(__dirname),
  // permite rodar um segundo servidor (ex.: testes) sem disputar a pasta .next do servidor principal
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
