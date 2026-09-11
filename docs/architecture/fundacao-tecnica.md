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

## CI (GitHub Actions)

Workflow [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), executado em todo pull request e em todo push na `main`:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test` (unitários)
5. `pnpm test:integration` (PostgreSQL 17 como service container, banco `veldocs_test`)
6. `pnpm db:deploy` + `pnpm build`
7. `pnpm test:e2e` (Playwright contra `pnpm start`)

Segurança do workflow: permissões mínimas (`contents: read`), actions fixadas por SHA de commit, `persist-credentials: false` no checkout e credenciais apenas do Postgres efêmero do CI.

**Proteção da `main`:** branch protection e rulesets não estão disponíveis para repositório privado no plano gratuito do GitHub (a API responde "Upgrade to GitHub Pro"). Até lá, mudanças entram por pull request e o Railway só publica commits da `main` com CI verde (ver abaixo).

## Health check

`GET /api/health` responde `200 {"status":"ok","checks":{"database":"up","migrations":"up"}}` ou `503` com `status: "degraded"`:

| Check | Fica `down` quando |
|---|---|
| `database` | a conexão com o PostgreSQL falha ou excede o timeout |
| `migrations` | há migração do código não aplicada, migração com falha não resolvida ou a tabela `_prisma_migrations` não existe |

A resposta nunca inclui mensagens de erro internas e usa `Cache-Control: no-store`.

## Deploy (Railway)

| Item | Valor |
|---|---|
| Projeto / ambiente | `veldocs` / `production` (workspace Velnox.IA, plano Hobby) |
| Serviços | `veldocs-app` (aplicação) e `Postgres` (PostgreSQL gerenciado, acesso só pela rede privada) |
| Origem | GitHub `joaovictormaria/veldocs`, branch `main` — deploy automático **somente após os checks do GitHub passarem** (gatilho com `checkSuites: true`) |
| Build | Railpack (Node 24 via `.nvmrc`/`engines`, pnpm via `packageManager`) → `pnpm build` |
| Pre-deploy | `pnpm db:deploy` (`prisma migrate deploy`) |
| Start | `pnpm start` (Next.js na porta `PORT=3000`) |
| Healthcheck | `/api/health` (banco + migrações), timeout 120 s |
| Restart | `ON_FAILURE`, até 5 tentativas |
| Backups do Postgres | ⚠️ **não configurados**: o agendamento de backups do volume foi recusado pela API ("Not Authorized") no plano Hobby; PITR desativado |
| Domínio | https://veldocs-app-production.up.railway.app |

Variáveis do serviço `veldocs-app` (valores ficam somente no Railway):

| Variável | Valor |
|---|---|
| `APP_ENV` | `production` |
| `APP_URL` | `https://veldocs-app-production.up.railway.app` |
| `LOG_LEVEL` | `info` |
| `PORT` | `3000` |
| `DATABASE_URL` | referência `${{Postgres.DATABASE_URL}}` (host interno `postgres.railway.internal`) |

As configurações de deploy (pre-deploy, start, healthcheck, restart) estão aplicadas diretamente no serviço, pela API do Railway. O `railway.json` (Config as Code, depreciado pelo Railway) não era aplicado a este serviço e foi removido. A migração para Infrastructure as Code (`.railway/railway.ts`) está pendente: o arquivo precisa declarar também variáveis e origem do repositório, senão o `railway config apply` as remove.

## Primeiros passos (desenvolvimento)

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm db:deploy
pnpm dev
```
