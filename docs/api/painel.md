# VELDOCS — Painel da empresa

Fonte da verdade: `src/app/api/dashboard/route.ts`, [`src/application/dashboard/dashboard-queries.ts`](../../src/application/dashboard/dashboard-queries.ts), [`src/infrastructure/database/prisma-dashboard-repository.ts`](../../src/infrastructure/database/prisma-dashboard-repository.ts) e a tela `/painel` ([`docs/frontend/telas.md`](../frontend/telas.md)).

Panorama da empresa ativa (MASTER SPEC 11.1). Cada parte segue a própria regra, então o painel nunca mostra a um perfil o que ele não veria pelas outras telas.

## Endpoint

| Método | Rota | Permissão |
|---|---|---|
| `GET` | `/api/dashboard` | `documents.read` |

## Resposta

| Campo | Quem recebe | Conteúdo |
|---|---|---|
| `today` | todos | hoje em Brasília (`AAAA-MM-DD`) |
| `documents` | todos | `total`, `withoutCategory`, `withoutResponsible`, `withoutExpiration` e `createdLast30Days` — só documentos vivos |
| `categories` | todos | `items`: as 6 categorias com mais documentos (`categoryId: null` = sem categoria) e `others`: a soma do restante |
| `expirations` | **módulo Controle de vencimentos** | o mesmo resumo de `GET /api/expirations`, com até 5 documentos em `upcoming`; `null` sem o módulo |
| `activity` | perfis com `audit.read` (Proprietário, Administrador, Gestor) | os 8 eventos mais recentes, com `action`, `actorName`, `entityName` e `createdAt`; `null` sem a permissão |

## Atividade recente

Entram só **ações sobre os dados da empresa**: documentos (inclusive renovação), categorias, membros e convites, empresa, filiais, setores e assinatura (`DASHBOARD_ACTIVITY_ACTIONS`). Eventos de acesso — login, segundo fator, sessão — ficam de fora: dizem respeito a cada pessoa, não à rotina da equipe.

O nome do documento, da categoria, da filial ou do setor é resolvido em lote e sempre dentro da empresa. Registro excluído continua com nome, para a atividade dizer o que foi excluído. Os metadados da auditoria não são expostos.

## Na tela

- Os números levam à lista correspondente: os de situação abrem `/documentos?status=…`, as barras de categoria abrem `/documentos?categoryId=…`. A página de documentos confere esses parâmetros — situação só vale com o módulo, e categoria precisa ser um uuid.
- Sem o módulo, se a empresa já tem documentos com validade, o painel mostra uma sugestão discreta do Controle de vencimentos (MASTER SPEC 2.10), no lugar do bloco de vencimentos.

## Testes

| Nível | Arquivo |
|---|---|
| Unitário | [`tests/unit/application/dashboard/dashboard-queries.test.ts`](../../tests/unit/application/dashboard/dashboard-queries.test.ts), [`tests/unit/presentation/activity.test.ts`](../../tests/unit/presentation/activity.test.ts) |
| Integração | [`tests/integration/dashboard/dashboard.test.ts`](../../tests/integration/dashboard/dashboard.test.ts) |
| E2E | [`tests/e2e/dashboard.spec.ts`](../../tests/e2e/dashboard.spec.ts) |
