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
│   ├── presentation/         # PRESENTATION: componentes/conteúdo de UI reutilizável (design system: pendente)
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
| `APP_ENCRYPTION_KEY` | 32 bytes aleatórios em base64 (secret; nunca exibido) |
| `APP_HMAC_KEY` | 32 bytes aleatórios em base64 (secret; nunca exibido) |

> ⚠️ **Guarde uma cópia de `APP_ENCRYPTION_KEY` e `APP_HMAC_KEY` em um cofre de senhas.** Sem a chave de criptografia os CPFs cifrados não podem ser lidos; sem a chave HMAC o login por CPF deixa de encontrar as contas. Trocar as chaves exige um procedimento de rotação (pendente).

As configurações de deploy (pre-deploy, start, healthcheck, restart) estão aplicadas diretamente no serviço, pela API do Railway. O `railway.json` (Config as Code, depreciado pelo Railway) não era aplicado a este serviço e foi removido. A migração para Infrastructure as Code (`.railway/railway.ts`) está pendente: o arquivo precisa declarar também variáveis e origem do repositório, senão o `railway config apply` as remove.

## Identidade e autenticação (FASE 2 — em andamento)

### Modelo

- `users` é a **pessoa** (identidade global): e-mail único, CPF opcional e senha. A pessoa **não pertence** a uma empresa.
- `memberships` é o **vínculo** pessoa ↔ empresa (`INVITED`, `ACTIVE`, `SUSPENDED`). Uma pessoa pode estar em várias empresas (DEC-009).
- Perfis (`user_roles`), responsável/criador de documento, autor de auditoria e empresa ativa da sessão referenciam o vínculo `(company_id, user_id)`: o banco rejeita quem não é membro da empresa.
- **CPF** nunca é gravado em claro: `cpf_lookup_hash` = HMAC-SHA256 (busca e unicidade) e `cpf_encrypted` = AES-256-GCM com contexto autenticado `users.cpf`.
- **Senha**: Argon2id (19 MiB, 2 iterações, paralelismo 1); mínimo de 12 e máximo de 128 caracteres, sem regras de composição.

### Endpoints

| Método e rota | Função | Respostas |
|---|---|---|
| `POST /api/auth/signup` | cria pessoa, empresa, 5 perfis padrão e vínculo OWNER; inicia sessão na empresa | `201`, `400 invalid_input` (com campos), `409 registration_unavailable` (genérico), `429` |
| `POST /api/auth/login` | login por e-mail **ou** CPF + senha | `200`, `400`, `401 invalid_credentials` (idêntico para qualquer falha), `429` com `Retry-After` |
| `POST /api/auth/logout` | revoga a sessão atual e apaga o cookie | `204` |
| `POST /api/auth/logout-all` | revoga todas as sessões da pessoa | `204`, `401` |
| `GET /api/auth/session` | pessoa, empresa ativa e vínculos com perfis | `200`, `401` |
| `POST /api/auth/active-company` | define a empresa ativa da sessão (`{ companyId }`) | `200`, `400`, `401`, `404 company_not_available` (idêntico para empresa inexistente, sem vínculo ou suspensa) |
| `GET /api/company` | empresa ativa (`company.read`) | `200`, `401`, `403` |
| `GET /api/company/members` | membros da empresa ativa (`members.read`) | `200`, `401`, `403` |
| `GET /api/company/members/[userId]` | um membro da empresa ativa (`members.read`) | `200`, `401`, `403`, `404` (idêntico para outra empresa, inexistente ou id inválido) |
| `POST /api/auth/mfa/enroll` | inicia o cadastro do app autenticador (devolve segredo e URI do QR Code) | `200`, `401`, `409 mfa_already_enabled` |
| `POST /api/auth/mfa/enroll/confirm` | confirma com um código e entrega os códigos de recuperação | `200`, `400 invalid_code`, `401`, `409`, `429` |
| `POST /api/auth/mfa/verify` | confirma o segundo fator na sessão (código do app ou de recuperação) | `200`, `400`, `401 invalid_code`, `409 mfa_not_configured`, `429` |

Rotas que alteram estado exigem `Origin` igual a `APP_URL` (ou `Sec-Fetch-Site: same-origin`) e corpo `application/json` de até 16 KB.

### Sessão

- Token aleatório de 256 bits no cookie; no banco fica apenas o SHA-256 (`sessions.id`).
- Cookie `HttpOnly`, `SameSite=Lax`, `Path=/`; em HTTPS, `Secure` e prefixo `__Host-veldocs_session`.
- Expira após **7 dias sem uso** (renovada com o uso) e nunca passa de **30 dias** desde o login.
- Todo login gera sessão nova (sem session fixation). Se a pessoa tem um único vínculo ativo, a empresa ativa é definida automaticamente.

### Limites de tentativa e auditoria

| Regra | Limite |
|---|---|
| Login por IP | 30 em 15 min |
| Login por conta (HMAC do e-mail/CPF normalizado) | 10 em 15 min |
| Cadastro por IP | 10 por hora |

Implementação em PostgreSQL (`rate_limit_buckets`, UPSERT atômico); substituível por Redis. O IP vem do último valor de `X-Forwarded-For` (acrescentado pelo proxy do Railway).

Eventos auditados: `auth.account_registered`, `company.created`, `auth.login_succeeded`, `auth.login_failed`, `auth.login_rate_limited`, `auth.register_rate_limited`, `auth.logout`, `auth.logout_all`. Metadados nunca contêm senha, token, e-mail digitado ou CPF.

### Autorização nas rotas (FASE 2 — parte 2)

Toda rota de negócio chama `authorizeRequest(permissão)` (`src/infrastructure/http/authorization.ts`) **antes** de qualquer consulta. A cadeia (`src/application/access/authorize.ts`) segue o MASTER SPEC:

```text
sessão válida → pessoa ativa → empresa ativa na sessão → vínculo ACTIVE em empresa ACTIVE
  → segundo fator (quando o perfil exige) → permissão do perfil (união dos perfis do vínculo)
  → entitlement do módulo da permissão → recurso
```

| Falha | Resposta |
|---|---|
| sem sessão / sessão inválida / pessoa desativada | `401 unauthenticated` |
| sessão sem empresa ativa (pessoa com mais de um vínculo) | `403 active_company_required` |
| sem vínculo ativo, empresa suspensa ou permissão ausente | `403 forbidden` |
| perfil exige segundo fator e a pessoa ainda não o configurou | `403 mfa_enrollment_required` |
| perfil exige segundo fator e a sessão ainda não o confirmou | `403 mfa_required` |
| módulo da permissão não ativo para a empresa | `403 module_not_enabled` |

- A empresa vem **sempre** da sessão (`context.companyId`); nenhuma rota aceita empresa por parâmetro. As consultas (`src/application/access/company-queries.ts`) só recebem um `AuthorizedContext`.
- Recurso de outra empresa, inexistente ou com id inválido responde `404` (mesma resposta, sem enumeração).
- Vínculo ou empresa suspensos perdem acesso na hora, mesmo com sessão válida (a verificação é feita a cada requisição).
- **Entitlements:** cada permissão pertence a um módulo (`src/domain/access-control/permission-modules.ts`); hoje todas são do Core. A implementação provisória `createCoreOnlyEntitlementService` considera o Core sempre ativo e nega os demais módulos, até a FASE 3 criar o catálogo e os módulos contratados por empresa.
- Troca de empresa ativa auditada como `auth.active_company_selected`.

### Segundo fator (MFA)

Obrigatório para os perfis **OWNER** e **ADMIN** (`src/domain/access-control/mfa-policy.ts`). Quem tem esses perfis na empresa ativa não acessa nenhuma rota antes de configurar e confirmar o app autenticador.

- **Padrão:** TOTP da RFC 6238 — HMAC-SHA1, 6 dígitos, janela de 30 s e tolerância de um passo para cada lado. Compatível com Google Authenticator, Microsoft Authenticator e 1Password.
- **Implementação própria** (`src/infrastructure/security/totp.ts`): a verificação devolve o passo de tempo aceito, e o passo é gravado em `user_totp_credentials.last_used_step` — o mesmo código não vale duas vezes (replay).
- **Segredo:** gerado com 160 bits, guardado cifrado (AES-256-GCM, contexto `users.totp_secret`) e só válido depois da confirmação.
- **Códigos de recuperação:** 10 códigos de 10 caracteres base32, exibidos uma única vez, guardados apenas como HMAC-SHA256 e válidos uma vez cada.
- **Escopo da confirmação:** por sessão (`sessions.mfa_verified_at`). Cada login novo precisa confirmar de novo.
- **Limite:** 10 tentativas por pessoa a cada 15 minutos (confirmação e verificação).
- **Auditoria:** `auth.mfa_enrollment_started`, `auth.mfa_enabled`, `auth.mfa_verified`, `auth.mfa_failed`, `auth.mfa_rate_limited`.
- **Estado na sessão:** `GET /api/auth/session` devolve `mfa: { required, configured, verified }`.

Pendente: desativar/recadastrar o segundo fator (exigirá reautenticação por senha) e gerar novos códigos de recuperação.

### Pendente na FASE 2

Verificação de e-mail (obrigatória no MASTER SPEC v0.2), link mágico e recuperação de senha (Resend, aguardando domínio e chave); login com Google; headers de segurança (CSP, HSTS) e logs estruturados; rate limiting nas rotas de negócio; rotação de chaves.

Com o modelo modular (MASTER SPEC v0.2), o cadastro deverá levar ao **VELDOCS Builder** e o trial de 14 dias começará após a escolha dos módulos — isso pertence à FASE 3 (catálogo de módulos, entitlements, Builder, preço e trial).

## Primeiros passos (desenvolvimento)

```bash
cp .env.example .env
pnpm install
pnpm db:up
pnpm db:deploy
pnpm dev
```
