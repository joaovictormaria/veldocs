# VELDOCS — Modelo de dados

Fonte da verdade: [`prisma/schema.prisma`](../../prisma/schema.prisma) e [`prisma/migrations/`](../../prisma/migrations/).

## Convenções

| Item | Convenção |
|---|---|
| IDs | UUID v7 (`@default(uuid(7))`, coluna `uuid`) — ordenável no tempo, não sequencial |
| Nomes no banco | `snake_case` (tabelas no plural) via `@@map`/`@map` |
| Datas-hora | `timestamptz(3)`; datas de negócio (`issue_date`, `expiration_date`) como `date` |
| Campos de auditoria | `created_at`, `updated_at`; `deleted_at` para soft delete onde aplicável |
| Tenant | `company_id` (equivalente ao `tenant_id` do MASTER SPEC) |
| Exclusão | `ON DELETE RESTRICT` por padrão; `CASCADE` apenas em junções e sessões |
| Dinheiro | inteiro em centavos (`amount_cents`), nunca ponto flutuante |

## Entidades

| Tabela | Escopo | Observações |
|---|---|---|
| `companies` | tenant raiz | `slug` único; `status` ACTIVE/SUSPENDED |
| `branches` | tenant | `code` único por empresa |
| `departments` | tenant | opcionalmente vinculado a uma filial do mesmo tenant |
| `users` | **global (pessoa)** | e-mail único e em minúsculas; CPF opcional só como HMAC + cifrado; hash Argon2id; status ACTIVE/DISABLED |
| `memberships` | tenant | vínculo pessoa ↔ empresa; `(company_id, user_id)` único; status INVITED/ACTIVE/SUSPENDED/REMOVED — removido não é apagado, porque a auditoria referencia o vínculo (DEC-027) |
| `roles` | tenant | `key` única por empresa; `is_system` para os 5 perfis padrão |
| `permissions` | **global** | catálogo do sistema; `key` única no formato `recurso.acao` (CHECK) |
| `role_permissions` | via `roles` | junção perfil ↔ permissão |
| `user_roles` | tenant | perfil de um **membro**: FK `(company_id, user_id)` → `memberships` |
| `document_categories` | tenant | hierarquia (subcategoria) dentro do mesmo tenant |
| `documents` | tenant | metadados; categoria, filial, setor do mesmo tenant; responsável e criador precisam ser membros; `search_text` guarda título, descrição e etiquetas sem acento para a busca (DEC-031) |
| `tags` | tenant | etiqueta livre da empresa; `normalized_name` único por empresa evita duplicar por acento ou maiúscula (DEC-032) |
| `document_tags` | tenant | junção documento ↔ etiqueta, com FKs compostas: os dois são sempre da mesma empresa |
| `audit_logs` | tenant (opcional) | append-only; sem empresa para eventos como login; com empresa, o autor precisa ser membro |
| `sessions` | pessoa | `id` = SHA-256 do token; empresa ativa precisa ser vínculo da pessoa; expiração por inatividade e absoluta |
| `rate_limit_buckets` | sistema | janela fixa por chave; chaves sem dado pessoal em claro |
| `modules` | **global** | catálogo comercial (MASTER SPEC 2.3); `key` estável usada nos entitlements; `is_core`; `status` AVAILABLE/COMING_SOON/RETIRED; **povoado pela migração** (DEC-023) |
| `module_dependencies` | **global** | "módulo depende de módulo" (MASTER SPEC 2.6); nenhuma dependência declarada ainda |
| `module_prices` | **global** | preço por módulo em centavos, com histórico (`valid_from`/`valid_until`); preços iniciais de 2026-09-11 **povoados pela migração**; preço nunca é sobrescrito |
| `company_invitations` | tenant | convite por link: só o SHA-256 do token; 7 dias, um uso; perfil e autor da mesma empresa por FK composta (DEC-028) |
| `kits` | **global** | kits comerciais (MASTER SPEC 2.7, DEC-024); **povoados pela migração** |
| `kit_modules` | **global** | módulos incluídos em cada kit; FK para `modules` |
| `kit_prices` | **global** | preço por kit, com o mesmo histórico e as mesmas regras dos preços de módulo |
| `company_modules` | tenant | módulo contratado pela empresa (entitlement); PK `(company_id, module_key)`; toda empresa nova nasce com o Core |
| `subscriptions` | tenant | uma por empresa; estado canônico e datas do trial; `TRIAL_EXPIRING`/`TRIAL_EXPIRED` são derivados do tempo (DEC-022); `canceled_at`/`suspended_at` contam a retenção de 1 ano / 2 meses (DEC-025); `kit_key` guarda o kit escolhido no Builder |

## Isolamento multi-tenant no banco

Entidades de tenant expõem `UNIQUE (company_id, id)` e toda referência entre entidades do mesmo tenant usa FK composta:

```sql
FOREIGN KEY (company_id, category_id) REFERENCES document_categories (company_id, id)
FOREIGN KEY (company_id, responsible_user_id) REFERENCES memberships (company_id, user_id)
```

Consequências garantidas pelo PostgreSQL, mesmo com bug na aplicação:

- documento da empresa A não aponta para categoria, filial, setor ou pessoa da empresa B;
- perfil só é atribuído a quem é membro da empresa, e só com perfil daquela empresa;
- sessão só tem como empresa ativa uma empresa da qual a pessoa é membro;
- evento de auditoria de uma empresa só tem como autor um membro dela;
- empresa só contrata módulo que existe no catálogo (FK `company_modules.module_key` → `modules.key`).

Isso é **defesa em profundidade** — a autorização server-side por tenant continua obrigatória para leituras e filtros.

> Uso do Prisma Client: como `company_id` participa de várias relações, alterações de vínculo devem usar os campos escalares (`categoryId: null`) e não `disconnect`, que tentaria anular `company_id`.

## Regras aplicadas por SQL manual

| Regra | Objeto | Migração |
|---|---|---|
| E-mail em minúsculas | `users_email_lowercase_chk` | `init_base_entities` |
| Formato `recurso.acao` | `permissions_key_format_chk` | `init_base_entities` |
| Auditoria append-only | função `audit_logs_prevent_mutation` + trigger `audit_logs_append_only` | `init_base_entities` |
| CPF só como HMAC hexadecimal | `users_cpf_lookup_hash_format_chk` | `identity_memberships_sessions` |
| Hash e valor cifrado do CPF em par | `users_cpf_fields_paired_chk` | `identity_memberships_sessions` |
| Id de sessão é SHA-256 | `sessions_id_format_chk` | `identity_memberships_sessions` |
| Inatividade ≤ expiração absoluta | `sessions_expiry_order_chk` | `identity_memberships_sessions` |
| Contador de tentativas positivo | `rate_limit_buckets_count_positive_chk` | `identity_memberships_sessions` |
| Catálogo inicial de módulos | `INSERT` dos 17 módulos | `commercial_catalog_and_subscriptions` |
| Core para empresas já existentes | `INSERT … SELECT` em `company_modules` | `commercial_catalog_and_subscriptions` |
| Preço não negativo | `module_prices_amount_non_negative_chk` | `module_prices_initial` |
| Vigência em ordem (`valid_until` > `valid_from`) | `module_prices_validity_order_chk` | `module_prices_initial` |
| Moeda com 3 letras maiúsculas | `module_prices_currency_format_chk` | `module_prices_initial` |
| Preços iniciais dos 17 módulos | `INSERT` em `module_prices` | `module_prices_initial` |
| Preço de kit não negativo, vigência em ordem e moeda com 3 letras | `kit_prices_amount_non_negative_chk`, `kit_prices_validity_order_chk`, `kit_prices_currency_format_chk` | `kits_and_subscription_retention` |
| Os 6 kits, sua composição e preços | `INSERT` em `kits`, `kit_modules` e `kit_prices` | `kits_and_subscription_retention` |
| Permissões `billing.read`/`billing.manage` para OWNER e ADMIN das empresas existentes | `INSERT` em `permissions` e `INSERT … SELECT` em `role_permissions` | `builder_trial_and_billing_permissions` |
| E-mail do convite em minúsculas, token só como SHA-256 hexadecimal, convite não pode ser aceito e revogado ao mesmo tempo | `company_invitations_email_lowercase_chk`, `company_invitations_token_hash_format_chk`, `company_invitations_accepted_or_revoked_chk` | `members_invitations` |
| Título não vazio e validade nunca antes da emissão | `documents_title_not_blank_chk`, `documents_dates_order_chk` | `documents_categories_tags` |
| Categoria com nome não vazio e que não é filha de si mesma | `document_categories_name_not_blank_chk`, `document_categories_not_own_parent_chk` | `documents_categories_tags` |
| Etiqueta com nome não vazio e nome normalizado em minúsculas, sem espaços nas pontas | `tags_name_not_blank_chk`, `tags_normalized_name_format_chk` | `documents_categories_tags` |
| Permissões do Controle de vencimentos: leitura para os 5 perfis padrão, renovação para OWNER, ADMIN, GESTOR e COLABORADOR | `INSERT` em `permissions` e `INSERT … SELECT` em `role_permissions` | `expiration_permissions` |

## Migrações

| Migração | Conteúdo |
|---|---|
| `20260910225812_init_base_entities` | enums, 11 tabelas, índices, FKs compostas por tenant, CHECKs e trigger append-only |
| `20260911003408_identity_memberships_sessions` | pessoa global + `memberships` (com **migração de dados**: cada pessoa existente ganha vínculo com sua empresa; `DISABLED` → vínculo `SUSPENDED`; pessoa `INVITED` → ACTIVE com vínculo `INVITED`), CPF protegido, senha, `sessions`, `rate_limit_buckets` e FKs para vínculos |
| `20260911021759_mfa_totp_recovery_codes` | segredo TOTP cifrado e códigos de recuperação |
| `20260911033935_commercial_catalog_and_subscriptions` | `modules`, `module_dependencies`, `module_prices`, `company_modules` e `subscriptions`; povoa o catálogo e dá o Core a toda empresa já existente |
| `20260911044509_module_prices_initial` | CHECKs de preço e preços mensais iniciais dos 17 módulos (decisão do usuário em 2026-09-11) |
| `20260911051529_kits_and_subscription_retention` | `kits`, `kit_modules` e `kit_prices` com os 6 kits; coluna `subscriptions.suspended_at` para a retenção |
| `20260911054436_builder_trial_and_billing_permissions` | coluna `subscriptions.kit_key` (FK para `kits`) e permissões de assinatura para OWNER e ADMIN já existentes |
| `20260911061303_members_invitations` | status `REMOVED` em `MembershipStatus` e tabela `company_invitations` |
| `20260911173626_documents_categories_tags` | coluna `documents.search_text` (padrão `''`), tabelas `tags` e `document_tags` e os CHECKs do núcleo documental |
| `20260911184354_expiration_permissions` | permissões `expirations.read` e `expirations.manage` (módulo Controle de vencimentos), concedidas aos perfis de sistema das empresas existentes |

A preservação de dados da migração `identity_memberships_sessions` foi verificada em 2026-09-11 num banco descartável: migração 1 → dados no formato antigo (pessoas INVITED/ACTIVE/DISABLED, perfil, documento com responsável e criador, auditoria) → migração 2 → vínculos e status corretos, nenhum registro perdido.

Fluxo:

- desenvolvimento: `pnpm db:migrate` (`prisma migrate dev`, interativo). Em ambiente não interativo, gerar o SQL com `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` e revisar;
- staging/produção: `pnpm db:deploy` (`prisma migrate deploy`) — nunca `migrate dev`/`reset`;
- testes de integração recriam o schema do banco `*_test` e aplicam `migrate deploy` a cada execução; a limpeza entre testes **preserva** as tabelas povoadas pela migração (`modules`, `module_dependencies`, `module_prices`, `kits`, `kit_modules`, `kit_prices`), senão o cadastro falharia pela FK do Core e os preços reais sumiriam.

## Decisões pendentes

- Unicidade de CNPJ (`tax_id`) entre empresas.
- Retenção/expurgo de `audit_logs` (append-only) frente a LGPD — definir procedimento controlado.
- Rotação das chaves `APP_ENCRYPTION_KEY` (formato cifrado já é versionado: `v1.`) e `APP_HMAC_KEY`.
- Limpeza periódica de `sessions` expiradas e `rate_limit_buckets` vencidos (job).
- Row-Level Security (RLS) do PostgreSQL como camada adicional de isolamento.
- Índice de texto para a busca documental (trigrama ou `tsvector` sobre `documents.search_text`), quando o volume justificar (DEC-031).
- Exclusão de contas após o prazo de retenção (DEC-025): irreversível, depende de autorização explícita; o prazo legal de 1 ano após o cancelamento deve ser confirmado com o jurídico.
