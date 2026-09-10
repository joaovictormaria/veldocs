# VELDOCS — Fundação técnica (FASE 1)

## Stack

| Área | Tecnologia |
|---|---|
| Frontend / apresentação | Next.js 16 (App Router), React 19 |
| Backend / API | Node.js 24 + TypeScript 6 (route handlers e server components do Next.js) |
| Arquitetura | Monólito modular em camadas |
| Banco | PostgreSQL 17 + Prisma ORM 7 (driver adapter `@prisma/adapter-pg`) |
| Validação | Zod 4 |
| Testes | Vitest 5 (unit + integração), Playwright (E2E) |
| Qualidade | TypeScript `strict`, ESLint 9 (`eslint-config-next`) |
| Pacotes | pnpm 10 (`pnpm-lock.yaml` versionado) |
| Infra local | Docker Compose (somente PostgreSQL nesta fase) |

Planejado, **não implementado**: Redis (cache/filas/rate limit), object storage privado S3/R2, workers assíncronos, WhatsApp Business API, provedor de IA.

## Estrutura

```text
veldocs/
├── prisma/                   # DATABASE: schema, migrações versionadas
│   ├── schema.prisma
│   └── migrations/
├── prisma.config.ts          # Configuração do Prisma CLI (URL via ambiente)
├── src/
│   ├── app/                  # PRESENTATION (entrada): rotas Next.js, layouts, route handlers.
│   │                         #   Rotas são finas e fazem a composição (injetam infraestrutura em casos de uso).
│   ├── presentation/         # PRESENTATION: componentes/conteúdo de UI reutilizável (design system na FASE 3)
│   ├── application/          # APPLICATION: casos de uso e portas (interfaces)
│   │   ├── ports/            #   Storage, IA, WhatsApp, notificações, auditoria, rate limit, health
│   │   └── system/           #   caso de uso de health check
│   ├── domain/               # DOMAIN: regras e tipos puros (sem framework/infra)
│   │   ├── shared/           #   TenantContext
│   │   └── access-control/   #   formato de chave de permissão
│   ├── infrastructure/       # INFRASTRUCTURE: implementações concretas
│   │   ├── config/           #   env validado com Zod (server-only)
│   │   └── database/         #   PrismaClient (server-only), probe de banco
│   └── generated/prisma/     # Prisma Client gerado (não versionado)
├── tests/
│   ├── unit/                 # sem I/O (inclui teste de fronteiras de camadas)
│   ├── integration/          # PostgreSQL real (banco *_test)
│   └── e2e/                  # Playwright
└── docker-compose.yml        # PostgreSQL local
```

### Regras de dependência (verificadas por `tests/unit/architecture/layer-boundaries.test.ts`)

```text
app ─────────────► presentation, application, infrastructure, domain
presentation ────► application, domain
infrastructure ──► application (portas), domain
application ─────► domain            (pacotes externos: apenas zod)
domain ──────────► —                 (pacotes externos: apenas zod)
```

Módulos de negócio (documentos, empresas, usuários…) serão criados como subpastas **dentro de cada camada** (ex.: `application/documents`, `domain/documents`), mantendo as fronteiras acima. Não há microserviços.

## Ambientes

| Ambiente | `APP_ENV` | Execução | Configuração |
|---|---|---|---|
| development | `development` | `pnpm dev` + `pnpm db:up` | `.env` local (copiado de `.env.example`) |
| staging | `staging` | `pnpm build` + `pnpm start` | variáveis injetadas pela plataforma / gerenciador de secrets |
| production | `production` | `pnpm build` + `pnpm start` | variáveis injetadas pela plataforma / gerenciador de secrets |

`APP_ENV` é independente de `NODE_ENV` (que o Next.js controla). Regras validadas em `src/infrastructure/config/env.ts`:

- `APP_ENV` ∈ {development, staging, production};
- `DATABASE_URL` precisa ser URL PostgreSQL;
- staging/production exigem `APP_URL` com https e rejeitam as credenciais locais do docker-compose;
- erros de configuração nunca incluem valores das variáveis.

Arquivos `.env*` são ignorados pelo Git (exceto `.env.example`). Staging e produção **não** usam arquivos `.env`.

## Scripts

| Script | Função |
|---|---|
| `pnpm dev` | servidor de desenvolvimento |
| `pnpm build` / `pnpm start` | build e servidor de produção |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | geração do Prisma Client + `tsc --noEmit` |
| `pnpm test` | testes unitários |
| `pnpm test:integration` | testes de integração (aplica migrações no banco `*_test`) |
| `pnpm test:e2e` | Playwright |
| `pnpm check` | lint + typecheck + unit |
| `pnpm db:up` / `db:down` | sobe/derruba PostgreSQL local |
| `pnpm db:migrate` | `prisma migrate dev` (somente desenvolvimento) |
| `pnpm db:deploy` | `prisma migrate deploy` (staging/produção) |
| `pnpm db:status` | status das migrações |

## Primeiros passos (desenvolvimento)

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm db:deploy
pnpm dev
```
