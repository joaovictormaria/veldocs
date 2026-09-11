# VELDOCS — API de documentos, categorias e etiquetas

Fonte da verdade: `src/app/api/documents/`, `src/app/api/categories/`, `src/app/api/tags/`, [`src/application/documents/`](../../src/application/documents/), [`src/domain/documents/`](../../src/domain/documents/) e [`src/infrastructure/database/prisma-document-repository.ts`](../../src/infrastructure/database/prisma-document-repository.ts).

Núcleo documental da FASE 4 (MASTER SPEC 10.1). **Só metadados**: o arquivo em si, o upload e o download pertencem à FASE 5 (storage), e as versões à FASE 6.

As telas `/documentos` e `/categorias` usam esta API — ver [`docs/frontend/telas.md`](../frontend/telas.md).

Toda rota exige sessão autenticada. A empresa **nunca** vem da requisição: é a empresa ativa da sessão. Um id de outra empresa se comporta como inexistente.

## Endpoints

| Método | Rota | Permissão |
|---|---|---|
| `GET` / `POST` | `/api/categories` | `categories.read` / `categories.manage` |
| `GET` / `PATCH` / `DELETE` | `/api/categories/[categoryId]` | `categories.read` / `categories.manage` |
| `GET` / `POST` | `/api/documents` | `documents.read` / `documents.create` |
| `GET` / `PATCH` / `DELETE` | `/api/documents/[documentId]` | `documents.read` / `documents.update` / `documents.delete` |
| `GET` | `/api/tags` | `documents.read` |
| `GET` | `/api/expirations` | `expirations.read` — **módulo Controle de vencimentos** |
| `POST` | `/api/documents/[documentId]/renew` | `expirations.manage` — **módulo Controle de vencimentos** |

As permissões já existiam no catálogo e nos perfis padrão: Gestor cria, edita e exclui; Colaborador cria e edita; Visualizador só lê.

## Campos do documento

| Campo | Regras |
|---|---|
| `title` | obrigatório, de 2 a 255 caracteres |
| `description` | opcional, até 5000 caracteres |
| `categoryId`, `branchId`, `departmentId` | opcionais; precisam existir, estar ativos e ser da mesma empresa |
| `responsibleUserId` | opcional; precisa ser **membro ativo** da empresa |
| `issueDate`, `expirationDate` | opcionais, no formato `AAAA-MM-DD`; a validade não pode ser anterior à emissão |
| `tags` | até 10 por documento, 40 caracteres cada |

String vazia equivale a ausente (vira `null`). `PATCH` substitui os campos editáveis: o que não for enviado fica nulo — mesmo comportamento das rotas de filiais e setores.

Regras que valem a pena conhecer:

- **Setor e filial precisam combinar:** setor de uma filial em documento de outra é recusado (`departmentId`).
- **Responsável só é reconferido quando muda:** quem já era responsável e foi suspenso depois não impede editar o resto do documento.
- **Datas são de calendário**, não instantes: `2026-09-11` é o mesmo dia em qualquer fuso (colunas `date`).
- **Etiquetas são da empresa:** "Fiscal", "fiscal" e "FISCAL" são a mesma etiqueta; a primeira grafia é a que fica. Criar um documento com etiqueta nova cria a etiqueta.

## Busca e filtros

`GET /api/documents` aceita:

| Parâmetro | Efeito |
|---|---|
| `q` | busca em título, descrição e etiquetas, **sem depender de acento** (`certidao` encontra "Certidão"); todos os termos precisam aparecer (até 6) |
| `categoryId` | a categoria **e todas as subcategorias** dela |
| `tag` | nome da etiqueta, também sem depender de acento ou maiúscula |
| `responsibleUserId`, `branchId`, `departmentId` | filtro exato |
| `sort` | `recent` (padrão), `title`, `created` ou `expiration` (vencimento mais próximo, sem validade no fim — só com o módulo) |
| `status` | `EXPIRED`, `EXPIRING`, `VALID` ou `NO_EXPIRATION` — só com o módulo Controle de vencimentos |
| `page`, `pageSize` | página a partir de 1; até 100 por página (padrão 20) |

Resposta: `{ items, total, page, pageSize }`. Parâmetro vazio (`?tag=`) vale como ausente; parâmetro inválido responde `400 invalid_input`.

A busca não usa extensão do PostgreSQL: cada documento guarda um texto já normalizado (minúsculas, sem acento) em `documents.search_text`, atualizado a cada gravação.

## Categorias

Árvore de **até 3 níveis** (categoria → subcategoria → subcategoria). Cada categoria responde com `path` (`["Pessoal", "Admissão"]`), `depth` e `documentCount` (documentos vivos diretamente nela).

| Situação | Resposta |
|---|---|
| Categoria superior inexistente ou de outra empresa | `400 invalid_input` (`parentId`) |
| Passaria de 3 níveis — inclusive movendo uma subárvore | `400 invalid_input` (`parentId`) |
| Categoria dentro dela mesma ou de uma descendente | `400 invalid_input` (`parentId`) |
| Nome repetido entre categorias irmãs | `409 conflict` |
| Categoria com subcategorias ou documentos | `409 resource_in_use` |

Nível, ciclo e nome repetido dependem de ler a árvore antes de gravar; as escritas de categoria de uma empresa são serializadas por um `pg_advisory_xact_lock`, senão duas requisições simultâneas passariam cada uma na sua checagem.

## Vencimentos (módulo Controle de vencimentos)

Capacidade de **módulo pago** (DEC-033). A data de validade é do Core; a situação, o painel e a renovação são do módulo `vencimentos`.

| Situação | Regra (hoje em Brasília) |
|---|---|
| `EXPIRED` — Vencido | validade antes de hoje |
| `EXPIRING` — Vence em breve | de hoje até 30 dias à frente |
| `VALID` — Em dia | depois da janela |
| `NO_EXPIRATION` — Sem validade | documento sem data de validade |

A situação é **derivada** na leitura, nunca gravada. Com o módulo, cada item de `GET /api/documents` traz `expirationStatus`; sem ele, o campo não vem, e pedir `status` ou `sort=expiration` responde `403 module_not_enabled`.

`GET /api/expirations?days=30&limit=10` responde `{ today, windowDays, counts: { valid, expiring, expired, withoutExpiration, total }, upcoming }` — `upcoming` traz vencidos e a vencer na janela, do mais urgente, com `expirationStatus` e `daysRemaining` (negativo quando já venceu).

`POST /api/documents/[documentId]/renew` com `{ "issueDate": "2026-09-11", "expirationDate": "2027-09-11" }` troca só as datas. A nova validade precisa ser **posterior à atual** e não pode ser anterior à emissão.

## Exclusão

É **lógica** (`deleted_at`), como no resto do sistema: o documento sai das listagens e da busca, mas nada é apagado — inclusive as etiquetas dele continuam gravadas (MASTER SPEC 17.2). A recuperação de excluídos é da FASE 6.

## Escritas

Toda rota de escrita passa por `prepareWrite`: origem (CSRF) → limite de 30/min por IP → autorização → corpo JSON até 16 KB. As leituras usam o limite geral de 120/min por IP.

## Auditoria

| Ação | Metadados |
|---|---|
| `document.created` | categoria, filial, setor, responsável, quantidade de etiquetas e se tem validade |
| `document.updated` | `changedFields`: quais campos mudaram |
| `document.deleted` | — |
| `category.created` / `category.updated` / `category.deleted` | — |
| `document.renewed` | emissão e validade anteriores e novas |

Título, descrição e conteúdo **não** entram na auditoria. Tentativa recusada não gera evento.

## Testes

| Nível | Arquivo |
|---|---|
| Unitário | [`tests/unit/domain/documents/document-rules.test.ts`](../../tests/unit/domain/documents/document-rules.test.ts), [`tests/unit/application/documents/manage-documents.test.ts`](../../tests/unit/application/documents/manage-documents.test.ts) |
| Integração | [`tests/integration/documents/documents.test.ts`](../../tests/integration/documents/documents.test.ts) |
| E2E | [`tests/e2e/documents.spec.ts`](../../tests/e2e/documents.spec.ts), [`tests/e2e/expirations.spec.ts`](../../tests/e2e/expirations.spec.ts) |
| Vencimentos (unitário e integração) | [`tests/unit/domain/documents/expiration.test.ts`](../../tests/unit/domain/documents/expiration.test.ts), [`tests/unit/application/documents/manage-expirations.test.ts`](../../tests/unit/application/documents/manage-expirations.test.ts), [`tests/integration/documents/expirations.test.ts`](../../tests/integration/documents/expirations.test.ts) |
