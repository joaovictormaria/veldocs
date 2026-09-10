import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Não expor a tecnologia do servidor. Headers de segurança completos: FASE 2.
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
