# VELDOCS — API do Builder e da assinatura

Fonte da verdade: `src/app/api/builder/`, `src/app/api/subscription/`, [`src/application/billing/`](../../src/application/billing/) e [`src/domain/billing/`](../../src/domain/billing/).

O Builder é o passo seguinte ao cadastro (MASTER SPEC 2.4): a empresa escolhe um kit e/ou módulos, vê o preço mensal calculado pelo servidor e inicia o trial de 14 dias. A tela `/builder` usa esta API — ver [`docs/frontend/telas.md`](../frontend/telas.md).

## Permissões

| Permissão | Quem tem | Uso |
|---|---|---|
| `billing.read` | OWNER e ADMIN | ver catálogo, orçamento e situação da assinatura |
| `billing.manage` | OWNER e ADMIN | iniciar o trial |

As duas **continuam valendo com a assinatura bloqueada** (trial vencido, atraso, cancelada, suspensa): é o caminho para a empresa ver sua situação e assinar ou reativar (MASTER SPEC 2.9, DEC-026). Todas as outras rotas ficam bloqueadas nesse estado (DEC-022).

## Endpoints

| Método | Rota | Permissão | Resposta |
|---|---|---|---|
| `GET` | `/api/builder/catalog` | `billing.read` | `{ currency, trialDays, modules, kits }` com preços vigentes |
| `GET` | `/api/builder/quote?modules=a,b` | `billing.read` | `{ kind: "modules", quote }` — total avulso e `suggestion` de kit |
| `GET` | `/api/builder/quote?kit=k&modules=a,b` | `billing.read` | `{ kind: "kit", quote }` — kit + módulos fora dele |
| `POST` | `/api/builder/trial` | `billing.manage` | `201 { subscription }` |
| `GET` | `/api/subscription` | `billing.read` | `{ subscription }` |

## Fluxo

1. Cadastro → `GET /api/subscription` responde `status: "NOT_STARTED"`: a empresa ainda não passou pelo Builder e usa só o Core.
2. `GET /api/builder/catalog` para montar a tela.
3. `GET /api/builder/quote` a cada mudança na seleção (preço em tempo real).
4. `POST /api/builder/trial` com `{ "kitKey": "gestao", "modules": ["contratos"] }` (os dois campos são opcionais).
5. `GET /api/subscription` passa a mostrar o trial, os dias restantes e o valor após o trial.

## Orçamento

- O Core entra sempre; dependências são resolvidas.
- **Kit + avulsos:** paga-se o kit e, à parte, só os módulos fora dele (DEC-024).
- **Sugestão:** o kit que deixa a mesma seleção mais barata, mesmo que traga módulos a mais; sem economia real, `suggestion: null`.
- Valores em **centavos inteiros**; módulo sem preço vigente aparece em `unpriced`, chave desconhecida em `unknown`.

## Início do trial

Validações, todas antes de gravar qualquer coisa:

| Situação | Resposta |
|---|---|
| Módulo inexistente | `400 invalid_input` — `issues[].field = "modules"` |
| Kit inexistente ou sem preço vigente | `400 invalid_input` — `issues[].field = "kitKey"` |
| Módulo indisponível (`COMING_SOON`/`RETIRED`) ou sem preço | `400 invalid_input` |
| A empresa já tem assinatura | `409 trial_already_started` |

Numa única transação: cria a assinatura `TRIALING` (14 dias a partir de agora, com o kit escolhido) e ativa os módulos resolvidos (Core + kit + extras + dependências). `subscriptions.company_id` é único, então duas requisições simultâneas não criam dois trials. Grava a auditoria `subscription.trial_started` com kit, módulos e valor mensal.

## Situação da assinatura

| Campo | Significado |
|---|---|
| `status` | `NOT_STARTED` ou o estado efetivo (`TRIAL_ACTIVE`, `TRIAL_EXPIRING`, `TRIAL_EXPIRED`, `ACTIVE`, `REACTIVATED`, `PAYMENT_PENDING`, `PAST_DUE`, `CANCELED`, `SUSPENDED`) |
| `hasAccess` | a empresa consegue usar o sistema |
| `trial` | `{ startedAt, endsAt, daysRemaining }` enquanto estiver em trial |
| `kit` / `modules` | kit escolhido e módulos ativos, na ordem do catálogo |
| `monthlyTotalCents` | valor mensal com os preços vigentes — o que será cobrado após o trial |
| `dataRetentionUntil` | até quando os dados ficam guardados em assinatura cancelada (1 ano) ou suspensa (2 meses) — DEC-025 |

## Escritas

`POST /api/builder/trial` passa por `prepareWrite`: origem (CSRF) → limite de 30/min por IP → autorização → corpo JSON. As leituras usam o limite geral de 120/min por IP.

## Ainda não existe

- Trocar kit ou módulos durante o trial (MASTER SPEC 2.8).
- Pagamento e as transições de assinatura acionadas por cobrança (FASE 16).
- Exclusão de contas após a retenção (DEC-025).

## Testes

| Nível | Arquivo |
|---|---|
| Unitário | [`tests/unit/application/billing/subscription-use-cases.test.ts`](../../tests/unit/application/billing/subscription-use-cases.test.ts), [`tests/unit/domain/access-control/permission-modules.test.ts`](../../tests/unit/domain/access-control/permission-modules.test.ts), [`tests/unit/application/access/authorize-and-select.test.ts`](../../tests/unit/application/access/authorize-and-select.test.ts) |
| Integração | [`tests/integration/billing/subscription.test.ts`](../../tests/integration/billing/subscription.test.ts) |
| E2E | [`tests/e2e/builder.spec.ts`](../../tests/e2e/builder.spec.ts) |
