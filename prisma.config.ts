import "dotenv/config";
import { defineConfig } from "prisma/config";

// Configuração do Prisma CLI (migrações/geração).
// DATABASE_URL vem do ambiente — nunca fixar credenciais aqui.
// É opcional para `prisma generate`/`validate` (ex.: `pnpm install` em CI sem
// banco); comandos de migração falham explicitamente quando ela não existe.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
