# MASTER PROJECT SPECIFICATION
## VELDOCS — SaaS de Gestão Documental Empresarial

**Versão:** 0.5
**Status:** FASE 0 (Produto) e FASE 1 (Fundação técnica) concluídas — FASE 2 parcial (identidade multiempresa, cadastro, login e sessão)
**Produção:** https://veldocs-app-production.up.railway.app (Railway) — código em `joaovictormaria/veldocs` (GitHub, privado)
**Documento:** Fonte única de verdade do projeto
**Última atualização:** 2026-09-10

---

# 0. COMO USAR ESTE DOCUMENTO

Este arquivo é a especificação mestre do produto e deve acompanhar o projeto durante todo o ciclo de desenvolvimento.

O Claude Code deve:

1. Ler este documento antes de alterar o projeto.
2. Auditar o código existente antes de implementar qualquer item.
3. Nunca assumir que uma funcionalidade existe apenas porque está descrita aqui.
4. Comparar especificação, código, banco, testes e infraestrutura.
5. Implementar somente o que estiver pendente ou incompleto.
6. Não duplicar funcionalidades existentes.
7. Não remover comportamento existente sem justificativa.
8. Executar testes após mudanças.
9. Registrar evidências concretas para itens concluídos.
10. Atualizar este documento ao finalizar uma etapa relevante.

## Status oficiais

- ✅ CONCLUÍDO — implementado e validado com evidência.
- 🟡 PARCIAL — parte implementada, parte pendente.
- 🔴 NÃO IMPLEMENTADO — ainda não existe.
- ⚠️ PROBLEMA — existe, mas apresenta falha, risco ou comportamento incorreto.
- ⏳ BLOQUEADO — depende de outro requisito ou decisão.
- 🔍 AUDITAR — ainda precisa ser verificado no projeto real.

## Regra de conclusão

Nenhum item deve ser marcado como ✅ apenas porque o código parece existir. Para concluir, registrar:

- Evidência de implementação (arquivos, módulos, rotas ou componentes).
- Testes relevantes.
- Resultado dos testes.
- Data da validação.
- Observações importantes.

> **Convenção de checklists (desde 2026-09-10):** itens já auditados exibem um status oficial com evidência. Itens que ainda aparecem como `- [ ]` pertencem a fases não iniciadas e devem ser lidos como 🔴 NÃO IMPLEMENTADO até serem auditados na sua fase.

---

# 1. VISÃO DO PRODUTO

## 1.1 Objetivo

**Nome do produto:** VELDOCS

Criar o VELDOCS, um SaaS B2B para empresas organizarem, monitorarem e controlarem documentos empresariais, seus responsáveis, prazos, pendências e processos de renovação.

## 1.2 Problema

Empresas ainda utilizam combinações de:

- pastas locais;
- Google Drive/OneDrive;
- e-mail;
- WhatsApp;
- planilhas;
- lembretes manuais;
- processos não padronizados.

O VELDOCS deve reduzir a desorganização, atrasos, perda de documentos e falta de visibilidade sobre vencimentos.

## 1.3 Proposta de valor

> Organizar documentos, acompanhar prazos, identificar riscos e ajudar a empresa a resolver pendências antes que elas se tornem problemas.

## 1.4 Filosofia do produto

> **Zero surpresa documental.**

O sistema deve tentar perceber, alertar, explicar, recomendar e, quando autorizado, executar ações relacionadas à documentação empresarial.

## 1.5 Público inicial

Pequenas e médias empresas que precisam controlar documentos próprios, de funcionários, fornecedores e contratos, sem necessidade de uma plataforma corporativa excessivamente complexa.

## 1.6 Canais principais

- Dashboard web.
- WhatsApp.
- Portal externo para terceiros.
- Automações e notificações.

---

# 2. ESCOPO DO PRODUTO

## 2.1 MVP

> Auditado em 2026-09-10, ao fim da FASE 1. "Base de dados" = entidade/tabela criada e testada, sem regra de negócio, API ou tela.

- 🟡 PARCIAL — Empresa (base de dados: `companies`)
- 🟡 PARCIAL — Usuários (pessoa global com vínculos multiempresa e cadastro público; convites e gestão de membros — FASE 4)
- 🟡 PARCIAL — Autenticação (cadastro, login por e-mail ou CPF + senha, sessão, logout e logout geral; MFA, link mágico, recuperação de senha e Google pendentes)
- 🟡 PARCIAL — RBAC/permissões (catálogo de 18 permissões e 5 perfis padrão provisionados em cada empresa nova; verificação de permissão nas rotas pendente)
- 🟡 PARCIAL — Multi-tenancy (FKs compostas no banco, inclusive vínculo obrigatório para perfis, documentos, auditoria e empresa ativa da sessão; filtro por empresa nas rotas de negócio pendente)
- 🟡 PARCIAL — Documentos (base de dados: `documents`, somente metadados)
- 🟡 PARCIAL — Categorias (base de dados: `document_categories`, com subcategorias)
- 🔴 NÃO IMPLEMENTADO — Upload seguro
- 🔴 NÃO IMPLEMENTADO — Storage privado (apenas interface `StorageProvider`)
- 🔴 NÃO IMPLEMENTADO — Pesquisa
- 🔴 NÃO IMPLEMENTADO — Vencimentos (apenas colunas `issue_date`/`expiration_date`)
- 🔴 NÃO IMPLEMENTADO — Alertas
- 🔴 NÃO IMPLEMENTADO — Dashboard
- 🟡 PARCIAL — Auditoria/histórico (tabela `audit_logs` append-only; nenhum evento é registrado ainda)
- 🔴 NÃO IMPLEMENTADO — Versionamento

## 2.2 Evolução V2

- [ ] Funcionários
- [ ] Fornecedores
- [ ] Solicitações de documentos
- [ ] Aprovações
- [ ] Portal externo
- [ ] Contratos
- [ ] Automações
- [ ] Calendário documental
- [ ] Relatórios

## 2.3 Evolução V3

- [ ] Assistente IA no dashboard
- [ ] OCR
- [ ] Extração automática de dados
- [ ] Detecção de inconsistências
- [ ] Detecção de duplicidades
- [ ] Score documental
- [ ] Radar de risco
- [ ] WhatsApp
- [ ] Ações pelo WhatsApp
- [ ] Resumos automáticos
- [ ] Zero digitação
- [ ] Assistente proativo
- [ ] Modo auditoria

## 2.4 Produto maduro

- [ ] Billing e assinatura
- [ ] Painel administrativo do SaaS
- [ ] Observabilidade completa
- [ ] Escala de workers/serviços
- [ ] Integrações externas
- [ ] Marketplace/ecossistema

---

# 3. ARQUITETURA

## 3.1 Estratégia inicial

**Monólito modular**, com separação clara de domínio, aplicação, infraestrutura e apresentação.

Não adotar microserviços prematuramente.

A arquitetura deve permitir extrair componentes no futuro quando houver necessidade real de carga, equipe ou domínio.

## 3.2 Visão geral

```text
                    USUÁRIO
                       │
          ┌────────────┴────────────┐
          │                         │
      DASHBOARD                  WHATSAPP
          │                         │
          └────────────┬────────────┘
                       │
                 API / BACKEND
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   AUTENTICAÇÃO    MULTI-TENANT    RBAC
        │              │              │
        └──────────────┼──────────────┘
                       │
                MÓDULOS DO SISTEMA
                       │
 ┌─────────┬───────────┼────────┬──────────┬──────────┐
 │         │           │        │          │          │
Docs   Funcionários  Fornec.  Contratos Solicitações Automação
 │         │           │        │          │          │
 └─────────┴───────────┼────────┴──────────┴──────────┘
                       │
             ASSISTENTE / IA
                       │
          ┌────────────┴────────────┐
          │                         │
     PostgreSQL               Object Storage
          │                    (arquivos)
          │                         │
          └────────────┬────────────┘
                       │
                  Redis / Filas
                       │
                    Workers
              ┌────────┼────────┐
              │        │        │
             OCR    Antivírus  Alertas
```

## 3.3 Componentes

### Frontend

- Dashboard web responsivo.
- Design system.
- Estados de loading, vazio e erro.
- Interface adaptada por perfil.

### Backend/API

- Autenticação.
- Autorização.
- Multi-tenancy.
- Regras de negócio.
- APIs internas/externas.
- Auditoria.

### Banco

- PostgreSQL.

### Storage

- Object storage privado, como S3/R2 ou equivalente.

### Redis

- Cache quando necessário.
- Rate limiting.
- Filas.
- Coordenação de jobs quando aplicável.

### Workers

- Notificações.
- OCR.
- Antivírus.
- Processamento documental.
- Tarefas agendadas.
- Automações.

### Integrações

- WhatsApp Business API/provider.
- Provedor de IA desacoplado por interface.
- E-mail transacional.
- Futuras integrações externas.

---

# 4. MULTI-TENANCY

## Requisito crítico

Um cliente jamais pode acessar dados de outro cliente, mesmo manipulando IDs, parâmetros, URLs ou chamadas de API.

## Modelo conceitual

```text
Company
 ├── Branches
 ├── Users
 ├── Departments
 ├── Documents
 ├── Employees
 ├── Suppliers
 ├── Contracts
 └── Requests
```

## Requisitos

> `Company` é o tenant; a coluna `company_id` corresponde ao `tenant_id`.

- ✅ CONCLUÍDO — Todo recurso empresarial possui vínculo de tenant.
  - Evidência: `company_id NOT NULL` em `branches`, `departments`, `memberships`, `roles`, `user_roles`, `document_categories`, `documents` (`prisma/schema.prisma`). Desde a FASE 2, `users` é a pessoa global e o acesso a cada empresa passa por `memberships` (DEC-005).
  - Teste: `tests/integration/database/connection-and-migrations.test.ts` › "toda tabela de dados empresariais possui company_id obrigatório" — passou (2026-09-10).
  - Obs.: `permissions` é catálogo global do sistema; `role_permissions` herda o tenant via `roles`; `audit_logs.company_id` é opcional só para eventos sem tenant resolvido.
- 🟡 PARCIAL — Vínculos entre entidades pertencem ao mesmo tenant (defesa em profundidade no banco).
  - Evidência: 10 FKs compostas `(company_id, fk) → (company_id, id)` na migração `20260910225812_init_base_entities`.
  - Teste: `tests/integration/database/tenant-isolation-constraints.test.ts` — 14 testes, passou.
  - Obs.: garante escrita consistente; não substitui o filtro por tenant em leituras (FASE 2).
- 🔴 NÃO IMPLEMENTADO — Toda consulta valida tenant. (FASE 2)
- 🔴 NÃO IMPLEMENTADO — Toda mutação valida tenant. (FASE 2)
- 🔴 NÃO IMPLEMENTADO — Todo endpoint verifica tenant. (FASE 2 — hoje só existe `/api/health`, sem dados de tenant)
- 🔴 NÃO IMPLEMENTADO — Storage é isolado por tenant. (o contrato `StorageProvider` já exige `companyId`; implementação na FASE 6)
- 🔴 NÃO IMPLEMENTADO — Usuário não acessa outro tenant. (depende de autenticação/autorização — FASE 2)
- 🟡 PARCIAL — Testes de cross-tenant existem. (nível banco; testes de API/IDOR/BOLA na FASE 2)
- 🔴 NÃO IMPLEMENTADO — Jobs assíncronos preservam contexto de tenant. (contratos `NotificationMessage`/`AuditEvent` carregam `companyId`; workers não existem)
- 🔴 NÃO IMPLEMENTADO — Logs preservam contexto de tenant sem vazar dados sensíveis.

---

# 5. AUTENTICAÇÃO E AUTORIZAÇÃO

## Autenticação

> Decisões do usuário (2026-09-11): login por **CPF ou e-mail + senha**, **link mágico** e **Google**; CPF opcional; **MFA por app autenticador obrigatório para OWNER/ADMIN**; serviço de e-mail a definir. Detalhes técnicos em `docs/architecture/fundacao-tecnica.md`.

- ✅ CONCLUÍDO — Cadastro/login
  - Evidência: `POST /api/auth/signup` (cria pessoa, empresa, 5 perfis padrão e vínculo OWNER, inicia sessão) e `POST /api/auth/login` (e-mail ou CPF com/sem máscara); casos de uso em `src/application/auth/`.
  - Testes: `tests/unit/application/auth/login-and-register.test.ts`, `tests/integration/auth/auth-services.test.ts`, `tests/e2e/auth.spec.ts` — passaram (local, 2026-09-11).
- ✅ CONCLUÍDO — Hash seguro de senha: Argon2id (19 MiB, t=2, p=1), mínimo 12 e máximo 128 caracteres, sem regras de composição. Teste: prefixo `$argon2id$v=19$m=19456,t=2,p=1$` verificado em `tests/unit/infrastructure/security/crypto-and-password.test.ts` — passou.
- 🔴 NÃO IMPLEMENTADO — Recuperação de senha (depende do serviço de e-mail).
- 🔴 NÃO IMPLEMENTADO — Tokens de recuperação de uso único.
- 🔴 NÃO IMPLEMENTADO — Expiração de tokens de recuperação/link mágico.
- ✅ CONCLUÍDO — Rate limit: login 30/15 min por IP e 10/15 min por conta (HMAC do identificador); cadastro 10/h por IP; PostgreSQL com UPSERT atômico. Testes: bloqueio após 10 tentativas e contagem concorrente sem perdas (integração) — passaram.
- 🟡 PARCIAL — Proteção contra brute force: limite por conta e por IP, resposta idêntica para qualquer falha e tempo de verificação equalizado para conta inexistente (unit + integração — passaram). Pendente: alerta/monitoramento de ataques e bloqueio progressivo.
- 🔴 NÃO IMPLEMENTADO — MFA/2FA (decidido: TOTP + códigos de recuperação, obrigatório para OWNER/ADMIN; `sessions.mfa_verified_at` já existe).
- 🔴 NÃO IMPLEMENTADO — Verificação de e-mail (coluna `users.email_verified_at` já existe; depende do serviço de e-mail).
- ✅ CONCLUÍDO — Logout: `POST /api/auth/logout` revoga a sessão e apaga o cookie (integração + E2E — passaram).
- ✅ CONCLUÍDO — Logout de todas as sessões: `POST /api/auth/logout-all` (integração — passou).
- 🔴 NÃO IMPLEMENTADO — Sessões/dispositivos ativos (IP e user-agent já são gravados em `sessions`; listagem pendente).

## Sessão

- ✅ CONCLUÍDO — Cookies HttpOnly: verificado no `Set-Cookie` (E2E `cadastro inicia sessão com cookie HttpOnly e SameSite=Lax` — passou).
- ✅ CONCLUÍDO — Secure: em HTTPS o cookie usa `Secure` e prefixo `__Host-veldocs_session` (`sessionCookieSettings`, teste unitário — passou). Confirmar em produção após o deploy.
- ✅ CONCLUÍDO — SameSite adequado: `Lax` + verificação de `Origin` nas rotas que alteram estado (unit + E2E — passaram).
- ✅ CONCLUÍDO — Expiração: 7 dias sem uso (renovada com o uso) e no máximo 30 dias desde o login; CHECK `sessions_expiry_order_chk` (unit `session-manager.test.ts` — passou).
- ✅ CONCLUÍDO — Rotação/revogação: nova sessão a cada login; revogação individual e geral (unit + integração — passaram).
- ✅ CONCLUÍDO — Proteção contra session fixation: o token é sempre gerado pelo servidor no login (256 bits) e só o SHA-256 é gravado (`sessions_id_format_chk`); token malformado é descartado sem consulta ao banco (unit + integração — passaram).

## RBAC

Perfis iniciais sugeridos:

- OWNER
- ADMIN
- GESTOR
- COLABORADOR
- VISUALIZADOR

Permissões devem poder ser refinadas por módulo/recurso.

Exemplos:

```text
documents.read
documents.create
documents.update
documents.delete
employees.read
suppliers.read
reports.read
```

## Regra

A autorização deve ser decidida pelo backend. O frontend nunca é autoridade de segurança.

> **Estado após FASE 1 (2026-09-10):** existem as tabelas `roles` (por tenant, `key` única por empresa, `is_system`), `permissions` (catálogo global; formato `recurso.acao` validado por Zod em `src/domain/access-control/permission-key.ts` e por CHECK no banco), `role_permissions` e `user_roles` (FKs compostas impedem atribuir perfil de outro tenant). Autenticação, sessão e verificação de permissões: 🔴 NÃO IMPLEMENTADO (FASE 2). Perfis padrão ainda não são provisionados.

---

# 6. SEGURANÇA

## Referências

- OWASP ASVS 5.0.
- OWASP API Security Top 10.

## Aplicação

- [ ] HTTPS
- [ ] HSTS
- [ ] CSP
- [ ] X-Content-Type-Options
- [ ] Referrer-Policy
- [ ] Permissions-Policy
- [ ] Proteção contra XSS
- [ ] Proteção contra CSRF quando aplicável
- [ ] Rate limiting
- [ ] Validação de entrada
- [ ] Sanitização quando necessário
- [ ] Proteção contra SQL injection
- [ ] Proteção contra SSRF
- [ ] Proteção contra path traversal
- [ ] Limite de request
- [ ] Timeouts
- [ ] Idempotência onde necessário

### Preparação realizada na FASE 1 (2026-09-10)

- 🟡 PARCIAL — Validação de entrada: variáveis de ambiente e rotas de autenticação validadas com Zod (CPF com dígitos verificadores, e-mail normalizado, política de senha); corpo JSON limitado a 16 KB com `Content-Type` obrigatório (unit + E2E — passaram). Aplicar a cada nova rota.
- 🟡 PARCIAL — Proteção contra CSRF: rotas de autenticação exigem `Origin` igual a `APP_URL` (ou `Sec-Fetch-Site: same-origin`) + cookie `SameSite=Lax` (unit + E2E — passaram). Aplicar a cada nova rota que altere estado.
- ✅ CONCLUÍDO — Dados pessoais sensíveis: CPF armazenado só como HMAC-SHA256 + AES-256-GCM com contexto autenticado; chaves `APP_ENCRYPTION_KEY`/`APP_HMAC_KEY` validadas no ambiente e configuradas no Railway sem exibição (integração: nenhuma coluna contém o CPF em claro — passou). Pendente: procedimento de rotação de chaves.
- 🟡 PARCIAL — Proteção contra SQL injection: acesso a dados via Prisma (consultas parametrizadas); SQL bruto da aplicação só via tagged template (`$queryRaw`).
- 🟡 PARCIAL — Headers: `X-Powered-By` removido (`poweredByHeader: false`; E2E "não expõe o header X-Powered-By" — passou). HSTS, CSP e demais headers: FASE 2.
- 🟡 PARCIAL — Timeouts: health check com timeout por componente e sem vazamento de mensagens internas (testes unitários — passou). Timeouts de request: FASE 2.
- ✅ CONCLUÍDO — Secrets fora do código: `.env*` ignorados pelo Git (verificado com `git check-ignore`), `.env.example` sem secrets reais, erros de configuração não expõem valores, staging/produção exigem https e rejeitam credenciais locais (testes unitários — passou).
- ✅ CONCLUÍDO — Código de servidor não importável pelo cliente: `import "server-only"` em `env.ts` e `prisma-client.ts` (`pnpm build` — sucesso).
- ✅ CONCLUÍDO — Banco local exposto apenas em loopback (`127.0.0.1:5440`, `docker-compose.yml`).
- ✅ CONCLUÍDO — Banco de produção sem acesso público: o PostgreSQL do Railway não tem TCP proxy nem `DATABASE_PUBLIC_URL`; a aplicação conecta pela rede privada (`postgres.railway.internal`). Evidência: lista de variáveis dos serviços (somente nomes) e log do pre-deploy.
- ✅ CONCLUÍDO — HTTPS em produção: domínio Railway com TLS; `http://` responde 301 para `https://` (verificado com curl em 2026-09-10). HSTS explícito: FASE 2.
- 🟡 PARCIAL — Rate limiting e auditoria: implementados para cadastro, login e logout (`PrismaRateLimiter`, `PrismaAuditLogger`). Storage privado, IA, WhatsApp e notificações: somente contratos em `src/application/ports/`.

## Segurança de API

Testar especialmente:

- Broken Object Level Authorization / IDOR.
- Broken Authentication.
- Broken Object Property Level Authorization.
- Unrestricted Resource Consumption.
- Broken Function Level Authorization.
- SSRF.
- APIs antigas/esquecidas.
- Configurações inseguras.
- Integrações externas inseguras.

---

# 7. UPLOAD E DOCUMENTOS

## Fluxo esperado

```text
Upload
 ↓
Validação
 ↓
Antivírus
 ↓
Storage privado
 ↓
Registro no banco
 ↓
Processamento assíncrono
 ↓
OCR/extração, quando aplicável
```

## Controles

- [ ] Allowlist de extensões
- [ ] Validação MIME
- [ ] Validação de magic bytes
- [ ] Limite de tamanho
- [ ] Limite de quantidade
- [ ] Nomes internos seguros
- [ ] Proteção contra path traversal
- [ ] Antivírus/antimalware
- [ ] CDR para formatos aplicáveis
- [ ] Storage privado
- [ ] URLs temporárias
- [ ] Autorização antes do download
- [ ] Auditoria de download

## Formatos iniciais sugeridos

- PDF
- DOCX
- XLSX
- PNG
- JPG

A allowlist real deve ser definida pelo produto e implementada no backend.

---

# 8. STORAGE

## Regras

- [ ] Bucket privado
- [ ] Sem listagem pública
- [ ] Chaves de objeto não previsíveis
- [ ] Não usar nome do arquivo do usuário como chave pública
- [ ] Signed URLs temporárias
- [ ] Expiração configurável
- [ ] Controle de autorização no backend
- [ ] Logs de acesso
- [ ] Backup
- [ ] Política de retenção

## Download

```text
Usuário autenticado
 → Backend
 → valida tenant
 → valida RBAC/permissão
 → valida recurso
 → gera signed URL temporária
 → download
```

---

# 9. BANCO DE DADOS

## Entidades base

> **Evidência comum (FASE 1, 2026-09-10):** `prisma/schema.prisma`; migração `prisma/migrations/20260910225812_init_base_entities/migration.sql`; `docs/database/modelo-base.md`. **Testes:** `pnpm test:integration` — 3 arquivos, 36 testes, passou. **Obs.:** ✅ refere-se à entidade base (tabela, constraints e migração); regras de negócio, APIs e telas pertencem às fases seguintes.

- ✅ CONCLUÍDO — User (`users`: pessoa global desde a FASE 2 — e-mail único em minúsculas, CPF opcional só como HMAC + cifrado, senha Argon2id, status ACTIVE/DISABLED) e Membership (`memberships`: vínculo pessoa ↔ empresa, status INVITED/ACTIVE/SUSPENDED) — migração `identity_memberships_sessions`
- ✅ CONCLUÍDO — Company (`companies`: tenant raiz; `slug` único; status ACTIVE/SUSPENDED)
- ✅ CONCLUÍDO — Branch (`branches`: `code` único por empresa)
- ✅ CONCLUÍDO — Department (`departments`: filial opcional, do mesmo tenant)
- ✅ CONCLUÍDO — Role (`roles`: por tenant, `key` única por empresa) + junção `user_roles`
- ✅ CONCLUÍDO — Permission (`permissions`: catálogo global, formato `recurso.acao`) + junção `role_permissions`
- ✅ CONCLUÍDO — Document (`documents`: metadados, emissão/validade, categoria/filial/setor/responsável/criador do mesmo tenant, soft delete)
- ✅ CONCLUÍDO — DocumentCategory (`document_categories`: subcategorias no mesmo tenant)
- 🔴 NÃO IMPLEMENTADO — DocumentVersion (FASE 13)
- 🔴 NÃO IMPLEMENTADO — DocumentTag (FASE 5)
- 🔴 NÃO IMPLEMENTADO — Employee (FASE 16)
- 🔴 NÃO IMPLEMENTADO — Supplier (FASE 17)
- 🔴 NÃO IMPLEMENTADO — Contract (FASE 21)
- 🔴 NÃO IMPLEMENTADO — Request (FASE 18)
- 🔴 NÃO IMPLEMENTADO — Approval (FASE 20)
- 🔴 NÃO IMPLEMENTADO — Notification (FASE 10)
- ✅ CONCLUÍDO — AuditLog (`audit_logs`: append-only por trigger; tenant opcional só para eventos sem tenant resolvido)

## Requisitos de modelagem

- ✅ CONCLUÍDO — IDs seguros/adequados ao domínio: UUID v7 (tipo `uuid`), não sequenciais.
- ✅ CONCLUÍDO — Foreign keys: 20 FKs, das quais 10 compostas por tenant. Teste: `tenant-isolation-constraints.test.ts` (14 testes) — passou.
- ✅ CONCLUÍDO — Unique constraints adequadas: `companies.slug`, `users.email`, `permissions.key`, `roles(company_id, key)`, `branches(company_id, code)` e `(company_id, id)` nas entidades de tenant. Teste: `data-integrity-constraints.test.ts` — passou.
- 🟡 PARCIAL — Índices para consultas críticas: índices por `company_id` combinados com FKs e `documents(company_id, expiration_date)`. Revisar com as consultas reais das fases 5, 8 e 9.
- ✅ CONCLUÍDO — Integridade referencial: `ON DELETE RESTRICT` por padrão (`CASCADE` só em junções). Teste "impede excluir empresa que possui dados vinculados" — passou.
- ✅ CONCLUÍDO — Campos de auditoria: `created_at` em todas as tabelas, `updated_at` nas entidades mutáveis, `deleted_at` para soft delete; `audit_logs` append-only (testes de UPDATE/DELETE bloqueados — passou).
- ✅ CONCLUÍDO — tenant_id onde aplicável: `company_id NOT NULL` em todas as entidades de tenant (teste — passou).
- ✅ CONCLUÍDO — Migrações reproduzíveis: a mesma migração foi aplicada com `prisma migrate dev` (`veldocs_dev`) e com `prisma migrate deploy` a partir de banco vazio (`veldocs_test`).

---

# 10. MÓDULO DE DOCUMENTOS

- [ ] Criar documento
- [ ] Editar metadados
- [ ] Excluir
- [ ] Restaurar
- [ ] Visualizar
- [ ] Download
- [ ] Upload
- [ ] Categoria
- [ ] Subcategoria
- [ ] Tags
- [ ] Responsável
- [ ] Filial
- [ ] Departamento
- [ ] Data de emissão
- [ ] Data de validade
- [ ] Data de renovação
- [ ] Observações
- [ ] Busca
- [ ] Filtros
- [ ] Favoritos
- [ ] Histórico
- [ ] Versionamento

---

# 11. FUNCIONÁRIOS

- [ ] Cadastro
- [ ] Documentos por funcionário
- [ ] Pendências
- [ ] Vencimentos
- [ ] Responsável
- [ ] Histórico
- [ ] Permissões adequadas

Exemplo:

```text
Funcionário
 ├── Dados
 ├── Documentos
 ├── Vencimentos
 └── Pendências
```

---

# 12. FORNECEDORES

- [ ] Cadastro
- [ ] Documentos
- [ ] Contratos
- [ ] Situação documental
- [ ] Pendências
- [ ] Vencimentos
- [ ] Solicitações
- [ ] Histórico

Status sugeridos:

- REGULAR
- PENDENTE
- IRREGULAR

---

# 13. CONTRATOS

- [ ] Contratante
- [ ] Contratado
- [ ] Valor
- [ ] Início
- [ ] Fim
- [ ] Renovação
- [ ] Reajuste
- [ ] Responsável
- [ ] Documento
- [ ] Histórico

---

# 14. VENCIMENTOS

Estados possíveis:

```text
Válido
Vencendo
Urgente
Vencido
```

Alertas configuráveis:

- [ ] 30 dias
- [ ] 15 dias
- [ ] 7 dias
- [ ] 3 dias
- [ ] 1 dia
- [ ] No dia

Também:

- [ ] Renovação recorrente
- [ ] Responsável pela renovação
- [ ] Justificativa de atraso
- [ ] Histórico

---

# 15. NOTIFICAÇÕES

Canais previstos:

- [ ] In-app
- [ ] E-mail
- [ ] WhatsApp
- [ ] Push, futuramente
- [ ] SMS, futuramente

Eventos:

- [ ] Documento próximo do vencimento
- [ ] Documento vencido
- [ ] Documento recebido
- [ ] Documento rejeitado
- [ ] Documento aprovado
- [ ] Solicitação criada
- [ ] Solicitação atrasada
- [ ] Renovação pendente

---

# 16. SOLICITAÇÕES DE DOCUMENTOS

Fluxo:

```text
Solicitar
 ↓
Pessoa/fornecedor recebe
 ↓
Envia
 ↓
Sistema recebe
 ↓
Valida
 ↓
Aprova/Rejeita
```

- [ ] Criar solicitação
- [ ] Definir documento esperado
- [ ] Definir destinatário
- [ ] Prazo
- [ ] Status
- [ ] Lembretes
- [ ] Upload
- [ ] Correção
- [ ] Aprovação
- [ ] Histórico

---

# 17. PORTAL EXTERNO

Para fornecedores, clientes ou pessoas externas.

- [ ] Link seguro
- [ ] Token aleatório
- [ ] Expiração
- [ ] Escopo limitado
- [ ] Upload
- [ ] Status da solicitação
- [ ] Antivírus
- [ ] Auditoria
- [ ] Revogação do link

---

# 18. APROVAÇÕES

Fluxo base:

```text
Enviado
 ↓
Em análise
 ↓
Correção
 ↓
Aprovado
```

- [ ] Aprovar
- [ ] Reprovar
- [ ] Solicitar correção
- [ ] Comentário
- [ ] Responsável
- [ ] Prazo
- [ ] Histórico

---

# 19. DASHBOARD

## KPIs

- [ ] Total de documentos
- [ ] Válidos
- [ ] Vencendo
- [ ] Vencidos
- [ ] Pendentes
- [ ] Solicitações abertas
- [ ] Score documental, futuramente
- [ ] Riscos, futuramente

## Áreas

- [ ] Próximos vencimentos
- [ ] Pendências
- [ ] Atividade recente
- [ ] Alertas
- [ ] Ações recomendadas
- [ ] Assistente IA

---

# 20. ASSISTENTE NO DASHBOARD

O assistente deve ser operacional, não somente conversacional.

Consultas esperadas:

- “Quais documentos vencem esta semana?”
- “O fornecedor ABC está regular?”
- “Quem é responsável pelo alvará?”
- “Quais documentos estão pendentes?”
- “Por que este documento está crítico?”

Ações futuras:

- Criar solicitação.
- Atualizar responsável.
- Iniciar renovação.
- Organizar pendências.
- Gerar relatório.

## Regra de segurança

A IA nunca recebe acesso irrestrito ao banco.

Toda consulta/ação deve passar por tools/serviços autorizados e validar:

```text
Usuário
 → Tenant
 → Permissão
 → Recurso
 → Ação
```

---

# 21. IA E DOCUMENTOS

## Pipeline

```text
Documento
 ↓
OCR
 ↓
Extração
 ↓
Classificação
 ↓
Sugestão
 ↓
Confirmação
```

Possíveis campos:

- Tipo
- CNPJ
- Nome
- Emissão
- Validade
- Empresa
- Pessoa
- Categoria

## Segurança

- [ ] Prompt injection protection
- [ ] Conteúdo do documento tratado como dado não confiável
- [ ] Sem acesso irrestrito ao banco
- [ ] Limite de custo
- [ ] Rate limit
- [ ] Logs de uso
- [ ] Controle por tenant
- [ ] Controle por permissão

---

# 22. WHATSAPP

## Conceito

WhatsApp é uma segunda interface do SaaS: consulta rápida, notificações e ações.

## Identidade

```text
Número WhatsApp
 ↓
Usuário
 ↓
Empresa
 ↓
Permissões
```

## Consultas

- [ ] Situação do documento
- [ ] Documentos vencidos
- [ ] Próximos vencimentos
- [ ] Situação do fornecedor
- [ ] Pendências
- [ ] Responsáveis

## Ações

- [ ] Enviar documento
- [ ] Criar solicitação
- [ ] Atualizar informação
- [ ] Aprovar/reprovar, quando permitido
- [ ] Iniciar processo de renovação

## Segurança

- [ ] Validação do webhook
- [ ] Identificação confiável do número
- [ ] Tenant
- [ ] RBAC
- [ ] Rate limiting
- [ ] Auditoria
- [ ] Proteção contra replay quando aplicável

---

# 23. AUTOMAÇÕES

Motor de regras:

```text
SE condição
ENTÃO ação
```

Exemplos:

```text
SE documento vencer em 30 dias
→ notificar responsável

SE documento for rejeitado
→ solicitar correção

SE fornecedor ficar irregular
→ alertar gestor

SE documento for recebido
→ processar OCR
```

- [ ] Condições
- [ ] Ações
- [ ] Agendamento
- [ ] Histórico
- [ ] Logs
- [ ] Idempotência
- [ ] Limites

---

# 24. CALENDÁRIO DOCUMENTAL

- [ ] Visualização mensal
- [ ] Vencimentos
- [ ] Renovações
- [ ] Pendências
- [ ] Filtros por setor/filial/responsável

---

# 25. RELATÓRIOS

- [ ] Vencidos
- [ ] Vencendo
- [ ] Pendentes
- [ ] Por setor
- [ ] Por filial
- [ ] Por responsável
- [ ] Por fornecedor
- [ ] Por período
- [ ] Histórico
- [ ] Exportação PDF
- [ ] Exportação Excel
- [ ] Exportação CSV

---

# 26. AUDITORIA E LINHA DO TEMPO

Registrar eventos importantes:

- ✅ CONCLUÍDO — Login (`auth.login_succeeded`; também `auth.account_registered`, `company.created`, `auth.logout`, `auth.logout_all`) — integração — passou
- ✅ CONCLUÍDO — Falha de login (`auth.login_failed` e `auth.login_rate_limited`, sem e-mail, CPF ou senha nos metadados) — integração — passou
- [ ] Upload
- [ ] Download
- [ ] Criação
- [ ] Alteração
- [ ] Exclusão
- [ ] Restauração
- [ ] Aprovação
- [ ] Rejeição
- [ ] Alteração de responsável
- [ ] Alteração de permissão
- [ ] Ações via WhatsApp
- [ ] Ações da IA

Exemplo:

```text
10/09/2026 14:31
Maria
Aprovou
Contrato XYZ
```

---

# 27. VERSIONAMENTO

```text
Contrato.pdf
 ├── v1
 ├── v2
 └── v3
```

- [ ] Histórico de versões
- [ ] Usuário
- [ ] Data
- [ ] Download de versão
- [ ] Restauração
- [ ] Auditoria

---

# 28. INOVAÇÕES DO PRODUTO

## 28.1 Caixa de entrada inteligente

Central para documentos recebidos de qualquer canal.

## 28.2 Documentos sem dono

Detectar documentos sem responsável e sugerir atribuição.

## 28.3 Detecção de duplicidade

Identificar arquivos potencialmente duplicados ou versões repetidas.

## 28.4 Validação de coerência

Comparar dados do documento com os dados cadastrados.

## 28.5 Renovação inteligente

Acompanhar o processo da renovação, não somente a data final.

## 28.6 Score documental

Exemplo:

```text
Saúde documental: 94/100
```

Com explicação do cálculo.

## 28.7 Radar de risco

Priorizar riscos operacionais e documentos críticos.

## 28.8 Resumos automáticos

Resumo diário/semanal do estado documental.

## 28.9 Zero digitação

Usar OCR/IA para preencher metadados automaticamente e solicitar apenas confirmação.

## 28.10 Busca em linguagem natural

Exemplo:

> “Contratos da filial X que vencem em outubro.”

## 28.11 Modo emergência

Visão rápida da saúde documental da empresa.

## 28.12 Modo auditoria

Checklist e preparação para auditorias.

## 28.13 Explicação de risco

Para cada alerta importante, explicar por que aquilo é relevante.

---

# 29. UX/UI

Princípios:

- [ ] Simples
- [ ] Limpo
- [ ] Sofisticado
- [ ] Hierarquia visual forte
- [ ] Pouca poluição
- [ ] Poucos ícones sem necessidade
- [ ] Responsivo
- [ ] Acessível
- [ ] Loading states
- [ ] Empty states
- [ ] Error states
- [ ] Feedback visual
- [ ] Dashboard adaptado por perfil

Objetivo:

> O usuário deve entender a situação documental da empresa rapidamente, sem precisar navegar por dezenas de telas.

---

# 30. TESTES

> **Infraestrutura de testes (FASE 1):** Vitest 5 com projetos `unit` e `integration` (`vitest.config.mts`), Playwright 1.63 (`playwright.config.ts`). Testes de integração usam PostgreSQL real em banco dedicado cujo nome precisa terminar em `_test` (proteção contra limpar outro banco).

## Unitários

- 🟡 PARCIAL — Serviços: caso de uso de health check (`tests/unit/application/system/check-health.test.ts`, 4 testes) e comparação de migrações (`tests/unit/infrastructure/database/compare-migrations.test.ts`, 6 testes) — passou localmente e no CI. Serviços de negócio ainda não existem.
- [ ] Regras de vencimento
- [ ] Permissões
- ✅ CONCLUÍDO — Validadores existentes: ambiente (`tests/unit/infrastructure/config/env.test.ts`, 15 testes) e chave de permissão (`tests/unit/domain/access-control/permission-key.test.ts`, 17 testes) — passou.
- [ ] Automações
- ✅ CONCLUÍDO — Fronteiras de arquitetura: `tests/unit/architecture/layer-boundaries.test.ts` (4 testes) — passou.

## Integração

- ✅ CONCLUÍDO — Banco: conexão, migrações, tabelas, `company_id`, FKs cross-tenant, unicidade, CHECKs, trigger append-only e health probes de banco e de migrações (`tests/integration/database/`, 39 testes — passou localmente e no CI).
- [ ] Storage
- ✅ CONCLUÍDO — Auth: `tests/integration/auth/auth-services.test.ts` (13 testes: cadastro atômico, CPF protegido, duplicidade genérica, login por e-mail/CPF, falhas idênticas, bloqueio por tentativas, sessão, logout geral, rate limiter concorrente) — passou.
- [ ] API
- [ ] Workers

## E2E

- 🟡 PARCIAL — Fundação: página inicial, `/api/health` (aplicação + banco + migrações) e ausência de `X-Powered-By` (`tests/e2e/foundation.spec.ts`, 3 testes — passou com `pnpm dev`, com `pnpm start` e no CI).
- ✅ CONCLUÍDO — Cadastro (`tests/e2e/auth.spec.ts` — passou)
- ✅ CONCLUÍDO — Login (por CPF, logout e credenciais inválidas genéricas — `tests/e2e/auth.spec.ts` — passou)
- [ ] Documento
- [ ] Upload
- [ ] Download
- [ ] Vencimento
- [ ] Solicitação
- [ ] Aprovação

## Segurança

- 🟡 PARCIAL — Cross-tenant (nível banco: 14 testes de integração — passou; nível API na FASE 2)
- [ ] IDOR/BOLA
- [ ] Upload malicioso
- [ ] MIME falsificado
- [ ] Path traversal
- ✅ CONCLUÍDO — Brute force (bloqueio da conta após 10 tentativas, mesmo com a senha correta — integração — passou)
- ✅ CONCLUÍDO — Rate limit (login e cadastro; contagem concorrente — unit + integração — passaram)
- 🟡 PARCIAL — Session attacks (token só em hash, fixation, expiração, revogação e token malformado — unit + integração; falta teste de reuso de cookie após logout em navegador real e de roubo de sessão entre dispositivos)
- 🟡 PARCIAL — CSRF quando aplicável (Origin estrangeira e ausente recusadas nas rotas de autenticação — unit + E2E — passaram; demais rotas conforme forem criadas)
- [ ] XSS
- [ ] SSRF

## WhatsApp

- [ ] Webhook
- [ ] Identidade
- [ ] Tenant
- [ ] Permissões
- [ ] Rate limit

## IA

- [ ] Permission boundary
- [ ] Prompt injection
- [ ] Tool authorization
- [ ] Tenant isolation

---

# 31. CI/CD E SUPPLY CHAIN

> Pipeline de CI no GitHub Actions (`.github/workflows/ci.yml`) em todo pull request e em todo push na `main`. O Railway só publica commits da `main` depois que os checks do GitHub passam (gatilho de deploy com `checkSuites: true`). Primeira execução verde: run `34544523969` (PR #1, 2026-09-10).

- ✅ CONCLUÍDO — Lint (etapa `pnpm lint` do CI — passou no run `34544523969`)
- ✅ CONCLUÍDO — Type checking (etapa `pnpm typecheck` do CI — passou)
- ✅ CONCLUÍDO — Testes unitários (etapa `pnpm test` do CI — 46 passaram)
- ✅ CONCLUÍDO — Testes de integração (etapa `pnpm test:integration` do CI, PostgreSQL 17 como service container — 39 passaram)
- ✅ CONCLUÍDO — E2E (etapa `pnpm test:e2e` do CI contra `pnpm start` — 3 passaram)
- ✅ CONCLUÍDO — Entrega bloqueada sem CI verde (Railway `checkSuites: true`, confirmado via API; ver registro de 2026-09-10 — CI e endurecimento do deploy)
- 🔴 NÃO IMPLEMENTADO — SAST
- 🔴 NÃO IMPLEMENTADO — SCA/dependency scanning
- 🔴 NÃO IMPLEMENTADO — Secret scanning
- 🔴 NÃO IMPLEMENTADO — SBOM
- ✅ CONCLUÍDO — Lockfile (`pnpm-lock.yaml`; `pnpm install --frozen-lockfile` — sucesso)
- 🔴 NÃO IMPLEMENTADO — Imagens de container escaneadas, quando aplicável (não há imagem própria)
- ⏳ BLOQUEADO — Branch protection: indisponível para repositório privado no plano gratuito do GitHub (API: "Upgrade to GitHub Pro or make this repository public"). Mitigação atual: mudanças por pull request e Railway publicando só com CI verde.
- 🔴 NÃO IMPLEMENTADO — Revisão de código
- 🟡 PARCIAL — Ambientes separados (development local e production no Railway; staging não provisionado)

---

# 32. BACKUP E RECOVERY

- ⏳ BLOQUEADO — Backup automático: o agendamento de backups do volume do PostgreSQL de produção foi recusado pela API do Railway ("Not Authorized") no plano Hobby; PITR desativado. Requer decisão: plano Pro no Railway ou rotina de dump para storage externo.
- [ ] Backup criptografado
- [ ] Retenção definida
- [ ] Estratégia de restore
- [ ] Teste periódico de restore
- [ ] RPO definido
- [ ] RTO definido
- [ ] Plano de desastre

---

# 33. OBSERVABILIDADE

- [ ] Logs estruturados
- [ ] Métricas
- [ ] Tracing
- [ ] Error tracking
- [ ] Alertas
- [ ] Monitoramento de performance
- [ ] Monitoramento de workers
- [ ] Monitoramento de storage
- [ ] Monitoramento de IA
- [ ] Monitoramento de WhatsApp

---

# 34. LGPD E GOVERNANÇA

- [ ] Política de privacidade
- [ ] Finalidades definidas
- [ ] Minimização de dados
- [ ] Controle de acesso
- [ ] Retenção
- [ ] Exclusão
- [ ] Exportação quando aplicável
- [ ] Gestão de incidentes
- [ ] Contratos/DPA quando aplicável
- [ ] Classificação de dados

---

# 35. ADMINISTRAÇÃO DO SAAS

Painel interno:

- [ ] Clientes
- [ ] Empresas
- [ ] Assinaturas
- [ ] Planos
- [ ] Receita
- [ ] Uso de storage
- [ ] Uso de IA
- [ ] Uso de WhatsApp
- [ ] Logs
- [ ] Suporte
- [ ] Bloqueios
- [ ] Métricas

Acesso administrativo deve ter segurança reforçada e auditoria completa.

---

# 36. BILLING

- [ ] Planos
- [ ] Checkout
- [ ] Assinatura mensal/anual
- [ ] Cobrança recorrente
- [ ] Cartão
- [ ] PIX, conforme provedor
- [ ] Upgrade
- [ ] Downgrade
- [ ] Cancelamento
- [ ] Período de graça
- [ ] Inadimplência
- [ ] Webhooks

Limites possíveis por plano:

- Usuários
- Documentos
- Storage
- Filiais
- Automações
- IA
- WhatsApp

---

# 37. ESCALA

Estratégia:

### Inicial

Monólito modular.

### Primeira escala

Escalar workers, filas e storage separadamente.

### Escala posterior

Extrair componentes específicos apenas quando houver necessidade comprovada.

Possíveis serviços futuros:

```text
API
Worker
OCR
IA
WhatsApp
Notificações
```

---

# 38. INTEGRAÇÕES FUTURAS

- [ ] Google Drive
- [ ] OneDrive
- [ ] Dropbox
- [ ] Microsoft 365
- [ ] ERP
- [ ] RH
- [ ] Contabilidade
- [ ] Assinatura eletrônica
- [ ] APIs externas

---

# 39. SEGURANÇA POR CENÁRIO

| Cenário | Resultado esperado |
|---|---|
| Usuário da empresa A acessa documento da empresa B | ❌ Negado |
| Usuário sem permissão tenta baixar documento | ❌ Negado |
| URL de arquivo expirada é reutilizada | ❌ Negado |
| Upload de executável | ❌ Negado |
| MIME falsificado | ❌ Negado |
| Path traversal | ❌ Negado |
| IA consulta documento sem permissão | ❌ Negado |
| WhatsApp não vinculado consulta dados | ❌ Negado |
| Usuário comum acessa função administrativa | ❌ Negado |
| Tentativa de brute force | 🚨 Limitada/bloqueada |

---

# 40. ROADMAP DE IMPLEMENTAÇÃO

## FASE 0 — Produto

**Status da fase:** ✅ CONCLUÍDO — validado em 2026-09-10. Documento: `docs/product/visao-do-produto.md`.

- ✅ CONCLUÍDO — Nome: **VELDOCS**.
  - Evidência: `docs/product/visao-do-produto.md`; `src/presentation/product-identity.ts`; `src/app/layout.tsx` (title) e `src/app/page.tsx` (h1).
  - Teste: E2E "página inicial apresenta a identidade do VELDOCS" — passou (dev e produção).
- ✅ CONCLUÍDO — Identidade (verbal): "Gestão inteligente de documentos empresariais." + conceito **"Zero surpresa documental."** (perceber → alertar → explicar → recomendar → executar quando autorizado).
  - Evidência: mesmos arquivos acima; exibidos na página inicial.
  - Teste: mesmo E2E — passou.
  - Obs.: identidade visual (logo, paleta, tipografia) pertence à FASE 3 (design system).
- ✅ CONCLUÍDO — Público: pequenas e médias empresas que controlam documentos próprios, de funcionários, fornecedores e contratos.
  - Evidência: `docs/product/visao-do-produto.md`. Testes: não aplicável (definição de produto).
- ✅ CONCLUÍDO — Problema: documentação dispersa entre pastas, drives, e-mail, WhatsApp, planilhas e lembretes manuais.
  - Evidência: `docs/product/visao-do-produto.md`. Testes: não aplicável.
- ✅ CONCLUÍDO — Proposta de valor: "Organizar documentos, acompanhar prazos, identificar riscos e ajudar a empresa a resolver pendências antes que elas se tornem problemas."
  - Evidência: `docs/product/visao-do-produto.md`; exibida na página inicial. Testes: não aplicável (conteúdo).
- ✅ CONCLUÍDO — Escopo MVP: tabela "incluído × fora do MVP" alinhada à seção 2.
  - Evidência: `docs/product/visao-do-produto.md`. Testes: não aplicável.

## FASE 1 — Fundação técnica

**Status da fase:** ✅ CONCLUÍDO — validado em 2026-09-10. Documento: `docs/architecture/fundacao-tecnica.md`.

- ✅ CONCLUÍDO — Repositório
  - Evidência: Git inicializado (branch `main`; **sem commits e sem remoto**, por instrução); `.gitignore` (ignora `.env*` exceto `.env.example`, `node_modules/`, `.next/`, `src/generated/`, relatórios de teste); `.gitattributes` (LF); `.nvmrc` (24). O arquivo recebido como `MASTER_PROJECT_SPEC (1).md` foi renomeado para `MASTER_PROJECT_SPEC.md`, nome referenciado pelo README.
  - Teste: `git check-ignore -v .env src/generated/prisma/client.ts node_modules .next` — todos ignorados.
- ✅ CONCLUÍDO — Ambientes (development / staging / production)
  - Evidência: `.env.example`; `src/infrastructure/config/env.ts` (Zod: `APP_ENV`, `APP_URL`, `LOG_LEVEL`, `DATABASE_URL`; staging/produção exigem https e rejeitam credenciais locais; mensagens de erro sem valores); tabela de ambientes em `docs/architecture/fundacao-tecnica.md`.
  - Teste: `tests/unit/infrastructure/config/env.test.ts` — 15 testes, passou.
  - Obs.: infraestrutura de staging/produção não foi provisionada (fora do escopo); apenas a configuração foi preparada. Staging/produção não usam arquivos `.env`.
- ✅ CONCLUÍDO — Dependências
  - Evidência: `package.json` (`packageManager: pnpm@10.34.3`, `engines.node >= 24`) e `pnpm-lock.yaml`. Runtime: next 16.3.4, react/react-dom 19.3.0, @prisma/client 7.10.0, @prisma/adapter-pg 7.10.0, zod 4.6.2, server-only 0.0.1. Desenvolvimento: typescript 6.0.3, prisma 7.10.0, eslint 9.39.5, eslint-config-next 16.3.4, vitest 5.0.0, vite 8.3.0, @playwright/test 1.63.0, dotenv 17.4.2, @types/node 24, @types/react 19.
  - Teste: `pnpm install --frozen-lockfile` — sucesso; `prisma generate` sem `DATABASE_URL` — sucesso (install funciona sem banco).
- ✅ CONCLUÍDO — PostgreSQL
  - Evidência: `docker-compose.yml` (postgres:17-alpine, porta `127.0.0.1:5440`, volume nomeado, healthcheck); `docker/postgres/init/01-create-test-database.sql` (banco `veldocs_test`); `prisma.config.ts`; `src/infrastructure/database/prisma-client.ts` (driver adapter `pg`, criação lazy, `server-only`).
  - Testes: `pnpm db:up` — container healthy (PostgreSQL 17.11); `prisma migrate status` — "Database schema is up to date!"; integração "conecta ao PostgreSQL" e "reporta banco disponível" — passou; E2E `GET /api/health` → `{"status":"ok","checks":{"database":"up"}}` — passou.
- ✅ CONCLUÍDO — Estrutura inicial (monólito modular)
  - Evidência: `src/app` + `src/presentation` (apresentação), `src/application` (casos de uso e portas: Storage, IA, WhatsApp, notificações, auditoria, rate limit, health), `src/domain`, `src/infrastructure`, `prisma/` (database), `tests/{unit,integration,e2e}`.
  - Testes: `tests/unit/architecture/layer-boundaries.test.ts` (4 testes: domínio e aplicação sem dependência de infraestrutura, framework ou Prisma) — passou; `pnpm lint`, `pnpm typecheck`, `pnpm build` — sucesso.
- ✅ CONCLUÍDO — Entidades base
  - Evidência: User, Company, Branch, Department, Role, Permission, Document, DocumentCategory, AuditLog (+ junções `user_roles`, `role_permissions`) em `prisma/schema.prisma`; migração `20260910225812_init_base_entities`; `docs/database/modelo-base.md`. Detalhes na seção 9.
  - Teste: `pnpm test:integration` — 3 arquivos, 36 testes, passou (migração aplicada a partir de banco vazio).

### Qualidade (FASE 1)

- ✅ CONCLUÍDO — TypeScript strict (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`) — `pnpm typecheck`: 0 erros.
- ✅ CONCLUÍDO — Lint (`eslint.config.mjs`: `eslint-config-next` core-web-vitals + typescript) — `pnpm lint`: 0 erros, 0 avisos.
- ✅ CONCLUÍDO — Testes (Vitest `unit`/`integration`, Playwright) — ver tabela abaixo.
- ✅ CONCLUÍDO — Scripts: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`, `test:integration`, `test:e2e`, `check`, `db:up`, `db:down`, `db:generate`, `db:migrate`, `db:deploy`, `db:status`, `db:studio`.

### Verificação executada em 2026-09-10

| Verificação | Comando | Resultado |
|---|---|---|
| Instala | `pnpm install --frozen-lockfile` | ✅ sucesso |
| Gera client sem banco | `prisma generate` sem `DATABASE_URL` | ✅ sucesso |
| Lint | `pnpm lint` | ✅ 0 erros, 0 avisos |
| Compila (tipos) | `pnpm typecheck` | ✅ 0 erros |
| Testes unitários | `pnpm test` | ✅ 4 arquivos, 40 testes passaram |
| Build | `pnpm build` | ✅ sucesso (`/` estática, `/api/health` dinâmica) |
| Banco | `pnpm db:up` | ✅ container healthy (PostgreSQL 17.11) |
| Migrações | `prisma migrate dev` + `prisma migrate status` | ✅ aplicada; "Database schema is up to date!" |
| Integração | `pnpm test:integration` | ✅ 3 arquivos, 36 testes passaram |
| Frontend (dev) | `pnpm test:e2e` (webServer `pnpm dev`) | ✅ 3 testes passaram |
| Frontend (produção) | `CI=1 E2E_PORT=3100 pnpm test:e2e` (webServer `pnpm start`) | ✅ 3 testes passaram |

## FASE 2 — Segurança base

**Status da fase:** 🟡 PARCIAL — parte 1 (identidade multiempresa, cadastro, login e sessão) implementada em 2026-09-11. Ver seção 5 e o registro de auditoria.

- 🟡 PARCIAL — Auth (cadastro e login por e-mail/CPF + senha ✅; MFA, link mágico, recuperação de senha e Google pendentes)
- ✅ CONCLUÍDO — Sessão (ver seção 5 — Sessão)
- 🟡 PARCIAL — RBAC (catálogo e perfis padrão provisionados por empresa; verificação de permissão nas rotas pendente)
- 🟡 PARCIAL — Multi-tenancy (vínculos multiempresa e FKs compostas; empresa ativa na sessão; seleção de empresa e filtro nas rotas de negócio pendentes)
- 🟡 PARCIAL — Validação (Zod e limite de corpo nas rotas de autenticação)
- 🟡 PARCIAL — Rate limiting (cadastro e login)
- 🔴 NÃO IMPLEMENTADO — Logs (logs estruturados)
- 🟡 PARCIAL — Headers (`X-Powered-By` removido; CSP com nonce e HSTS pendentes)

## FASE 3 — Frontend base

- [ ] Layout
- [ ] Design system
- [ ] Login
- [ ] Cadastro
- [ ] Dashboard base

## FASE 4 — Empresa e usuários

- [ ] Empresas
- [ ] Filiais
- [ ] Setores
- [ ] Usuários
- [ ] Convites
- [ ] Permissões

## FASE 5 — Núcleo documental

- [ ] Documentos
- [ ] Categorias
- [ ] Tags
- [ ] Responsáveis
- [ ] Metadados

## FASE 6 — Storage seguro

- [ ] Bucket privado
- [ ] Upload
- [ ] Download autorizado
- [ ] Signed URLs

## FASE 7 — Upload seguro

- [ ] Allowlist
- [ ] MIME
- [ ] Magic bytes
- [ ] Limites
- [ ] Antivírus

## FASE 8 — Organização

- [ ] Pesquisa
- [ ] Filtros
- [ ] Ordenação
- [ ] Favoritos

## FASE 9 — Vencimentos

- [ ] Estados
- [ ] Datas
- [ ] Renovação

## FASE 10 — Alertas

- [ ] Worker
- [ ] Agendamento
- [ ] In-app
- [ ] E-mail

## FASE 11 — Dashboard

- [ ] KPIs
- [ ] Próximos vencimentos
- [ ] Pendências
- [ ] Atividade

## FASE 12 — Auditoria

- [ ] Audit log
- [ ] Linha do tempo

## FASE 13 — Versionamento

- [ ] Versões
- [ ] Restauração

## FASE 14 — MVP oficial

- [ ] Testes
- [ ] Auditoria
- [ ] Staging
- [ ] Segurança

## FASE 15 — Beta

- [ ] Primeiros clientes
- [ ] Feedback
- [ ] Métricas

## FASE 16 — Funcionários

## FASE 17 — Fornecedores

## FASE 18 — Solicitações

## FASE 19 — Portal externo

## FASE 20 — Aprovações

## FASE 21 — Contratos

## FASE 22 — Automações

## FASE 23 — Calendário

## FASE 24 — Relatórios

## FASE 25 — Assistente IA

## FASE 26 — OCR/IA documental

## FASE 27 — Detecção inteligente

## FASE 28 — Score documental

## FASE 29 — Radar de risco

## FASE 30 — WhatsApp

## FASE 31 — Ações pelo WhatsApp

## FASE 32 — WhatsApp inteligente

## FASE 33 — Zero digitação

## FASE 34 — Assistente proativo

## FASE 35 — Modo auditoria

## FASE 36 — Segurança avançada

## FASE 37 — LGPD/governança

## FASE 38 — Planos/cobrança

## FASE 39 — Billing

## FASE 40 — Admin do SaaS

## FASE 41 — Observabilidade

## FASE 42 — Escala

## FASE 43 — Integrações

## FASE 44 — Ecossistema/marketplace

## FASE 45 — Produto maduro

---

# 41. ADR / DECISÕES DE ARQUITETURA

Registrar aqui decisões importantes.

## DEC-001 — Monólito modular no início

**Status:** ✅ CONCLUÍDO (adotada e implementada na FASE 1)

**Motivo:** reduzir complexidade inicial e manter fronteiras que permitam evolução posterior.

**Evidência:** aplicação Next.js única com camadas `app`/`presentation`, `application`, `domain`, `infrastructure`; regras de dependência verificadas por `tests/unit/architecture/layer-boundaries.test.ts` (passou em 2026-09-10). Módulos de negócio serão subpastas dentro de cada camada.

## DEC-002 — Storage privado

**Status:** 🟡 PARCIAL

**Motivo:** documentos são ativos sensíveis; acesso deve passar por autorização e URLs temporárias.

**Evidência:** contrato `src/application/ports/storage-provider.ts` (tenant obrigatório, chaves internas, URL assinada com expiração). Implementação: FASE 6.

## DEC-003 — IA sem acesso direto irrestrito ao banco

**Status:** 🟡 PARCIAL

**Motivo:** limitar superfície de acesso e garantir autorização por tool/serviço.

**Evidência:** contrato `src/application/ports/ai-provider.ts` recebe apenas mensagens já autorizadas, com tenant e marcação de conteúdo não confiável; a camada de aplicação não pode importar Prisma/infraestrutura (teste de fronteiras — passou). Implementação: FASE 25+.

## DEC-004 — Dashboard + WhatsApp

**Status:** 🟡 PARCIAL

**Motivo:** oferecer gestão completa pelo painel e consultas/ações rápidas por WhatsApp.

**Evidência:** contrato `src/application/ports/whatsapp-provider.ts` (envio e validação de assinatura de webhook). Dashboard: FASES 3 e 11; WhatsApp: FASE 30+.

## DEC-005 — Pessoa global com vínculos multiempresa

**Status:** ✅ CONCLUÍDO (decidido pelo usuário em 2026-09-11; implementado na FASE 2)

**Decisão:** uma mesma pessoa (mesmo e-mail/CPF) pode acessar várias empresas. `users` é a identidade global; `memberships` guarda status e perfis por empresa. Com mais de um vínculo ativo, a sessão começa sem empresa ativa e a pessoa escolhe a empresa.

**Motivo:** o login por CPF tornaria impossível, para sempre, uma pessoa estar em duas empresas (ex.: contadores e consultores).

**Evidência:** migração `identity_memberships_sessions` com preservação de dados verificada em banco descartável; testes de integração "aceita como responsável em B a pessoa de A que também é membro de B" e "não define empresa ativa quando a pessoa tem vínculo ativo com mais de uma empresa" — passaram.

## DEC-006 — Stack e versões da fundação

**Status:** ✅ CONCLUÍDO

**Decisão:** Next.js 16.3 + React 19.3; Node.js 24; TypeScript 6.0; Prisma 7.10 com `@prisma/adapter-pg`; PostgreSQL 17; Zod 4; Vitest 5; Playwright 1.63; ESLint 9; pnpm 10.

**Motivo das versões:** TypeScript 7 não é suportado pelo `typescript-eslint` (exige < 6.1); ESLint 10 não é suportado pelos plugins do `eslint-config-next` 16.3.4 (react, import, jsx-a11y); o dist-tag `latest` do Prisma CLI aponta para 8.0.0-rc.13, então foi fixada a versão estável 7.10.0; PostgreSQL 17 por maturidade de suporte.

## DEC-007 — Integridade multi-tenant reforçada no banco

**Status:** ✅ CONCLUÍDO

**Decisão:** entidades de tenant expõem `UNIQUE (company_id, id)` e toda relação intra-tenant usa FK composta `(company_id, fk)`.

**Motivo:** defesa em profundidade — mesmo com bug na aplicação, o banco rejeita vínculos entre empresas. Não substitui a autorização server-side (FASE 2). Row-Level Security do PostgreSQL será avaliado na FASE 2.

**Evidência:** `tests/integration/database/tenant-isolation-constraints.test.ts` — 14 testes, passou.

## DEC-008 — `APP_ENV` separado de `NODE_ENV`

**Status:** ✅ CONCLUÍDO

**Motivo:** o Next.js controla `NODE_ENV`; `APP_ENV` permite executar build de produção em staging com regras próprias (https obrigatório, bloqueio de credenciais locais).

**Evidência:** `src/infrastructure/config/env.ts`; `tests/unit/infrastructure/config/env.test.ts` — passou.

## DEC-009 — Auditoria append-only no banco

**Status:** ✅ CONCLUÍDO (retenção × LGPD pendente)

**Motivo:** a trilha de auditoria não pode ser alterada ou apagada pela aplicação.

**Evidência:** trigger `audit_logs_append_only` bloqueia UPDATE/DELETE; testes de integração — passou.

**Pendência:** definir procedimento controlado de retenção/expurgo compatível com LGPD.

## DEC-010 — Hospedagem inicial no Railway

**Status:** 🟡 PARCIAL

**Decisão:** aplicação (`veldocs-app`) e PostgreSQL gerenciado (`Postgres`) no Railway — projeto `veldocs`, ambiente `production`, workspace Velnox.IA — com deploy automático a partir da branch `main` do GitHub.

**Motivo:** publicar rapidamente com banco gerenciado, rede privada entre aplicação e banco e HTTPS automático, mantendo o monólito modular.

**Evidência:** deploy `4f8d54ab` (commit `6dd399d`) — SUCCESS; o pre-deploy aplicou `20260910225812_init_base_entities` no banco de produção; `GET /api/health` → HTTP 200 `{"status":"ok","checks":{"database":"up"}}`. Configuração documentada em `docs/architecture/fundacao-tecnica.md`.

**Pendências:** as configurações de deploy (pre-deploy, start, healthcheck, restart, espera do CI) foram aplicadas pela API do Railway e não estão versionadas — migrar para `.railway/railway.ts` declarando também variáveis e origem do repositório; ambiente de staging; backups do PostgreSQL de produção (⏳ bloqueado no plano Hobby). CI antes do deploy: ✅ concluído em 2026-09-10.

---

# 42. STATUS GERAL DO PROJETO

```text
Produto:        ✅ CONCLUÍDO         (FASE 0 — definição; identidade visual na FASE 3)
Arquitetura:    ✅ CONCLUÍDO         (fundação: monólito modular em camadas)
Frontend:       🟡 PARCIAL           (Next.js configurado; página de fundação; layout/design system na FASE 3)
Backend:        🟡 PARCIAL           (autenticação: cadastro, login, sessão e logout; health check; sem módulos de negócio)
Banco:          🟡 PARCIAL           (entidades base da FASE 1 ✅; demais entidades nas próximas fases)
Storage:        🔴 NÃO IMPLEMENTADO  (apenas interface)
Segurança:      🟡 PARCIAL           (FASE 2 parte 1: Argon2id, sessão segura, CPF cifrado, rate limit e CSRF nas rotas de auth; MFA, RBAC nas rotas, CSP/HSTS e logs pendentes)
Testes:         🟡 PARCIAL           (unit 156, integração 62, E2E 8 — fundação e autenticação)
WhatsApp:       🔴 NÃO IMPLEMENTADO  (apenas interface)
IA:             🔴 NÃO IMPLEMENTADO  (apenas interface)
Billing:        🔴 NÃO IMPLEMENTADO
Observabilidade:🔴 NÃO IMPLEMENTADO  (apenas /api/health)
Deploy:         🟡 PARCIAL           (production no Railway; publica só com CI verde; migrações no pre-deploy; health com banco e migrações; sem staging e sem backup)
```

## Bloqueadores

- Nenhum bloqueador técnico para iniciar a FASE 2.
- Decisões pendentes: serviço de e-mail transacional (bloqueia link mágico, recuperação de senha e verificação de e-mail), credenciais OAuth do Google (bloqueiam login com Google), identidade visual (logo e cor padrão — aguardando arquivos do usuário), unicidade de CNPJ entre empresas, retenção de `audit_logs` × LGPD, adoção de RLS.
- Pendências de infraestrutura (não bloqueiam a FASE 2): backups do PostgreSQL de produção (⏳ exige plano Pro no Railway ou dump externo), branch protection (⏳ exige GitHub Pro ou repositório público), ambiente de staging, configuração do Railway versionada como Infrastructure as Code.

## Última auditoria

**Data:** 2026-09-10
**Responsável:** Claude Code (auditoria FASE 0 + FASE 1 + deploy inicial + CI + FASE 2 parte 1)
**Versão:** 0.5

---

# 43. REGRA FINAL DE EXECUÇÃO

Antes de implementar qualquer fase:

```text
LER MASTER SPEC
      ↓
AUDITAR REPOSITÓRIO
      ↓
COMPARAR ESPECIFICAÇÃO × REALIDADE
      ↓
IDENTIFICAR GAPS
      ↓
IMPLEMENTAR
      ↓
TESTAR
      ↓
VALIDAR SEGURANÇA
      ↓
REGISTRAR EVIDÊNCIA
      ↓
ATUALIZAR MASTER SPEC
```

O Master Spec deve permanecer sincronizado com a realidade do projeto e não deve virar uma lista fictícia de funcionalidades.

---

# 44. REGISTRO DE AUDITORIAS

## 2026-09-10 — FASE 0 + FASE 1

### Estado encontrado

Repositório com apenas `README.md` e `MASTER_PROJECT_SPEC (1).md`; sem código, sem Git, sem dependências. Nenhuma funcionalidade pré-existente — nada a deduplicar.

### Ambiente

| Ferramenta | Versão |
|---|---|
| Sistema operacional | Windows 11 Home 10.0.26200 |
| Node.js | v24.19.0 |
| npm | 11.17.0 |
| pnpm | 10.34.3 (gerenciador adotado) |
| Yarn | não instalado |
| Corepack | 0.35.0 |
| Git | 2.55.0.windows.4 |
| Docker | 29.6.2 (Docker Desktop) |
| Docker Compose | v5.3.1 |
| PostgreSQL | sem instalação local (`psql` ausente); executado via container `postgres:17-alpine` → 17.11 |
| Playwright Chromium | Chrome for Testing 153.0.8010.12 (build 1243), instalado no cache local do usuário |

Containers de outros projetos existentes na máquina não foram alterados; a porta 5440 foi escolhida para evitar conflito.

### Fora do escopo (não implementado, conforme instrução)

Autenticação, sessão, RBAC em runtime, rate limiting, headers de segurança completos, storage, upload, funcionários, fornecedores, contratos, portal externo, WhatsApp, IA, OCR, automações, billing, assinatura eletrônica, relatórios, score e radar de risco. Existem somente contratos (interfaces) para Storage, IA, WhatsApp, notificações, auditoria e rate limiting.

### Observações

- Nenhum commit ou push foi realizado; nenhum serviço externo ou ambiente de produção foi alterado.
- `.env` local foi criado a partir de `.env.example` (somente credenciais do banco local).
- ESLint 9.39.5 é a linha de manutenção (o npm a sinaliza como deprecated) — manter até `eslint-config-next` suportar ESLint 10.
- O banner do Prisma CLI sugere atualizar para `latest` (8.0.0-rc.13, pré-lançamento) — ignorar até uma versão estável.
- `pnpm test:e2e` em modo CI (`CI=1`) usa `pnpm start` e exige `pnpm build` antes.

## 2026-09-10 — Deploy inicial (GitHub + Railway)

Autorizado pelo usuário nesta data.

### O que foi feito

| Item | Resultado |
|---|---|
| Autor dos commits | `João Victor Rodrigues Nascimento <176782412+joaovictormaria@users.noreply.github.com>` (configuração local do repositório) |
| GitHub | repositório privado `joaovictormaria/veldocs`; commits `e86e5dc` (fundação) e `6dd399d` (deploy) em `main` |
| Railway | projeto `veldocs` (workspace Velnox.IA, conta twomegabrains@gmail.com), ambiente `production`, serviços `veldocs-app` e `Postgres` |
| Build | Railpack com Node 24.20.0 e pnpm 10.34.3; `pnpm build` concluído |
| Configuração do serviço | pre-deploy `pnpm db:deploy`, start `pnpm start`, healthcheck `/api/health` (120 s), restart `ON_FAILURE` (5) — aplicada via API e confirmada no manifesto do deploy |
| Variáveis | `APP_ENV=production`, `APP_URL`, `LOG_LEVEL=info`, `PORT=3000`, `DATABASE_URL` como referência a `${{Postgres.DATABASE_URL}}` |
| Dependências | `prisma` e `dotenv` movidos para `dependencies` (migrações rodam no container de produção) |

### Verificação em produção

| Verificação | Resultado |
|---|---|
| Deploy `4f8d54ab` (commit `6dd399d`) | ✅ SUCCESS |
| Migrações (log do pre-deploy) | ✅ `20260910225812_init_base_entities` aplicada — "All migrations have been successfully applied." |
| `GET /api/health` | ✅ HTTP 200 `{"status":"ok","checks":{"database":"up"}}`, `Cache-Control: no-store` |
| `GET /` | ✅ HTTP 200, título "VELDOCS", texto "Zero surpresa documental." |
| `X-Powered-By` | ✅ ausente |
| HTTP → HTTPS | ✅ 301 |

### Problemas encontrados e tratados

- ⚠️ **Primeiro deploy (`d4ec1219`) subiu sem migrações.** O `railway.json` (Config as Code, depreciado pelo Railway) não foi aplicado ao serviço: pre-deploy e healthcheck ficaram nulos. O `/api/health` respondia `ok` porque só verifica a conexão. Corrigido aplicando as configurações via API e removendo o `railway.json`; o deploy seguinte aplicou a migração.
- ⚠️ **`railway config apply` seria destrutivo.** O arquivo gerado por `railway config migrate` declarava só as configurações de deploy; o plano removeria as 5 variáveis e a conexão com o GitHub. Não foi aplicado; a migração para IaC ficou pendente.
- ⚠️ **SDK `railway/iac` 3.11.0 falha no Windows** ao verificar a versão do CLI instalado via npm (tenta executar `process.env._` / `railway` sem shell). Contornado apontando `_` para o `railway.exe` apenas para o `plan`; o SDK foi removido do projeto.
- 🔍 **Verificação por SSH não foi possível:** a chave SSH local não está cadastrada na conta Railway. Não foi cadastrada sem autorização; a comprovação das migrações veio do log do pre-deploy.

### Pendências

- CI (lint, typecheck, testes) antes do deploy automático e branch protection na `main`.
- Backups e política de retenção do PostgreSQL de produção.
- Ambiente de staging.
- Configuração do Railway versionada (`.railway/railway.ts` completo).

## 2026-09-10 — CI e endurecimento do deploy

Autorizado pelo usuário nesta data (passo "blindar o deploy" antes da FASE 2).

### O que foi feito

| Item | Resultado |
|---|---|
| CI | `.github/workflows/ci.yml`: install congelado, lint, typecheck, unitários, integração com PostgreSQL 17, migrações, build e E2E contra `pnpm start`; `permissions: contents: read`; actions fixadas por SHA (`actions/checkout` v7.0.1, `pnpm/action-setup` v6.1.0, `actions/setup-node` v7.0.0); `persist-credentials: false` |
| Pull request | #1 `CI e verificação de migrações no health check` — CI run `34544523969` verde; squash merge como `737af20` |
| Railway espera o CI | gatilho de deploy `4b87d6c8…` atualizado para `checkSuites: true` (confirmado por releitura via API) |
| Health check | `src/infrastructure/database/migrations-health-probe.ts`: `migrations` fica `down` com migração pendente, com falha não resolvida ou sem `_prisma_migrations`; `/api/health` agora verifica `database` e `migrations` |
| Branch protection | ⏳ bloqueado: API do GitHub responde "Upgrade to GitHub Pro or make this repository public" (branch protection e rulesets) |
| Backups do PostgreSQL | ⏳ bloqueado: `volumeInstanceBackupScheduleUpdate` (DAILY, WEEKLY, MONTHLY) recusado com "Not Authorized"; workspace no plano `HOBBY`; lista de agendamentos continua vazia |

### Testes

| Onde | Resultado |
|---|---|
| Local | `pnpm check` — 46 unitários; `pnpm test:integration` — 39; `pnpm build` — sucesso; `pnpm test:e2e` — 3 |
| CI (run `34544523969`) | todas as etapas com sucesso; 46 unitários, 39 integração, 3 E2E |

### Verificação em produção

| Verificação | Resultado |
|---|---|
| CI na `main` (run `34544777947`, commit `737af20`) | ✅ sucesso (2026-09-11 00:02:39 → 00:04:34 UTC) |
| Railway esperou o CI | ✅ deploy `cd3c1d51` em `WAITING` enquanto o CI rodava (00:03:21 UTC); passou a `INITIALIZING` só às 00:04:37, três segundos após o CI concluir |
| Deploy `cd3c1d51` | ✅ `BUILDING` → `DEPLOYING` → `SUCCESS` (00:06:32 UTC) |
| Pre-deploy | ✅ "No pending migrations to apply." |
| `GET /api/health` | ✅ HTTP 200 `{"status":"ok","checks":{"database":"up","migrations":"up"}}`, `Cache-Control: no-store` |
| `GET /` | ✅ HTTP 200 |

## 2026-09-11 — FASE 2 (parte 1): identidade multiempresa, cadastro, login e sessão

### Decisões do usuário

| Tema | Decisão |
|---|---|
| Multiempresa | Sim — uma pessoa pode acessar várias empresas (DEC-005) |
| Login | CPF ou e-mail + senha, link mágico e Google |
| CPF | Opcional |
| MFA | App autenticador (TOTP + códigos de recuperação), obrigatório para OWNER/ADMIN |
| E-mail transacional | Decidir depois |

### O que foi feito

| Item | Evidência |
|---|---|
| Modelo de identidade | `users` global, `memberships`, `sessions`, `rate_limit_buckets`; FKs de perfis, documentos, auditoria e sessão para o vínculo `(company_id, user_id)` |
| Migração | `20260911003408_identity_memberships_sessions`, gerada por `prisma migrate diff` (o `migrate dev` recusa ambiente não interativo) e **reescrita para preservar dados** |
| Domínio | `src/domain/identity/` (CPF, e-mail, senha, identificador de login), `src/domain/access-control/system-roles.ts` (18 permissões, 5 perfis), `src/domain/company/slug.ts` |
| Aplicação | `src/application/auth/` (cadastro, login, gestor de sessão, sessão atual, logout) + portas de identidade, sessão, hash de senha, tokens e proteção de dados |
| Infraestrutura | Argon2id, HMAC/AES-256-GCM, repositórios Prisma, rate limiter PostgreSQL, auditoria, helpers HTTP (IP, origem, JSON limitado, cookie) |
| Rotas | `POST /api/auth/signup`, `POST /api/auth/login`, `POST /api/auth/logout`, `POST /api/auth/logout-all`, `GET /api/auth/session` |
| Ambiente | `APP_ENCRYPTION_KEY` e `APP_HMAC_KEY` validadas no Zod, adicionadas ao `.env.example`, ao CI (valores de teste) e ao Railway (valores aleatórios de 32 bytes, nunca exibidos) |

### Testes (local)

| Suíte | Resultado |
|---|---|
| `pnpm check` (lint + typecheck + unit) | ✅ 11 arquivos, 156 testes |
| `pnpm test:integration` | ✅ 4 arquivos, 62 testes (schema recriado e migrações aplicadas do zero) |
| `pnpm test:e2e` | ✅ 8 testes (fundação + autenticação) |
| Migração com dados antigos (banco descartável) | ✅ pessoa INVITED → ACTIVE com vínculo INVITED; DISABLED → vínculo SUSPENDED; perfil, documento e auditoria preservados; `users.company_id` removido |

Verificação em produção: após o merge e o deploy desta mudança.

### Problemas encontrados e tratados

- ⚠️ A migração gerada automaticamente só funcionava com tabelas vazias (convertia o status antes de criar os vínculos e descartava `users.company_id`). Falhou no banco de testes com dados de execuções anteriores. Reescrita com migração de dados e verificada em banco descartável.
- A preparação dos testes de integração passou a recriar o schema do banco `*_test` a cada execução, para que uma migração com falha registrada não bloqueie as próximas.
- ⚠️ Guardar cópia de `APP_ENCRYPTION_KEY` e `APP_HMAC_KEY` fora do Railway (cofre de senhas): sem elas os CPFs cifrados não podem ser lidos e o login por CPF deixa de funcionar.
- Logo e cor padrão do sistema: o usuário pediu para salvar, mas os arquivos não chegaram; aguardando o arquivo da logo e o código da cor.
