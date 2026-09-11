# VELDOCS — API de empresa, filiais e setores

Fonte da verdade: `src/app/api/company/`, [`src/application/access/manage-company.ts`](../../src/application/access/manage-company.ts) e [`src/infrastructure/database/prisma-company-management-repository.ts`](../../src/infrastructure/database/prisma-company-management-repository.ts).

Toda rota exige sessão autenticada. A empresa **nunca** vem da requisição: é a empresa ativa da sessão (`AuthorizedContext`). Um id de outra empresa se comporta como inexistente.

## Endpoints

| Método | Rota | Permissão |
|---|---|---|
| `GET` | `/api/company` | `company.read` |
| `PATCH` | `/api/company` | `company.update` |
| `GET` / `POST` | `/api/company/branches` | `branches.read` / `branches.manage` |
| `GET` / `PATCH` / `DELETE` | `/api/company/branches/[branchId]` | `branches.read` / `branches.manage` |
| `GET` / `POST` | `/api/company/departments` | `departments.read` / `departments.manage` |
| `GET` / `PATCH` / `DELETE` | `/api/company/departments/[departmentId]` | `departments.read` / `departments.manage` |

Como OWNER e ADMIN exigem segundo fator (DEC-020), a sessão precisa estar verificada antes de qualquer escrita.

## Escritas

Toda rota de escrita passa por `prepareWrite` ([`write-route.ts`](../../src/infrastructure/http/write-route.ts)), nesta ordem:

1. **Origem** — `Origin` igual a `APP_URL`, senão `403 forbidden_origin` (CSRF);
2. **Limite** — 30 requisições/min por IP (leituras: 120), senão `429` com `Retry-After`;
3. **Autorização** — cadeia completa (sessão → pessoa → empresa → vínculo → MFA → permissão → módulo);
4. **Corpo** — `application/json` até 16 KB.

## Campos

| Recurso | Campos | Regras |
|---|---|---|
| Empresa | `name`, `legalName`, `taxId` | `name` de 2 a 200 caracteres; `taxId` é CNPJ com dígitos verificadores válidos, aceito com ou sem máscara e **gravado só com dígitos** |
| Filial | `name`, `code` | `code` opcional, até 40 caracteres em `[A-Za-z0-9._-]`, único por empresa |
| Setor | `name`, `branchId` | `branchId` opcional: `null` = setor da empresa inteira; se informado, precisa ser filial ativa da mesma empresa |

String vazia equivale a ausente (vira `null`).

## Respostas de erro

| Situação | Resposta |
|---|---|
| Validação | `400 invalid_input` com `issues: [{ field, message }]` |
| Recurso de outra empresa, inexistente ou id inválido | `404 not_found` |
| Código de filial repetido | `409 conflict` |
| Filial com setores/documentos ativos, setor com documentos ativos | `409 resource_in_use` |
| Sem sessão / sem permissão | `401 unauthenticated` / `403 forbidden` |

## Exclusão

É lógica (`deleted_at`) e recusada enquanto houver vínculos ativos — o `ON DELETE RESTRICT` do banco não cobre isso, então os vínculos são conferidos em transação. Ao excluir uma filial, o `code` é liberado para reuso (DEC-021).

## Auditoria

Cada escrita bem-sucedida grava em `audit_logs`: `company.updated`, `branch.created`, `branch.updated`, `branch.deleted`, `department.created`, `department.updated`, `department.deleted` — com empresa, autor, IP e user agent. Tentativa recusada não gera evento.

## Testes

| Nível | Arquivo |
|---|---|
| Unitário | [`tests/unit/domain/company/cnpj.test.ts`](../../tests/unit/domain/company/cnpj.test.ts), [`tests/unit/application/access/manage-company.test.ts`](../../tests/unit/application/access/manage-company.test.ts) |
| Integração | [`tests/integration/access/company-management.test.ts`](../../tests/integration/access/company-management.test.ts) |
| E2E | [`tests/e2e/company-management.spec.ts`](../../tests/e2e/company-management.spec.ts) |
