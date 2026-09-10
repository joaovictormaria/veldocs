# VELDOCS — Modelo de dados base (FASE 1)

Fonte da verdade: [`prisma/schema.prisma`](../../prisma/schema.prisma) e [`prisma/migrations/`](../../prisma/migrations/).

## Convenções

| Item | Convenção |
|---|---|
| IDs | UUID v7 (`@default(uuid(7))`, coluna `uuid`) — ordenável no tempo, não sequencial |
| Nomes no banco | `snake_case` (tabelas no plural) via `@@map`/`@map` |
| Datas-hora | `timestamptz(3)`; datas de negócio (`issue_date`, `expiration_date`) como `date` |
| Campos de auditoria | `created_at`, `updated_at`; `deleted_at` para soft delete onde aplicável |
| Tenant | `company_id` (equivalente ao `tenant_id` do MASTER SPEC) |
| Exclusão | `ON DELETE RESTRICT` por padrão; `CASCADE` apenas em tabelas de junção |

## Entidades

| Tabela | Escopo | Observações |
|---|---|---|
| `companies` | tenant raiz | `slug` único; `status` ACTIVE/SUSPENDED |
| `branches` | tenant | `code` único por empresa |
| `departments` | tenant | opcionalmente vinculado a uma filial do mesmo tenant |
| `users` | tenant | `email` único global e em minúsculas (CHECK); status INVITED/ACTIVE/DISABLED; sem credenciais (FASE 2) |
| `roles` | tenant | `key` única por empresa; `is_system` para perfis padrão |
| `permissions` | **global** | catálogo do sistema; `key` única no formato `recurso.acao` (CHECK) |
| `role_permissions` | via `roles` | junção perfil ↔ permissão |
| `user_roles` | tenant | junção usuário ↔ perfil com `company_id` explícito |
| `document_categories` | tenant | hierarquia (subcategoria) dentro do mesmo tenant |
| `documents` | tenant | metadados; categoria, filial, setor, responsável e criador do mesmo tenant |
| `audit_logs` | tenant (opcional) | append-only; `company_id` nulo apenas para eventos sem tenant resolvido |

## Isolamento multi-tenant no banco

Cada entidade de tenant expõe `UNIQUE (company_id, id)`. Toda referência entre entidades do mesmo tenant usa FK composta:

```sql
FOREIGN KEY (company_id, category_id) REFERENCES document_categories (company_id, id)
```

Consequência: o PostgreSQL **rejeita** vínculos cross-tenant mesmo que a aplicação tenha um bug (ex.: documento da empresa A com categoria da empresa B, perfil da empresa B atribuído a usuário da empresa A). Isso é uma **defesa em profundidade** — a autorização server-side por tenant (FASE 2) continua obrigatória para leituras e para filtrar consultas.

> Nota para uso do Prisma Client: como `company_id` participa de várias relações, alterações de vínculo devem usar os campos escalares (`categoryId: null`) e não `disconnect`, que tentaria anular `company_id`.

## Regras aplicadas por SQL manual (migração `init_base_entities`)

| Regra | Objeto |
|---|---|
| E-mail em minúsculas | `users_email_lowercase_chk` |
| Formato `recurso.acao` | `permissions_key_format_chk` |
| Auditoria append-only | função `audit_logs_prevent_mutation` + trigger `audit_logs_append_only` (bloqueia UPDATE/DELETE) |

## Migrações

| Migração | Conteúdo |
|---|---|
| `20260910225812_init_base_entities` | enums, 11 tabelas, índices, FKs compostas por tenant, CHECKs e trigger append-only |

Fluxo:

- desenvolvimento: `pnpm db:migrate` (`prisma migrate dev`);
- staging/produção: `pnpm db:deploy` (`prisma migrate deploy`) — nunca `migrate dev`/`reset`;
- testes de integração aplicam `migrate deploy` no banco `*_test` automaticamente.

## Decisões pendentes

- **DEC-005:** usuário pertence a uma única empresa e e-mail é único global. Usuários multiempresa (ex.: contadores) exigirão uma entidade de vínculo (membership) — decidir antes da FASE 4.
- Unicidade de CNPJ (`tax_id`) entre empresas.
- Retenção/expurgo de `audit_logs` (append-only) frente a LGPD — definir procedimento controlado.
- Row-Level Security (RLS) do PostgreSQL como camada adicional de isolamento — avaliar na FASE 2.
