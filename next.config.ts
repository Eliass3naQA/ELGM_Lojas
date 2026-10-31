import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // há outro package-lock.json na home do usuário; fixa a raiz neste projeto
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
