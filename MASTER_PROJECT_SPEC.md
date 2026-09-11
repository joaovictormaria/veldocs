# MASTER PROJECT SPECIFICATION
## VELDOCS — SaaS Modular de Gestão Documental Empresarial

**Versão:** 0.3
**Status:** FASE 0 e FASE 1 concluídas; FASE 2 parcial (identidade multiempresa, cadastro, login, sessão, empresa ativa e autorização nas rotas); FASE 3 (módulos comerciais) não iniciada
**Última auditoria:** 2026-09-11 (ver seção 25)
**Documento:** Fonte única de verdade do projeto
**Marca:** VELDOCS
**Ecossistema:** VELNOX.IA
**Assinatura sugerida:** Gestão inteligente de documentos empresariais
**Conceito:** Zero surpresa documental

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
11. Não marcar um módulo como ativo apenas porque sua interface existe; ativação comercial e entitlement devem existir no backend.
12. Não permitir que alterações de plano/modularização sejam confiadas apenas ao frontend.

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

> **Convenção desta auditoria (2026-09-11):** o documento inteiro foi comparado com o repositório, o banco, os testes e a produção. Itens com status explícito trazem a evidência. Itens que continuam como `- [ ]` foram verificados e **não existem no projeto** — leia-os como 🔴 NÃO IMPLEMENTADO.

## Regra de arquitetura comercial

O VELDOCS será **modular**. O cliente poderá montar sua própria plataforma após o cadastro, escolhendo os módulos disponíveis para a empresa.

- O **Core VELDOCS** é a base obrigatória.
- Módulos adicionais possuem preço próprio.
- O total mensal é recalculado em tempo real conforme os módulos ativos.
- O cliente pode ativar/desativar módulos permitidos pelo plano.
- Dependências entre módulos devem ser validadas pelo backend.
- O acesso a um módulo deve ser controlado por entitlement/licença no backend, nunca somente por esconder/mostrar elementos do frontend.
- Durante o trial, os módulos escolhidos ficam disponíveis para experimentação conforme as regras do plano de teste.

---

# 1. VISÃO DO PRODUTO

## 1.1 Objetivo

**Nome do produto:** VELDOCS

O VELDOCS é um SaaS B2B para empresas organizarem, monitorarem e controlarem documentos empresariais, responsáveis, prazos, pendências e processos de renovação.

O produto deve evoluir de um gerenciador documental para um **assistente operacional da documentação empresarial**.

## 1.2 Posicionamento de marca

**VELNOX.IA** é a empresa/ecossistema.

**VELDOCS** é o produto de gestão documental empresarial.

O VELDOCS deve possuir identidade visual própria, conectada à família VELNOX, sem depender da identidade visual do VELNOX.APP.

## 1.3 Problema

Empresas ainda utilizam combinações de:

- pastas locais;
- Google Drive/OneDrive;
- e-mail;
- WhatsApp;
- planilhas;
- lembretes manuais;
- processos não padronizados.

O VELDOCS deve reduzir desorganização, atrasos, perda de documentos e falta de visibilidade sobre vencimentos.

## 1.4 Proposta de valor

> Organizar documentos, acompanhar prazos, identificar riscos e ajudar a empresa a resolver pendências antes que elas se tornem problemas.

## 1.5 Filosofia do produto

> **Zero surpresa documental.**

O sistema deve tentar perceber, alertar, explicar, recomendar e, quando autorizado, executar ações relacionadas à documentação empresarial.

## 1.6 Público inicial

Pequenas e médias empresas que precisam controlar documentos próprios, de funcionários, fornecedores e contratos, sem depender de uma plataforma corporativa excessivamente complexa.

## 1.7 Canais principais

- Dashboard web.
- WhatsApp.
- Portal externo para terceiros.
- Automações e notificações.

## 1.8 Experiência principal

O VELDOCS deve oferecer três formas complementares de interação:

```text
DASHBOARD → administração e gestão completa
WHATSAPP  → consultas e ações rápidas
IA        → interpretação, orientação e automação assistida
```

---

# 2. MODELO COMERCIAL E MODULAR

## 2.1 Conceito

O VELDOCS não deve obrigar todas as empresas a comprar um pacote fechado.

O modelo principal será:

> **Monte o VELDOCS que sua empresa precisa.**

Após o cadastro, o cliente acessa o **VELDOCS Builder** e escolhe os módulos disponíveis.

## 2.2 Core obrigatório

O Core deve conter o mínimo necessário para o produto existir:

- Empresa
- Usuários
- Autenticação
- Permissões
- Multi-tenancy
- Gestão documental
- Storage
- Dashboard básico

O Core possui preço-base e não pode ser removido.

## 2.3 Módulos adicionais

Exemplos de módulos comercializáveis:

- Controle de vencimentos
- Funcionários
- Fornecedores
- Contratos
- Solicitações
- Aprovações
- Automação
- Análise inteligente de documentos
- Assistente IA
- WhatsApp
- Portal de terceiros
- Relatórios avançados
- OCR / extração de dados
- Score documental
- Radar de risco
- Modo auditoria

Os preços reais serão definidos comercialmente depois. O sistema, porém, deve nascer preparado para preço por módulo.

**Preços definidos pelo usuário em 2026-09-11** (vigentes desde 11/09/2026, gravados pela migração `module_prices_initial`; total com todos os módulos: R$ 638,30/mês):

| # | Módulo | Preço mensal |
|---|---|---|
| 1 | Core (obrigatório) | R$ 49,90 |
| 2 | Controle de vencimentos | R$ 19,90 |
| 3 | Funcionários | R$ 29,90 |
| 4 | Fornecedores | R$ 29,90 |
| 5 | Contratos | R$ 39,90 |
| 6 | Solicitações | R$ 29,90 |
| 7 | Aprovações | R$ 19,90 |
| 8 | Automação | R$ 39,90 |
| 9 | Análise inteligente de documentos | R$ 59,90 |
| 10 | Assistente IA | R$ 39,90 |
| 11 | WhatsApp | R$ 59,90 |
| 12 | Portal de terceiros | R$ 39,90 |
| 13 | Relatórios avançados | R$ 29,90 |
| 14 | OCR / extração de dados | R$ 39,90 |
| 15 | Score documental | R$ 29,90 |
| 16 | Radar de risco | R$ 39,90 |
| 17 | Modo auditoria | R$ 39,90 |

## 2.4 Builder de módulos

Após o cadastro:

```text
Cadastro
  ↓
VELDOCS Builder
  ↓
Selecionar módulos
  ↓
Preço mensal recalculado em tempo real
  ↓
14 dias grátis
  ↓
Uso
  ↓
Assinatura ou bloqueio controlado
```

O Builder deve mostrar para cada módulo:

- nome;
- descrição;
- benefício;
- preço recorrente;
- dependências;
- status ativo/inativo;
- possibilidade de teste, quando permitido;
- impacto no total mensal.

## 2.5 Regras de preço

O preço exibido ao cliente deve ser derivado do backend/catalogo comercial.

O frontend apenas apresenta o cálculo recebido/validado pelo servidor.

O backend deve manter:

- catálogo de módulos;
- preço vigente;
- moeda;
- período de cobrança;
- dependências;
- limites;
- entitlement;
- status do módulo.

## 2.6 Dependências entre módulos

Exemplo:

```text
WhatsApp
  depende de
Gestão documental
```

O backend deve impedir ativação inválida.

## 2.7 Kits e combinações

O sistema poderá oferecer kits com desconto sem eliminar a compra modular.

Exemplo conceitual:

```text
Kit Essencial
Documentos + Vencimentos + Alertas
```

Os kits são uma camada comercial opcional sobre os módulos individuais.

**Kits definidos pelo usuário em 2026-09-11** — ✅ CONCLUÍDO na FASE 3 (catálogo, preços, orçamento, sugestão, escolha no início do trial e troca durante o trial, pela API e pela tela do Builder; troca em assinatura paga depende do pagamento — FASE 16, DEC-030):

| Kit | Indicado para | Módulos incluídos | Preço | Soma avulsa | Economia |
|---|---|---|---|---|---|
| Essencial | Empresas que querem começar | Core + Controle de vencimentos + "Alertas" | R$ 69,90 | R$ 69,80 | ⚠️ **−R$ 0,10** |
| Gestão | Empresas que controlam pessoas e fornecedores | Core + Vencimentos + Funcionários + Fornecedores + Solicitações | R$ 129,90 | R$ 159,50 | R$ 29,60 (18,6%) |
| Inteligência | Empresas que querem IA e análise | Core + Análise inteligente + OCR + Assistente IA + Score documental + Radar de risco | R$ 199,90 | R$ 259,40 | R$ 59,50 (22,9%) |
| Comunicação | Empresas que precisam interagir com terceiros | Core + WhatsApp + Portal de terceiros + Solicitações | R$ 119,90 | R$ 179,60 | R$ 59,70 (33,2%) |
| Controle Avançado | Empresas com processos mais estruturados | Core + Contratos + Aprovações + Automação + Relatórios avançados + Modo auditoria | R$ 169,90 | R$ 219,40 | R$ 49,50 (22,6%) |
| Complete | Empresas que querem praticamente tudo | Core + todos os 16 módulos | R$ 399,90 | R$ 638,30 | R$ 238,40 (37,3%) |

Decisões do usuário (2026-09-11), detalhadas em DEC-024:

- **Essencial mantido** em R$ 69,90, com Core + Controle de vencimentos (os alertas fazem parte de Vencimentos). Como fica R$ 0,10 acima dos mesmos módulos avulsos, o Builder nunca o sugere.
- **Kit + módulos avulsos:** a empresa pode ter um kit e contratar módulos fora dele; o que está no kit não é cobrado de novo.
- **Sugestão:** o Builder sugere o kit que deixa a mesma seleção mais barata, mesmo que traga módulos a mais.

## 2.8 Trial gratuito de 14 dias

Após concluir a configuração dos módulos, o cliente entra em um trial gratuito de **14 dias**.

O trial deve ter estado próprio no backend e não depender apenas de data no frontend.

Estados esperados:

- `TRIAL_ACTIVE`
- `TRIAL_EXPIRING`
- `TRIAL_EXPIRED`
- `ACTIVE`
- `PAYMENT_PENDING`
- `PAST_DUE`
- `CANCELED`
- `SUSPENDED`
- `REACTIVATED`

Durante o trial:

- os módulos selecionados ficam utilizáveis conforme as regras do trial;
- o usuário deve saber quantos dias restam;
- o sistema deve mostrar o valor que será cobrado após o trial;
- mudanças de módulos devem refletir no preço futuro;
- o cliente pode experimentar recursos adicionais conforme as regras comerciais.

**Status (2026-09-11):** 🟡 PARCIAL — estado próprio no backend (DEC-022); dias restantes e valor após o trial no resumo do Builder; troca de kit e módulos durante o trial refletindo no preço futuro (`PUT /api/subscription/modules`, DEC-030). Cobrança ao fim do trial pendente (FASE 16).

## 2.9 Expiração do trial

Ao término dos 14 dias, caso não exista assinatura válida:

- a conta entra em estado controlado;
- os dados não devem ser apagados imediatamente;
- o cliente deve poder visualizar informações necessárias para reativação, conforme política definida;
- recursos de escrita e/ou módulos pagos podem ser bloqueados;
- deve existir caminho claro para assinatura/reativação.

**Decisão (2026-09-11):** sem assinatura válida, **tudo** é bloqueado — Core incluído e sem carência na inadimplência — e os dados ficam guardados para quando a empresa assinar. Login, sessão, segundo fator e troca de empresa continuam acessíveis. Detalhes em DEC-022. **Retenção:** assinatura cancelada guarda os dados e o login por 1 ano; suspensa guarda os dados por 2 meses, e depois a conta pode ser apagada (DEC-025).

## 2.10 Expansão de receita / upsell contextual

O produto deve incentivar a ativação de módulos adicionais sem dark patterns.

Mecanismos previstos:

- recomendações baseadas no uso;
- prévia do módulo;
- testes limitados de funcionalidades;
- mensagens contextuais;
- kits com desconto;
- demonstração do benefício;
- cálculo do novo preço em tempo real;
- sugestões do Assistente IA;
- detecção de necessidades pelo comportamento da conta.

Exemplo:

> Você cadastrou 20 funcionários. O módulo Funcionários permite controlar documentos e vencimentos individualmente.

O objetivo é **mostrar valor**, e não pressionar o usuário.

---

# 3. ESCOPO DO PRODUTO

## 3.1 MVP funcional

- 🟡 PARCIAL — Empresa (tabela `companies` com filiais e setores; criada no cadastro com perfis padrão; gestão da empresa pendente)
- 🟡 PARCIAL — Usuários (pessoa global `users` com vínculos multiempresa `memberships`; cadastro público; convites e gestão de membros pendentes)
- 🟡 PARCIAL — Autenticação (cadastro, login por e-mail ou CPF + senha, sessão, logout e logout geral em produção; MFA, verificação de e-mail, recuperação de senha, link mágico e Google pendentes)
- 🟡 PARCIAL — RBAC/permissões (catálogo de 22 permissões, 5 perfis padrão e verificação de permissão em todas as rotas de negócio existentes; gestão de perfis e membros — FASE 3)
- 🟡 PARCIAL — Multi-tenancy (FKs compostas no banco; empresa ativa na sessão e filtro por empresa nas rotas existentes; storage com prefixo por empresa conferido no adaptador e no banco)
- 🔴 NÃO IMPLEMENTADO — Core modular
- 🔴 NÃO IMPLEMENTADO — Catálogo de módulos
- 🔴 NÃO IMPLEMENTADO — Entitlements de módulos
- ✅ CONCLUÍDO — Documentos (API e tela `/documentos`: criar, editar, excluir logicamente, responsável, filial, setor, datas, etiquetas e arquivos no storage privado — `docs/api/documentos.md`, `docs/api/arquivos.md`, `docs/frontend/telas.md`)
- ✅ CONCLUÍDO — Categorias (API e tela `/categorias`: árvore de até 3 níveis, nome único entre irmãs e exclusão que recusa categoria em uso)
- 🟡 PARCIAL — Upload seguro (envio direto ao bucket por formulário assinado, allowlist de formatos, assinatura do conteúdo e limite de 25 MB — `docs/api/arquivos.md`; antivírus pendente — DEC-035)
- ✅ CONCLUÍDO — Storage privado (Railway Storage Buckets; envio e download só por URL assinada de curta duração; isolamento por prefixo da empresa — DEC-035)
- ✅ CONCLUÍDO — Pesquisa (busca sem acento em título, descrição e etiquetas, com filtros, ordenação e paginação, na API e na tela de documentos)
- ✅ CONCLUÍDO — Vencimentos (módulo Controle de vencimentos: situação automática, filtro por situação e renovação, na API e nas telas — DEC-033)
- 🟡 PARCIAL — Alertas (painel `/vencimentos` com vencidos e a vencer em 30 dias; aviso ativo por e-mail ou WhatsApp pendente)
- 🟡 PARCIAL — Dashboard (`/painel`: cadastro documental, documentos por categoria, vencimentos com o módulo e atividade recente — `docs/api/painel.md`; score documental e radar de risco são módulos futuros)
- 🟡 PARCIAL — Auditoria/histórico (`audit_logs` append-only; eventos de cadastro, login e logout)
- 🔴 NÃO IMPLEMENTADO — Versionamento
- ✅ CONCLUÍDO — Builder de módulos (API e tela: catálogo, preço em tempo real, sugestão de kit, início do trial e troca de kit e módulos durante o trial — `docs/api/builder.md`, `docs/frontend/telas.md`)
- 🟡 PARCIAL — Trial de 14 dias (início e troca de módulos pelo Builder, estados derivados do tempo; cobrança ao fim do trial pendente — FASE 16)
- 🟡 PARCIAL — Estados de assinatura/trial (estados da seção 2.8, bloqueio sem assinatura válida e retenção — DEC-022 e DEC-025; transições por cobrança pendentes)

## 3.2 Evolução V2

> Auditado em 2026-09-11: nenhum item de V2 existe no projeto.

- [ ] Funcionários
- [ ] Fornecedores
- [ ] Solicitações de documentos
- [ ] Aprovações
- [ ] Portal externo
- [ ] Contratos
- [ ] Automações
- [ ] Calendário documental
- [ ] Relatórios
- [ ] Recomendação contextual de módulos

## 3.3 Evolução V3

> Auditado em 2026-09-11: nenhum item de V3 existe no projeto (IA e WhatsApp possuem apenas contratos em `src/application/ports/`).

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

## 3.4 Produto maduro

> Auditado em 2026-09-11: nenhum item existe no projeto.

- [ ] Billing completo
- [ ] Painel administrativo do SaaS
- [ ] Observabilidade completa
- [ ] Escala de workers/serviços
- [ ] Integrações externas
- [ ] Marketplace/ecossistema

---

# 4. ARQUITETURA

## 4.1 Estratégia inicial

**Monólito modular**, com separação clara de domínio, aplicação, infraestrutura e apresentação.

Não adotar microserviços prematuramente.

A arquitetura deve permitir extrair componentes no futuro quando houver necessidade real de carga, equipe ou domínio.

## 4.2 Visão geral

```text
                         USUÁRIO
                            │
               ┌────────────┴────────────┐
               │                         │
          DASHBOARD                   WHATSAPP
               │                         │
               └────────────┬────────────┘
                            │
                     API / BACKEND
                            │
            ┌───────────────┼───────────────┐
            │               │               │
      AUTENTICAÇÃO      MULTI-TENANT      RBAC
            │               │               │
            └───────────────┼───────────────┘
                            │
                    ENTITLEMENT / PLAN
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
             ┌──────────────┴──────────────┐
             │                             │
        PostgreSQL                   Object Storage
             │                         (privado)
             │                             │
             └──────────────┬──────────────┘
                            │
                       Redis / Filas
                            │
                         Workers
                ┌───────────┼───────────┐
                │           │           │
               OCR       Antivírus    Alertas
```

## 4.3 Componentes

### Frontend

- Dashboard web responsivo.
- Builder de módulos.
- Área de assinatura/conta.
- Design system.
- Estados de loading, vazio e erro.
- Interface adaptada por perfil.

### Backend/API

- Autenticação.
- Autorização.
- Multi-tenancy.
- Entitlement de módulos.
- Regras de negócio.
- Catálogo comercial.
- Billing.
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

- OCR.
- Antivírus.
- Processamento de documentos.
- Alertas.
- Notificações.
- Jobs de billing quando necessário.

---

# 5. STACK TECNOLÓGICO OFICIAL

## 5.1 Linguagem principal

**TypeScript**.

## 5.2 Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS v4 (decisão do usuário, DEC-029)

## 5.3 Backend

- Node.js
- TypeScript
- Monólito modular

## 5.4 Banco

- PostgreSQL
- Prisma ORM

## 5.5 Validação

- Zod

## 5.6 Testes

- Vitest
- Playwright

## 5.7 Infraestrutura planejada

- Redis
- Object Storage privado compatível com S3/R2
- Workers assíncronos
- WhatsApp Business API
- Provedor de IA desacoplado por interface
- E-mail transacional

## 5.8 Python

Não usar Python como linguagem principal neste momento.

Poderá ser introduzido futuramente apenas para necessidades específicas de IA/processamento especializado.

## 5.9 Estado auditado (2026-09-11)

| Item | Status | Versão / evidência |
|---|---|---|
| TypeScript | ✅ CONCLUÍDO | 6.0.3, `strict` (7.x não é suportado pelo `typescript-eslint`) |
| Next.js / React | ✅ CONCLUÍDO | 16.3.4 / 19.3.0 |
| Node.js | ✅ CONCLUÍDO | 24 (`.nvmrc`, `engines`); produção 24.20.0 |
| PostgreSQL / Prisma | ✅ CONCLUÍDO | 17 / 7.10.0 com `@prisma/adapter-pg`; 2 migrações |
| Zod | ✅ CONCLUÍDO | 4.6.2 |
| Vitest / Playwright | ✅ CONCLUÍDO | 5.0.0 / 1.63.0 |
| Redis | 🔴 NÃO IMPLEMENTADO | rate limiting provisório em PostgreSQL (DEC-016) |
| Object Storage privado | ✅ CONCLUÍDO | Railway Storage Buckets (S3 compatível) em produção; MinIO fixado no desenvolvimento e no CI (DEC-035) |
| Workers assíncronos | 🔴 NÃO IMPLEMENTADO | — |
| WhatsApp Business API | 🔴 NÃO IMPLEMENTADO | somente contrato `WhatsAppProvider` |
| Provedor de IA | 🔴 NÃO IMPLEMENTADO | somente contrato `AiProvider` |
| E-mail transacional | ⏳ BLOQUEADO | Resend escolhido (DEC-018); aguardando domínio verificado e chave de API |
| Python | ✅ CONCLUÍDO | não utilizado |

---

# 6. MULTI-TENANCY

## 6.1 Princípio

Toda empresa deve ter isolamento lógico e operacional de seus dados.

```text
Empresa A
├── usuários
├── documentos
└── fornecedores

Empresa B
├── usuários
├── documentos
└── fornecedores
```

Nunca permitir acesso cruzado.

## 6.2 Requisitos

- ✅ CONCLUÍDO — Todo recurso empresarial possui vínculo de tenant.
  - Evidência: `company_id NOT NULL` em `branches`, `departments`, `memberships`, `roles`, `user_roles`, `document_categories`, `documents`; `users` é a pessoa global e acessa empresas por `memberships` (DEC-009).
  - Teste: `tests/integration/database/connection-and-migrations.test.ts` — passou (local e CI, 2026-09-11).
- 🟡 PARCIAL — Toda leitura valida tenant: as rotas de negócio existentes (`/api/company`, `/api/company/members`, `/api/company/members/[userId]`, `/api/company/branches*`, `/api/company/departments*`, `/api/builder/*`, `/api/subscription`, `/api/company/roles`, `/api/company/invitations*`) usam só a empresa ativa da sessão, com vínculo e empresa ativos. Cada rota nova deve usar `authorizeRequest`.
  - Testes: `tests/integration/access/access-control.test.ts`, `company-management.test.ts` e `tests/e2e/*.spec.ts` — passaram (local, 2026-09-11).
- 🟡 PARCIAL — Toda escrita valida tenant: o banco rejeita vínculos entre empresas por FKs compostas, inclusive pessoa que não é membro (DEC-010); nas rotas, a empresa vem sempre do `AuthorizedContext` e o `companyId` entra em toda cláusula `where` (empresa, filiais e setores). Rotas dos demais recursos ainda não existem.
  - Testes: `tests/integration/database/tenant-isolation-constraints.test.ts` (17 testes) e `tests/integration/access/company-management.test.ts` — passaram.
- 🟡 PARCIAL — Toda exclusão valida tenant: filiais e setores só são excluídos dentro da empresa da sessão (id de outra empresa responde 404) e a exclusão é lógica, recusando registro ainda em uso.
  - Testes: `tests/integration/access/company-management.test.ts` e `tests/e2e/company-management.spec.ts` — passaram.
- ✅ CONCLUÍDO — Storage possui isolamento lógico por tenant: a chave do objeto é `companies/{empresa}/documents/{documento}/files/{arquivo}`, o adaptador confere o prefixo da empresa antes de cada operação e um CHECK no banco exige que a chave bata com os ids da própria linha.
  - Testes: `tests/integration/documents/document-files.test.ts` (outra empresa não alcança o arquivo pela aplicação nem pelo storage; o banco recusa chave de outra empresa) e `tests/e2e/document-files.spec.ts` — passaram.
- ✅ CONCLUÍDO — Testes de cross-tenant existem: nível banco (17 testes), autorização e consultas com PostgreSQL (IDOR, empresa sem vínculo, vínculo e empresa suspensos) e E2E das rotas (membro de outra empresa → 404; seleção de empresa alheia → 404) — passaram. Estender a cada novo recurso.
- ✅ CONCLUÍDO — Entitlements são associados ao tenant: `company_modules` e `subscriptions` têm `company_id NOT NULL` e a verificação é sempre por `(empresa, módulo)`.
  - Testes: `tests/integration/database/connection-and-migrations.test.ts` e `tests/integration/access/entitlements.test.ts` (o entitlement de uma empresa não vale para outra) — passaram.

---

# 7. SEGURANÇA

Referências principais:

- OWASP ASVS 5.0
- OWASP API Security Top 10

## 7.1 Autenticação

> Decisões do usuário (2026-09-11): login por **CPF ou e-mail + senha**, **link mágico** e **Google**; CPF opcional; **MFA por app autenticador obrigatório para OWNER/ADMIN**; serviço de e-mail a definir.

- ✅ CONCLUÍDO — Login seguro
  - Evidência: `POST /api/auth/login` (e-mail ou CPF com/sem máscara), `POST /api/auth/signup`; `src/application/auth/login.ts`, `register.ts`. Resposta idêntica para qualquer falha e verificação de senha equalizada para conta inexistente.
  - Testes: `tests/unit/application/auth/login-and-register.test.ts`, `tests/integration/auth/auth-services.test.ts`, `tests/e2e/auth.spec.ts` — passaram (local e CI). Produção: login com conta inexistente → HTTP 401 genérico, sem cookie.
- ✅ CONCLUÍDO — Hash de senha no backend: Argon2id (19 MiB, t=2, p=1), mínimo 12 e máximo 128 caracteres. Teste: prefixo `$argon2id$v=19$m=19456,t=2,p=1$` — passou.
- ⏳ BLOQUEADO — Recuperação segura de senha (Resend escolhido; depende do domínio verificado e da chave de API).
- ✅ CONCLUÍDO — Rate limit de autenticação: login 30/15 min por IP e 10/15 min por conta (HMAC do identificador); cadastro 10/h por IP. Testes: bloqueio após 10 tentativas e contagem concorrente — passaram.
- ✅ CONCLUÍDO — MFA: TOTP (RFC 6238) obrigatório para OWNER e ADMIN, com 10 códigos de recuperação de uso único.
  - Evidência: `src/infrastructure/security/totp.ts` (implementação própria para impedir reuso do mesmo código), `src/application/auth/mfa.ts`, rotas `/api/auth/mfa/*`; segredo cifrado (AES-256-GCM) e códigos só como HMAC-SHA256.
  - Testes: unitários com os vetores oficiais da RFC 6238 e replay; integração (cadastro, confirmação, verificação, código de recuperação de uso único, limite de tentativas, segredo cifrado no banco); E2E (OWNER bloqueado até configurar) — passaram em 2026-09-11.
  - Pendente: desativar/recadastrar o segundo fator e gerar novos códigos de recuperação.
- ⏳ BLOQUEADO — Verificação de e-mail (coluna `users.email_verified_at` existe; Resend escolhido, depende do domínio verificado e da chave de API).
- ✅ CONCLUÍDO — Logout de sessões: `POST /api/auth/logout` e `POST /api/auth/logout-all` (integração + E2E — passaram).

## 7.2 Sessões e tokens

- ✅ CONCLUÍDO — Cookies HttpOnly/Secure/SameSite quando aplicável: `HttpOnly` e `SameSite=Lax` verificados no E2E; `Secure` + prefixo `__Host-` em HTTPS (teste unitário). Observação: em produção as flags só aparecem em um login real (não foi criada conta de teste).
- ✅ CONCLUÍDO — Expiração: 7 dias sem uso e no máximo 30 dias desde o login; CHECK `sessions_expiry_order_chk` (unit — passou).
- ✅ CONCLUÍDO — Rotação: sessão nova a cada login e renovação por uso limitada à expiração absoluta (unit — passou).
- ✅ CONCLUÍDO — Revogação: individual e de todas as sessões (unit + integração — passaram).
- ✅ CONCLUÍDO — Proteção contra fixation: token de 256 bits gerado pelo servidor; banco guarda só o SHA-256 (`sessions_id_format_chk`) (unit + integração — passaram).

## 7.3 Autorização

> Cadeia implementada em `src/application/access/authorize.ts`: sessão → pessoa ativa → empresa ativa → vínculo ACTIVE em empresa ACTIVE → segundo fator (quando o perfil exige) → permissão → entitlement do módulo → recurso. Detalhes em `docs/architecture/fundacao-tecnica.md`.

- ✅ CONCLUÍDO — RBAC: permissões calculadas pela união dos perfis do vínculo, verificadas a cada requisição.
  - Testes: unit `tests/unit/application/access/authorize-and-select.test.ts`; integração `tests/integration/access/access-control.test.ts` (VISUALIZADOR lê a empresa mas recebe `forbidden` em membros) — passaram.
- ✅ CONCLUÍDO — Permissões por ação: cada rota exige uma permissão `recurso.acao` (`company.read`, `members.read`).
- ✅ CONCLUÍDO — Autorização server-side: `authorizeRequest` roda no servidor antes de qualquer consulta; o frontend não participa da decisão.
- ✅ CONCLUÍDO — Verificação de tenant: empresa vinda só da sessão, com vínculo e empresa ativos; troca de empresa por `POST /api/auth/active-company` com resposta idêntica para empresa inexistente, sem vínculo ou suspensa (unit + integração + E2E — passaram).
- 🟡 PARCIAL — Verificação do recurso: consultas de membros sempre filtradas pela empresa do contexto (outra empresa → 404); demais recursos nas fases seguintes.
- 🟡 PARCIAL — Verificação de entitlement/módulo: a cadeia exige o módulo de cada permissão (`permission-modules.ts`) e bloqueia com `module_not_enabled` (integração — passou); implementação provisória só com o Core até o catálogo de módulos da FASE 3.

## 7.4 Upload

> **Status (2026-09-11):** 🟡 PARCIAL — implementado na FASE 5 (`docs/api/arquivos.md`, DEC-035); antivírus pendente.

- [x] Allowlist de extensões — PDF, JPEG, PNG e WebP; a extensão precisa combinar com o tipo
- [x] Validação MIME — tipo declarado na allowlist, fixado na política assinada do envio e conferido por CHECK no banco
- [x] Validação de assinatura/magic bytes — o servidor lê o primeiro 1 KB do objeto no bucket; conteúdo que não confere é apagado
- [x] Limite de tamanho — 25 MB no pedido, na política assinada e no banco; tamanho recebido precisa ser igual ao declarado
- [x] Nome interno seguro — a chave do objeto só tem ids; o nome original é higienizado e usado só para exibição
- [ ] Antivírus — pendente (DEC-035); obrigatório antes do portal de terceiros
- [x] Proteção contra path traversal — nome sem diretórios; chave feita só de uuids, recusando qualquer outro valor
- [ ] Proteção contra arquivos maliciosos — parcial: sem executáveis, compactados ou formatos com macros; falta a varredura

## 7.5 Storage

> **Status (2026-09-11):** ✅ CONCLUÍDO — Railway Storage Buckets (FASE 5, DEC-035).

- [x] Bucket privado — buckets do Railway são privados e criptografados em repouso
- [x] Sem listagem pública — acesso só com as credenciais do bucket, guardadas como variáveis do serviço
- [x] Chaves aleatórias — ids uuid, com a empresa como prefixo
- [x] Signed URLs temporárias — envio por formulário assinado de 10 minutos; download por URL de 5 minutos
- [x] Autorização antes de gerar URL — sessão, empresa, permissão, módulo e arquivo da empresa, sempre antes
- [x] Logs de acesso/download — auditoria `document_file.uploaded`, `rejected`, `downloaded` e `deleted`

## 7.6 API

- ✅ CONCLUÍDO — Rate limiting: cadastro, login, segundo fator e rotas de negócio (120/min por IP, resposta 429 com `Retry-After`); implementação em PostgreSQL (DEC-016). Testes unitários e de integração — passaram.
- 🟡 PARCIAL — Input validation (Zod nas rotas de autenticação e de gestão da empresa, com erros por campo em `issues`; `Content-Type: application/json` obrigatório e corpo limitado a 16 KB — unit + E2E — passaram)
- 🟡 PARCIAL — Proteção BOLA/IDOR: rotas por id (`members/[userId]` e suas sub-rotas, `invitations/[invitationId]`, `branches/[branchId]`, `departments/[departmentId]`) buscam sempre por `(empresa da sessão, recurso)` e respondem 404 para outra empresa, inexistente ou id inválido (integração + E2E — passaram); aplicar a cada novo recurso.
- 🟡 PARCIAL — Proteção de função: cada rota exige sua permissão (perfil sem permissão → 403). Funções administrativas de membros têm regras próprias: ninguém altera o próprio vínculo, só Proprietário mexe em Proprietário e a empresa nunca fica sem Proprietário ativo (DEC-027). Perfis personalizados ainda não existem.
- 🟡 PARCIAL — Limites de recursos (corpo de 16 KB; timeout no health check; limites por plano pendentes)
- [ ] Proteção contra SSRF quando aplicável (não há chamadas externas a partir de entrada do usuário)
- [ ] API versioning (rotas atuais em `/api/...`, sem versão)
- [ ] Desativação de endpoints obsoletos
- 🟡 PARCIAL — Proteção CSRF (fora da lista original): rotas que alteram estado exigem `Origin` igual a `APP_URL`; produção recusa origem ausente ou estrangeira com HTTP 403.

## 7.7 IA

- 🟡 PARCIAL — A IA não acessa banco diretamente: contrato `AiProvider` recebe apenas dados já autorizados e o teste de fronteiras impede a camada de aplicação de importar Prisma/infraestrutura. Não há IA implementada.
- [ ] Tools/serviços autorizados.
- [ ] Tenant e RBAC verificados antes de cada ação.
- [ ] Proteção contra prompt injection.
- [ ] Conteúdo de documento tratado como dado não confiável.
- [ ] Limite de uso/custo.
- [ ] Auditoria de ações.

## 7.8 WhatsApp

> Auditado em 2026-09-11: não existe integração com WhatsApp; somente o contrato `WhatsAppProvider` (envio e validação de assinatura de webhook) (FASE 15).

- [ ] Verificação do webhook.
- [ ] Identificação do número.
- [ ] Vínculo número ↔ usuário ↔ empresa.
- [ ] RBAC antes de consultas.
- [ ] Rate limit.
- [ ] Auditoria.
- [ ] Confirmação para ações sensíveis.

## 7.9 Privacidade/LGPD

- 🟡 PARCIAL — Minimização de dados: CPF opcional e armazenado só como HMAC + AES-256-GCM (DEC-015); auditoria sem senha, token, e-mail digitado ou CPF (integração — passou).
- 🟡 PARCIAL — Controle de acesso (autenticação, RBAC e empresa ativa nas rotas existentes; isolamento também no banco).
- [ ] Retenção.
- [ ] Exclusão.
- [ ] Exportação.
- [ ] Gestão de incidentes.
- [ ] Políticas e contratos apropriados.

---

# 8. SEGURANÇA DO STORAGE E DOCUMENTOS

> **Status (2026-09-11):** 🟡 PARCIAL — upload (validação → storage privado → registro no banco) e download (autenticação → empresa → permissão → entitlement → arquivo → URL assinada) implementados na FASE 5 (`docs/api/arquivos.md`). Antivírus, OCR, validação dos dados extraídos e aprovação ainda não existem.

Fluxo esperado:

```text
UPLOAD
  ↓
Validação
  ↓
Antivírus
  ↓
Storage privado
  ↓
Registro no banco
  ↓
OCR/extração assíncrona
  ↓
Validação dos dados
  ↓
Aprovação
```

Download:

```text
Usuário autenticado
  ↓
Tenant
  ↓
RBAC
  ↓
Entitlement
  ↓
Autorização do documento
  ↓
Signed URL temporária
  ↓
Download
```

---

# 9. BANCO DE DADOS

## 9.1 Entidades-base

> Evidência comum: `prisma/schema.prisma`, migrações `20260910225812_init_base_entities` e `20260911003408_identity_memberships_sessions`, `docs/database/modelo-base.md`. Testes de integração: 62 — passaram (local e CI, schema recriado do zero). ✅ = entidade base (tabela, constraints e migração); regras de negócio, APIs e telas pertencem às fases seguintes.

- ✅ CONCLUÍDO — User (pessoa global: e-mail único, CPF opcional protegido, senha Argon2id, status ACTIVE/DISABLED)
- ✅ CONCLUÍDO — Company
- ✅ CONCLUÍDO — Branch
- ✅ CONCLUÍDO — Department
- ✅ CONCLUÍDO — Role (por empresa; 5 perfis padrão provisionados no cadastro)
- ✅ CONCLUÍDO — Permission (catálogo global `recurso.acao`)
- ✅ CONCLUÍDO — Document (metadados; responsável e criador precisam ser membros da empresa)
- ✅ CONCLUÍDO — DocumentCategory (com subcategorias no mesmo tenant)
- ✅ CONCLUÍDO — AuditLog (append-only por trigger)
- 🔴 NÃO IMPLEMENTADO — Module
- 🔴 NÃO IMPLEMENTADO — ModulePrice
- 🔴 NÃO IMPLEMENTADO — CompanyModule / Entitlement
- 🔴 NÃO IMPLEMENTADO — Subscription
- 🔴 NÃO IMPLEMENTADO — Trial

Entidades existentes além da lista: `Membership` (vínculo pessoa ↔ empresa), `UserRole`, `RolePermission`, `Session` (hash do token, expiração e empresa ativa) e `RateLimitBucket`.

## 9.2 Entidades planejadas

> Auditado em 2026-09-11: nenhuma existe no projeto.

- DocumentVersion
- DocumentTag
- Employee
- Supplier
- Contract
- Request
- Approval
- Notification
- AutomationRule
- WhatsAppIdentity
- AIUsage
- ExternalShare

## 9.3 Regras

- ✅ CONCLUÍDO — Foreign keys (inclusive 10+ FKs compostas por tenant e FKs para o vínculo `(company_id, user_id)`).
- ✅ CONCLUÍDO — Unique constraints para chaves de negócio (`companies.slug`, `users.email`, `users.cpf_lookup_hash`, `permissions.key`, `roles(company_id, key)`, `branches(company_id, code)`, `memberships(company_id, user_id)`).
- 🟡 PARCIAL — Índices adequados (índices por `company_id` e FKs, usados pelos filtros de documentos; falta índice de texto para a busca — hoje uma varredura por empresa, aceitável no volume atual).
- ✅ CONCLUÍDO — tenant_id obrigatório onde aplicável (`company_id NOT NULL` nas entidades de empresa).
- ✅ CONCLUÍDO — Integridade referencial (`ON DELETE RESTRICT` por padrão; CHECKs de e-mail, CPF, sessão, permissões e rate limit; trigger append-only).
- ✅ CONCLUÍDO — Migrações controladas (versionadas; aplicadas com `migrate deploy` no pre-deploy do Railway; a migração de identidade preserva dados — verificado em banco descartável).

---

# 10. MÓDULOS DO PRODUTO

> **Status (2026-09-11):** 🟡 PARCIAL no módulo Documentos (10.1): API de metadados, categorias, etiquetas, busca e filtros (`docs/api/documentos.md`), sem arquivo nem tela. Os demais módulos desta seção continuam 🔴 NÃO IMPLEMENTADOS.

## 10.1 Documentos

> **Status (2026-09-11):** 🟡 PARCIAL — metadados completos pela API (`docs/api/documentos.md`) e pela tela `/documentos` (`docs/frontend/telas.md`). Arquivos no storage privado desde a FASE 5 (`docs/api/arquivos.md`); versionamento é da FASE 6.

- [x] Criar — `POST /api/documents` (`documents.create`)
- [x] Editar — `PATCH /api/documents/[documentId]`
- [x] Excluir — exclusão lógica; nada é apagado
- [x] Visualizar — `GET /api/documents/[documentId]` (metadados)
- [x] Download — URL assinada de 5 minutos, auditada
- [x] Upload — direto ao bucket privado, com conferência do conteúdo antes de liberar
- [x] Categorias — árvore de até 3 níveis (DEC-032)
- [x] Tags — etiquetas por empresa, sem duplicar por acento ou maiúscula (DEC-032)
- [x] Responsável — membro ativo da empresa
- [x] Validade — emissão e validade como datas de calendário, validade nunca antes da emissão
- [x] Histórico — auditoria de criação, edição (com campos alterados) e exclusão
- [ ] Versionamento — FASE 6
- [x] Busca — sem depender de acento, em título, descrição e etiquetas (DEC-031)
- [x] Filtros — categoria (com subcategorias), etiqueta, responsável, filial, setor, ordenação e paginação

## 10.2 Vencimentos

> **Status (2026-09-11):** 🟡 PARCIAL — módulo Controle de vencimentos implementado na FASE 4 (DEC-033): situação derivada, painel, filtro e renovação. Aviso ativo (e-mail, WhatsApp) depende dos canais de notificação.

- [x] Datas de emissão/validade
- [x] Status automático — Em dia, Vence em breve (30 dias), Vencido e Sem validade, derivados da validade e do dia em Brasília
- [ ] Alertas — painel `/vencimentos` e `GET /api/expirations` prontos; envio de aviso pendente (canal de notificação)
- [x] Renovação — `POST /api/documents/[documentId]/renew`, a validade precisa avançar
- [x] Responsável — aparece no painel ao lado de cada documento
- [x] Histórico — auditoria `document.renewed` com as datas anteriores e as novas

## 10.3 Funcionários

- [ ] Cadastro
- [ ] Documentos
- [ ] Pendências
- [ ] Vencimentos

## 10.4 Fornecedores

- [ ] Cadastro
- [ ] Documentos
- [ ] Regularidade
- [ ] Pendências
- [ ] Contratos

## 10.5 Contratos

- [ ] Contratante
- [ ] Contratado
- [ ] Valor
- [ ] Início
- [ ] Fim
- [ ] Renovação
- [ ] Responsável
- [ ] Histórico

## 10.6 Solicitações

- [ ] Criar solicitação
- [ ] Enviar
- [ ] Receber
- [ ] Acompanhar
- [ ] Aprovar
- [ ] Rejeitar
- [ ] Solicitar correção

## 10.7 Portal externo

- [ ] Link seguro
- [ ] Expiração
- [ ] Upload
- [ ] Limites
- [ ] Auditoria

## 10.8 Aprovações

- [ ] Fluxo
- [ ] Responsável
- [ ] Comentários
- [ ] Histórico

## 10.9 Automação

- [ ] Regras
- [ ] Gatilhos
- [ ] Ações
- [ ] Logs
- [ ] Ativação/desativação

## 10.10 Assistente IA

- [ ] Perguntas
- [ ] Busca autorizada
- [ ] Explicação de riscos
- [ ] Recomendações
- [ ] Ações com confirmação

## 10.11 WhatsApp

- [ ] Consulta de documento
- [ ] Consulta de vencimentos
- [ ] Consulta de fornecedor
- [ ] Solicitação
- [ ] Envio de documento
- [ ] Ações autorizadas
- [ ] Resumo diário

---

# 11. DASHBOARD E UX

> **Status (2026-09-11):** 🟡 PARCIAL — existem a página inicial, as telas de acesso, o Builder, o painel e as telas de documentos, vencimentos e categorias, com a paleta oficial e cabeçalho comum (DEC-029, DEC-034, `docs/frontend/telas.md`). Área de expansão ainda não existe; o design system continua limitado aos componentes base.

## 11.1 Dashboard executivo

- [x] Total de documentos — com os novos dos últimos 30 dias e o cadastro incompleto (sem responsável, validade ou categoria)
- [x] Válidos — contador do painel de vencimentos (módulo Controle de vencimentos)
- [x] Vencendo — idem
- [x] Vencidos — idem
- [ ] Pendentes
- [x] Próximos vencimentos — lista "Precisam de atenção" do painel
- [x] Atividade recente — ações sobre os dados da empresa, para quem tem `audit.read` (DEC-034)
- [ ] Score documental
- [ ] Radar de risco

## 11.2 Builder de módulos

> **Status (2026-09-11):** 🟡 PARCIAL. Tela `/builder` (`docs/frontend/telas.md`), coberta por E2E no navegador (`tests/e2e/builder-ui.spec.ts`).

- [x] Catálogo visual — kits e módulos com nome, benefício e público
- [x] Preço por módulo — e por kit
- [x] Status ativo/inativo — Obrigatório, Incluído no kit e Em breve
- [ ] Dependências — nenhuma declarada além do Core (DEC-023)
- [x] Total em tempo real — calculado no servidor, com sugestão do kit que barateia a escolha
- [x] Resumo do trial — estado, dias restantes, kit, módulos e valor após o trial
- [ ] CTA de assinatura — depende do pagamento (FASE 16)

## 11.3 Área de expansão

- [ ] Módulos recomendados
- [ ] Motivo da recomendação
- [ ] Prévia
- [ ] Teste limitado quando permitido
- [ ] Ativação
- [ ] Desativação
- [ ] Atualização de preço

## 11.4 Princípios de UX

- Simples.
- Limpo.
- Pouca poluição visual.
- Hierarquia clara.
- Responsivo.
- Acessível.
- Feedback imediato.
- Estados de loading, vazio e erro.
- Upsell contextual, sem dark patterns.

---

# 12. ASSISTENTE E IA

> **Status (2026-09-11):** 🔴 NÃO IMPLEMENTADO — somente o contrato `AiProvider` (DEC-005). Previsto para a FASE 13.

## 12.1 Conceito

O assistente deve ser um **copiloto operacional** da empresa.

Pode:

- responder perguntas;
- encontrar documentos;
- explicar pendências;
- explicar riscos;
- sugerir módulos;
- recomendar ações;
- iniciar ações autorizadas;
- ajudar no onboarding;
- orientar o uso do sistema.

## 12.2 Regra de segurança

A IA nunca pode determinar sozinha o que o usuário pode acessar.

Fluxo:

```text
Usuário
 ↓
Assistente
 ↓
Tool/Serviço autorizado
 ↓
Tenant
 ↓
RBAC
 ↓
Entitlement
 ↓
Dados permitidos
 ↓
Resposta
```

---

# 13. WHATSAPP

> **Status (2026-09-11):** 🔴 NÃO IMPLEMENTADO — somente o contrato `WhatsAppProvider`. Previsto para a FASE 15.

O WhatsApp será uma interface operacional do VELDOCS.

Exemplos:

> “Como está o contrato da Empresa X?”

> “Quais documentos vencem esta semana?”

> “O fornecedor ABC está regular?”

> “Quero enviar o certificado do João.”

O número deve ser vinculado a uma identidade do sistema e respeitar todas as permissões.

---

# 14. NOTIFICAÇÕES E ALERTAS

> **Status (2026-09-11):** 🔴 NÃO IMPLEMENTADO — somente o contrato `NotificationChannel`. O envio por e-mail usará o Resend (DEC-018), após domínio verificado e chave de API.

Canais planejados:

- dentro do sistema;
- e-mail;
- WhatsApp;
- push, futuramente;
- SMS, futuramente.

Tipos:

- vencimento;
- aprovação;
- rejeição;
- nova solicitação;
- pendência;
- assinatura/trial;
- sugestão de módulo;
- alerta de risco.

---

# 15. AUDITORIA E HISTÓRICO

Registrar, quando aplicável:

> **Status (2026-09-11):** 🟡 PARCIAL — `audit_logs` é append-only (UPDATE/DELETE bloqueados por trigger). ✅ Registrados: `auth.account_registered`, `company.created`, `auth.login_succeeded`, `auth.login_failed`, `auth.login_rate_limited`, `auth.register_rate_limited`, `auth.logout`, `auth.logout_all`, `auth.active_company_selected`, `auth.mfa_enrollment_started`, `auth.mfa_enabled`, `auth.mfa_verified`, `auth.mfa_failed`, `auth.mfa_rate_limited` (integração — passou). Os demais eventos abaixo ainda não existem.

- login/logout;
- upload;
- download;
- visualização;
- alteração;
- exclusão;
- restauração;
- aprovação;
- rejeição;
- alteração de permissões;
- alteração de módulo;
- alteração de assinatura;
- ações via WhatsApp;
- ações via IA.

---

# 16. TESTES

## 16.1 Unitários

> Suíte atual: 21 arquivos, 256 testes — passaram (local, 2026-09-11).

- 🟡 PARCIAL — Regras de negócio (identidade: CPF, e-mail, senha, identificador de login; catálogo de perfis; gestor de sessão; login e cadastro; ambiente; health check; fronteiras de arquitetura)
- 🔴 NÃO IMPLEMENTADO — Cálculo de preço modular
- 🔴 NÃO IMPLEMENTADO — Dependências de módulos
- 🔴 NÃO IMPLEMENTADO — Estados de trial/assinatura
- 🔴 NÃO IMPLEMENTADO — Entitlements

## 16.2 Integração

> Suíte atual: 6 arquivos, 74 testes com PostgreSQL real — passaram (local e CI).

- ✅ CONCLUÍDO — Banco (conexão, migrações, tabelas, FKs cross-tenant, unicidade, CHECKs, trigger append-only, health probes)
- ✅ CONCLUÍDO — Auth (`tests/integration/auth/auth-services.test.ts`, 13 testes; `tests/integration/auth/mfa.test.ts`, segundo fator ponta a ponta)
- ✅ CONCLUÍDO — RBAC (`tests/integration/access/access-control.test.ts`: provisionamento, união de perfis, perfil sem permissão, vínculo e empresa suspensos)
- ✅ CONCLUÍDO — Multi-tenancy (nível banco + empresa ativa, pessoa multiempresa, seleção de empresa sem vínculo e consultas sem vazamento entre empresas)
- ✅ CONCLUÍDO — Documentos (`tests/integration/documents/`: metadados, categorias, etiquetas, vencimentos e arquivos)
- ✅ CONCLUÍDO — Storage (`tests/integration/documents/document-files.test.ts`, contra MinIO real: envio direto, conferência, recusa com remoção, política assinada, isolamento e CHECK da chave)
- 🔴 NÃO IMPLEMENTADO — Billing

## 16.3 E2E

> Suíte atual: 17 testes Playwright — passaram (local; CI roda contra `pnpm start`).

- ✅ CONCLUÍDO — Cadastro (`tests/e2e/auth.spec.ts`: cookie HttpOnly/SameSite, sessão, login por CPF, logout, credenciais inválidas, origem e JSON obrigatórios)
- ✅ CONCLUÍDO — Builder (`tests/e2e/builder.spec.ts` pela API e `tests/e2e/builder-ui.spec.ts` no navegador: cadastro → segundo fator → kit + módulo → trial, sugestão de kit, login com código de recuperação, convite pela tela, telas protegidas; `tests/e2e/module-change.spec.ts`: troca de kit e módulos durante o trial pela API e pela tela)
- 🟡 PARCIAL — Ativação de módulo (no início do trial e na troca durante o trial — `tests/e2e/builder.spec.ts`, `tests/e2e/module-change.spec.ts`; ativação após pagamento na FASE 16)
- 🟡 PARCIAL — Desativação (módulo que sai na troca durante o trial fica inativo, sem apagar dados — `tests/e2e/module-change.spec.ts`; o bloqueio do módulo desativado é verificado na integração, porque nenhum módulo pago tem permissões ainda)
- 🔴 NÃO IMPLEMENTADO — Trial
- 🔴 NÃO IMPLEMENTADO — Expiração
- 🔴 NÃO IMPLEMENTADO — Assinatura
- ✅ CONCLUÍDO — Acesso a documentos (`tests/e2e/documents.spec.ts`, `documents-ui.spec.ts` e `document-files.spec.ts`: metadados, arquivos, download por URL assinada e isolamento entre empresas)

## 16.4 Segurança

- ✅ CONCLUÍDO — Cross-tenant (banco, autorização com PostgreSQL e E2E das rotas)
- 🟡 PARCIAL — BOLA/IDOR (rotas de membros: outra empresa, inexistente e id inválido → 404; demais recursos nas fases seguintes)
- 🟡 PARCIAL — Upload (tipo fora da allowlist, tamanho acima do limite, extensão trocada, conteúdo disfarçado e troca do tipo na política assinada — `tests/e2e/document-files.spec.ts` e integração; antivírus pendente)
- ✅ CONCLUÍDO — Storage (outra empresa → 404 em listar, baixar e remover; adaptador recusa chave de outra empresa; CHECK no banco)
- 🟡 PARCIAL — Sessão (hash do token, fixation, expiração, renovação, revogação; falta teste de sequestro/reuso em navegador)
- ✅ CONCLUÍDO — Rate limit (bloqueio por conta e contagem concorrente)
- 🟡 PARCIAL — API (origem, `Content-Type`, tamanho do corpo, respostas padronizadas, headers de segurança e limite por IP nas rotas de negócio)
- 🔴 NÃO IMPLEMENTADO — WhatsApp
- 🔴 NÃO IMPLEMENTADO — IA/prompt injection

---

# 17. MODELO DE ASSINATURA E BILLING

> **Status (2026-09-11):** 🟡 PARCIAL — assinatura com trial de 14 dias, catálogo com preços e kits, entitlements e troca de módulos durante o trial existem (FASE 3). Checkout, cobrança recorrente, upgrade e downgrade pagos, cancelamento, reativação, inadimplência e webhooks pertencem à FASE 16.

## 17.1 Billing

- [ ] Checkout
- [ ] Assinatura recorrente
- [ ] Preço por módulo
- [ ] Cobrança por consumo quando aplicável
- [ ] Upgrade
- [ ] Downgrade
- [ ] Cancelamento
- [ ] Reativação
- [ ] Inadimplência
- [ ] Webhooks

## 17.2 Entitlements

O backend deve manter a relação:

```text
Empresa
  ↓
Assinatura
  ↓
Módulos ativos
  ↓
Entitlements
  ↓
Permissões funcionais
```

A desativação de um módulo deve bloquear suas capacidades conforme a política comercial, sem destruir dados automaticamente.

**Status (2026-09-11):** 🟡 PARCIAL — a relação empresa → assinatura → módulos ativos → entitlements existe no banco e na cadeia de autorização (DEC-022); módulo desativado fica bloqueado e assinatura inválida bloqueia a empresa inteira — nos dois casos sem apagar dados. A ativação e a desativação pelo Builder existem (início do trial e troca durante o trial — DEC-030). O Controle de vencimentos já tem permissões funcionais (`expirations.*`, DEC-033); faltam as dos demais módulos pagos.

---

# 18. UPSELL E EXPANSÃO

O VELDOCS deve monitorar sinais legítimos de necessidade e apresentar oportunidades de expansão.

Exemplos:

- Muitos funcionários → sugerir módulo Funcionários.
- Muitos fornecedores → sugerir módulo Fornecedores.
- Muitas consultas → sugerir WhatsApp.
- Muitos uploads manuais → sugerir análise inteligente/OCR.
- Muitas pendências → sugerir Solicitações/Aprovações.

As recomendações devem ser:

- explicáveis;
- úteis;
- contextuais;
- opcionais;
- sem dark patterns.

---

# 19. OBSERVABILIDADE

> Existem `GET /api/health` (banco e migrações, usado como healthcheck do Railway) e logs estruturados em JSON com `requestId`. Coleta centralizada, métricas e tracing: FASE 18.

- 🟡 PARCIAL — Logs centralizados (logs estruturados em JSON na saída padrão, com redação de campos sensíveis; falta coleta/retenção centralizada)
- [ ] Métricas
- [ ] Tracing
- [ ] Error tracking
- [ ] Alertas
- [ ] Monitoramento de jobs
- [ ] Monitoramento de storage
- [ ] Monitoramento de IA/custos
- [ ] Monitoramento de WhatsApp

---

# 20. BACKUP E DISASTER RECOVERY

- ⏳ BLOQUEADO — Backups automáticos: o agendamento de backups do volume PostgreSQL foi recusado pela API do Railway ("Not Authorized") no plano Hobby; PITR desativado. Requer decisão: plano Pro ou dump para storage externo. **Hoje não há backup de produção.** Decisão adiada pelo usuário em 2026-09-11.
- [ ] Criptografia
- [ ] Retenção
- [ ] Testes de restore
- [ ] RPO definido
- [ ] RTO definido
- [ ] Recuperação de arquivos
- [ ] Recuperação do banco

---

# 21. CI/CD E SUPPLY CHAIN

> Pipeline: `.github/workflows/ci.yml` em todo pull request e push na `main`; o Railway só publica commits da `main` com CI verde (`checkSuites: true`). Última execução verificada: run `34549156042` (commit `a874cfa`) — sucesso; deploy `4f338bf6` ficou em `WAITING` até o CI terminar.

- ✅ CONCLUÍDO — Lint
- ✅ CONCLUÍDO — Type check
- ✅ CONCLUÍDO — Testes (unitários, integração com PostgreSQL 17 e E2E)
- [ ] SAST
- [ ] SCA/dependency scan
- [ ] Secret scanning
- ✅ CONCLUÍDO — Lockfile (`pnpm-lock.yaml`, `install --frozen-lockfile` no CI)
- [ ] SBOM quando apropriado
- [ ] Imagens/container scan quando aplicável (não há imagem própria; build pelo Railpack)
- 🟡 PARCIAL — Ambientes separados (development local e production no Railway; staging não provisionado)
- ⏳ BLOQUEADO — Proteção da branch `main` (fora da lista original): indisponível para repositório privado no plano gratuito do GitHub.

---

# 22. ROADMAP COMPLETO

## FASE 0 — Produto e posicionamento

**Status da fase:** ✅ CONCLUÍDO — definição (`docs/product/visao-do-produto.md`) e identidade visual (`docs/brand/identidade-visual.md`) aplicadas em 2026-09-11.

- ✅ CONCLUÍDO — Nome VELDOCS (página inicial e `<title>`; E2E — passou)
- ✅ CONCLUÍDO — Identidade de marca: logo, ícone e paleta oficial (`#3D5AFE`, `#2541B2`, `#00E5FF`) a partir de `docs/brand/VELDOCS-logo.pdf`; aplicadas na página inicial, tokens de CSS, favicon, `icon` e `apple-icon`.
  - Testes: `tests/unit/presentation/brand.test.ts` (paleta, tokens e dimensões dos arquivos) e E2E "exibe a logo oficial e publica favicon e ícones da marca".
  - Observação: o PDF contém só imagem raster; arquivos vetoriais (SVG) originais pendentes.
- ✅ CONCLUÍDO — Proposta de valor
- ✅ CONCLUÍDO — Público
- ✅ CONCLUÍDO — Conceito Zero surpresa documental
- ✅ CONCLUÍDO — Modelo modular (definição; implementação na FASE 3)
- ✅ CONCLUÍDO — Core + módulos (definição; implementação na FASE 3)
- ✅ CONCLUÍDO — Trial de 14 dias (definição; implementação na FASE 3)

## FASE 1 — Fundação técnica

**Status da fase:** ✅ CONCLUÍDO (validado em 2026-09-10; CI desde 2026-09-10).

- ✅ CONCLUÍDO — Repositório (GitHub privado `joaovictormaria/veldocs`, `.gitignore` sem `.env`, `.gitattributes`, `.nvmrc`)
- ✅ CONCLUÍDO — Environments (`APP_ENV` development/staging/production validado com Zod; `.env.example`; staging não provisionado)
- ✅ CONCLUÍDO — Next.js/React/TypeScript
- ✅ CONCLUÍDO — Node.js/TypeScript
- ✅ CONCLUÍDO — PostgreSQL (local via Docker Compose; produção gerenciada no Railway, só rede privada)
- ✅ CONCLUÍDO — Prisma
- ✅ CONCLUÍDO — Zod
- ✅ CONCLUÍDO — Vitest
- ✅ CONCLUÍDO — Playwright
- ✅ CONCLUÍDO — Estrutura de monólito modular (camadas em `src/`; `tests/unit/architecture/layer-boundaries.test.ts` — passou)

## FASE 2 — Segurança base

**Status da fase:** 🟡 PARCIAL — partes 1 a 4 implementadas em 2026-09-11: identidade multiempresa com cadastro, login e sessão; empresa ativa e autorização nas rotas; segundo fator obrigatório para OWNER/ADMIN; headers de segurança, logs estruturados e limite nas rotas de negócio. Pendentes: verificação de e-mail, recuperação de senha, link mágico e login com Google — todos no backlog (seção 26).

- 🟡 PARCIAL — Autenticação (ver 7.1)
- ✅ CONCLUÍDO — Sessão (ver 7.2)
- 🟡 PARCIAL — Multi-tenancy (empresa ativa e filtro por empresa nas rotas existentes; ver 6.2)
- ✅ CONCLUÍDO — RBAC (mecanismo de autorização aplicado a todas as rotas de negócio existentes; ver 7.3)
- ✅ CONCLUÍDO — Rate limiting (cadastro, login, segundo fator e rotas de negócio)
- ✅ CONCLUÍDO — Headers: CSP com nonce por requisição, HSTS em HTTPS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` e isolamento de origem, aplicados pelo `src/proxy.ts`; `X-Powered-By` removido. Testes unitários e E2E (inclusive o nonce nos scripts da página) — passaram.
- ✅ CONCLUÍDO — Secrets (variáveis validadas; `.env*` fora do Git; `APP_ENCRYPTION_KEY`/`APP_HMAC_KEY` configuradas no Railway sem exibição; rotação de chaves pendente)
- ✅ CONCLUÍDO — Auditoria básica (`audit_logs` append-only e eventos de autenticação)

## FASE 3 — Empresa, usuários e módulos comerciais

**Status da fase:** 🟡 PARCIAL. A primeira metade (estrutura da empresa) está implementada. Da segunda, já existem o catálogo de módulos, os entitlements por empresa os estados do trial, o Builder completo (API e tela, com troca de kit e módulos durante o trial) e a gestão de membros com convites; faltam perfis personalizados e a exclusão de contas após a retenção. Observação: o cadastro leva ao segundo fator e ao Builder pelas telas; o catálogo de permissões ainda deverá ser associado aos módulos pagos.

- ✅ CONCLUÍDO — Empresas (entidade, criação no cadastro e edição dos dados cadastrais com CNPJ validado)
  - Evidência: `PATCH /api/company` (`company.update`), `src/application/access/manage-company.ts`, `src/domain/company/cnpj.ts`; auditoria `company.updated`.
  - Testes: unit (`manage-company.test.ts`, `cnpj.test.ts`), integração (`company-management.test.ts`) e E2E (`company-management.spec.ts`) — passaram (local, 2026-09-11).
- ✅ CONCLUÍDO — Filiais (entidade e gestão completa)
  - Evidência: `GET/POST /api/company/branches` e `GET/PATCH/DELETE /api/company/branches/[branchId]` (`branches.read` / `branches.manage`); código único por empresa, exclusão lógica que recusa filial em uso e libera o código (DEC-021); auditoria `branch.created/updated/deleted`.
- ✅ CONCLUÍDO — Setores (entidade e gestão completa)
  - Evidência: `GET/POST /api/company/departments` e `GET/PATCH/DELETE /api/company/departments/[departmentId]` (`departments.read` / `departments.manage`); setor da empresa inteira ou de uma filial, sempre da mesma empresa; auditoria `department.created/updated/deleted`.
- ✅ CONCLUÍDO — Usuários: pessoa global com vínculos, convites e gestão de membros
  - Evidência: convite por link (`POST /api/company/invitations`, prévia, aceite com sessão e cadastro pelo link — DEC-028), troca de perfil, suspensão, reativação e remoção sem apagar o vínculo (DEC-027); `src/application/access/manage-members.ts`; `docs/api/membros-convites.md`.
  - Testes: `tests/integration/access/members.test.ts` e `tests/e2e/members.spec.ts` — passaram (local, 2026-09-11).
- 🟡 PARCIAL — Roles: 5 perfis padrão por empresa, listados com permissões e membros (`GET /api/company/roles`) e atribuídos a membros; perfis personalizados pendentes.
- 🟡 PARCIAL — Permissions (catálogo de 22 permissões; `expirations.read`/`expirations.manage` são as primeiras de módulo pago)
- 🟡 PARCIAL — Catálogo de módulos
  - Evidência: os 17 módulos da seção 2.3 em `src/domain/billing/module-catalog.ts`, povoados pela migração `commercial_catalog_and_subscriptions` (DEC-023); tabelas `modules`, `module_dependencies` e `module_prices`. Teste de integração compara banco × domínio.
  - Preços: os 17 preços mensais definidos pelo usuário em 2026-09-11, gravados pela migração `module_prices_initial` (seção 2.3).
  - Kits: os 6 kits da seção 2.7, com composição e preços, gravados pela migração `20260911051529_kits_and_subscription_retention` (DEC-024).
  - Pendente: dependências além do Core.
- ✅ CONCLUÍDO — Entitlements (verificação na cadeia de autorização)
  - Evidência: `company_modules` por empresa; `src/infrastructure/access/database-entitlements.ts` substitui o provisório "só Core"; o Core é provisionado no cadastro; assinatura inválida bloqueia tudo, Core incluído, sem apagar dados; empresa sem assinatura (antes do Builder) usa o Core; módulo pago exige contratação ativa **e** assinatura válida (DEC-022).
  - Testes: `tests/integration/access/entitlements.test.ts` (trial vigente e vencido, módulo não contratado ou desativado, sem assinatura, PAST_DUE/CANCELED/SUSPENDED, isolamento entre empresas, FK do catálogo, Core no cadastro) — passaram (local, 2026-09-11).
  - Observação: o Controle de vencimentos é o primeiro módulo pago com permissões próprias (`expirations.*`, DEC-033) e o bloqueio já vale para ele; os demais módulos ganham as suas nas fases em que forem implementados. Ativar e desativar módulos é parte do Builder.
- ✅ CONCLUÍDO — Builder
  - Evidência (API): `GET /api/builder/catalog`, `GET /api/builder/quote`, `POST /api/builder/trial` e `GET /api/subscription`, com as permissões `billing.read`/`billing.manage` de OWNER e ADMIN (DEC-026); `src/application/billing/subscription-use-cases.ts`; documentação em `docs/api/builder.md`.
  - Testes: `tests/unit/application/billing/subscription-use-cases.test.ts`, `tests/integration/billing/subscription.test.ts` e `tests/e2e/builder.spec.ts` — passaram (local, 2026-09-11).
  - Tela: `/builder`, com telas de cadastro, login, segundo fator e convite (Tailwind CSS, DEC-029); `tests/e2e/builder-ui.spec.ts` — passou.
  - Troca de kit e módulos durante o trial: `PUT /api/subscription/modules` (`billing.manage`), só com o teste grátis vigente; módulo que sai fica inativo sem apagar dados e as datas do trial não mudam; auditoria `subscription.modules_changed` (DEC-030). Na tela, "Alterar módulos" no resumo da assinatura.
  - Testes: `tests/unit/application/billing/subscription-use-cases.test.ts`, `tests/integration/billing/module-change.test.ts` e `tests/e2e/module-change.spec.ts` — passaram (local, 2026-09-11).
- 🟡 PARCIAL — Preço em tempo real
  - Evidência: preço vigente por data em `src/infrastructure/database/prisma-billing-catalog-repository.ts` e orçamento calculado no backend em `src/domain/billing/pricing.ts` via `createCatalogQueries.quote` — Core sempre incluído, dependências resolvidas, módulo sem preço vigente explícito em vez de valer zero.
  - Testes: `tests/unit/domain/billing/pricing.test.ts` e `tests/integration/billing/module-prices.test.ts` — passaram (local, 2026-09-11).
  - Kits: orçamento de kit + módulos avulsos (`quoteKit`) e sugestão do kit que barateia a mesma seleção (`suggestKit`) — testes unitários e de integração passaram.
  - API: `GET /api/builder/quote` devolve o total avulso com sugestão de kit, ou kit + módulos fora dele — E2E passou.
  - Pendente: exibição na tela do Builder.
- 🟡 PARCIAL — Trial state machine
  - Evidência: `src/domain/billing/subscription-status.ts` — 14 dias, estados da seção 2.8 (canônicos no banco e derivados do tempo na leitura — DEC-022), transições permitidas e reativação; tabela `subscriptions`.
  - Testes: `tests/unit/domain/billing/subscription-status.test.ts` — passou.
  - Retenção: 1 ano para assinatura cancelada e 2 meses para suspensa (`dataRetentionUntil`, coluna `suspended_at`) — DEC-025.
  - Início do trial: `POST /api/builder/trial` cria a assinatura `TRIALING` de 14 dias e ativa os módulos numa transação; uma única vez por empresa, garantido pelo banco.
  - Pendente: transições acionadas por cobrança (FASE 16) e a exclusão de contas após a retenção.

## FASE 4 — Núcleo documental

**Status da fase:** 🟡 PARCIAL. Metadados, categorias, etiquetas, busca, filtros, o controle de vencimentos e o painel estão prontos na API e nas telas; falta o aviso ativo de vencimento, que depende de um canal de envio (e-mail no backlog, WhatsApp na FASE 15).

- ✅ CONCLUÍDO — Documentos (metadados pela API)
  - Evidência: `GET/POST /api/documents` e `GET/PATCH/DELETE /api/documents/[documentId]` com `documents.read/create/update/delete`; `src/application/documents/manage-documents.ts`; `docs/api/documentos.md`; auditoria `document.created/updated/deleted`.
  - Testes: `tests/unit/application/documents/manage-documents.test.ts`, `tests/integration/documents/documents.test.ts` e `tests/e2e/documents.spec.ts` — passaram (local, 2026-09-11).
  - Tela: `/documentos` — lista com busca, filtros, ordenação e paginação; criar, editar e excluir em formulário; `tests/e2e/documents-ui.spec.ts` — passou.
  - Arquivos: FASE 5 (`docs/api/arquivos.md`).
- ✅ CONCLUÍDO — Categorias (árvore de até 3 níveis)
  - Evidência: `GET/POST /api/categories` e `GET/PATCH/DELETE /api/categories/[categoryId]` (`categories.read`/`categories.manage`); nome único entre irmãs, sem ciclo, exclusão lógica que recusa categoria em uso; caminho completo em cada resposta (DEC-032).
  - Tela: `/categorias` — árvore com recuo por nível, contagem de documentos e formulário de categoria superior.
- ✅ CONCLUÍDO — Tags
  - Evidência: tabelas `tags` e `document_tags`; etiqueta é da empresa e não duplica por acento ou maiúscula; `GET /api/tags` lista as em uso com a contagem de documentos vivos (DEC-032).
- ✅ CONCLUÍDO — Responsáveis
  - Evidência: `responsibleUserId` precisa ser membro ativo; só é reconferido quando muda, para suspensão posterior não travar a edição do documento.
- 🟡 PARCIAL — Pesquisa
  - Evidência: busca sem acento por título, descrição e etiquetas (coluna `documents.search_text`, DEC-031), com filtros por categoria (incluindo subcategorias), etiqueta, responsável, filial e setor, ordenação e paginação.
  - Tela: busca e filtros na lista de documentos, com paginação e resumo ("1-20 de 37").
- ✅ CONCLUÍDO — Vencimentos (módulo Controle de vencimentos, DEC-033)
  - Evidência: situação derivada em `src/domain/documents/expiration.ts`; `GET /api/expirations` (`expirations.read`), `POST /api/documents/[documentId]/renew` (`expirations.manage`) e `status`/`sort=expiration` em `GET /api/documents`, os dois últimos só com o módulo; migração `expiration_permissions`; auditoria `document.renewed`.
  - Telas: `/vencimentos` (contadores, "Precisam de atenção" e renovação) e situação com filtro em `/documentos`; sem o módulo, a tela explica o que ele faz e leva ao Builder.
  - Testes: `tests/unit/domain/documents/expiration.test.ts`, `tests/unit/application/documents/manage-expirations.test.ts`, `tests/integration/documents/expirations.test.ts`, `tests/e2e/expirations.spec.ts` e `tests/e2e/expirations-ui.spec.ts` — passaram (local, 2026-09-11).
- 🟡 PARCIAL — Alertas
  - Evidência: painel com vencidos e a vencer na janela de 30 dias (ajustável por `days`), do mais urgente para o menos.
  - Pendente: aviso ativo por e-mail ou WhatsApp — o e-mail transacional está no backlog e o WhatsApp é a FASE 15.
- ✅ CONCLUÍDO — Dashboard
  - Evidência: `GET /api/dashboard` (`documents.read`) e tela `/painel`: cadastro documental com o que está incompleto, documentos por categoria em barras, vencimentos com o módulo e atividade recente com `audit.read`; `src/application/dashboard/dashboard-queries.ts`; `docs/api/painel.md` (DEC-034).
  - Entrada: `/inicio` leva ao Builder só enquanto a empresa não escolheu os módulos e a pessoa pode escolher; nos demais casos, ao painel.
  - Testes: `tests/unit/application/dashboard/dashboard-queries.test.ts`, `tests/integration/dashboard/dashboard.test.ts` e `tests/e2e/dashboard.spec.ts` — passaram (local, 2026-09-11).
  - Fora desta fase: score documental e radar de risco (módulos pagos da FASE 14).

## FASE 5 — Storage e upload seguro

**Status da fase:** 🟡 PARCIAL. Storage privado, envio direto com conferência, download por URL assinada e auditoria estão prontos; falta o antivírus (DEC-035).

- ✅ CONCLUÍDO — Storage privado
  - Evidência: Railway Storage Buckets em produção; MinIO fixado (`quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z`) no docker-compose e no CI; adaptador `src/infrastructure/storage/s3-storage-provider.ts`; tabela `document_files`.
- ✅ CONCLUÍDO — Signed URLs
  - Evidência: formulário assinado de envio (10 min, com chave, tipo e tamanho máximo na política) e URL de download (5 min, `attachment`); CSP libera só a origem do bucket.
- ✅ CONCLUÍDO — Validação de arquivos
  - Evidência: allowlist, extensão × tipo, 25 MB, tamanho recebido × declarado e assinatura do conteúdo lida no bucket (`src/domain/documents/file-policy.ts`, `src/application/documents/manage-document-files.ts`).
- 🔴 NÃO IMPLEMENTADO — Antivírus (DEC-035)
- ✅ CONCLUÍDO — Logs
  - Evidência: auditoria de envio, recusa (com motivo), download e remoção.
- Testes: `tests/unit/domain/documents/file-policy.test.ts`, `tests/unit/application/documents/manage-document-files.test.ts`, `tests/unit/infrastructure/storage/storage.test.ts`, `tests/integration/documents/document-files.test.ts` e `tests/e2e/document-files.spec.ts` — passaram (local, 2026-09-11).

## FASE 6 — Auditoria e versionamento

- 🟡 PARCIAL — Histórico (`audit_logs` append-only; linha do tempo por recurso pendente)
- [ ] Versionamento
- [ ] Recuperação

## FASE 7 — MVP oficial e testes

- 🟡 PARCIAL — Suite unitária (156 testes)
- 🟡 PARCIAL — Integração (62 testes)
- 🟡 PARCIAL — E2E (8 testes)
- 🟡 PARCIAL — Testes de segurança (cross-tenant no banco, sessão, rate limit, origem)
- [ ] Staging

## FASE 8 — Beta fechado

- [ ] Primeiros clientes
- [ ] Coleta de feedback
- [ ] Métricas de uso
- [ ] Ajustes de UX

## FASE 9 — Funcionários e fornecedores

- [ ] Funcionários
- [ ] Fornecedores
- [ ] Situação documental

## FASE 10 — Solicitações, aprovações e portal

- [ ] Solicitações
- [ ] Aprovações
- [ ] Portal externo
- [ ] Links seguros

## FASE 11 — Contratos, calendário e relatórios

- [ ] Contratos
- [ ] Calendário
- [ ] Relatórios

## FASE 12 — Automações

- [ ] Motor de regras
- [ ] Gatilhos
- [ ] Ações
- [ ] Logs

## FASE 13 — IA e OCR

- [ ] Assistente
- [ ] OCR
- [ ] Extração
- [ ] Classificação
- [ ] Inconsistências
- [ ] Duplicidades

## FASE 14 — Inteligência operacional

- [ ] Score
- [ ] Radar de risco
- [ ] Recomendações
- [ ] Ações proativas
- [ ] Modo auditoria

## FASE 15 — WhatsApp

- [ ] Vinculação
- [ ] Consultas
- [ ] Upload
- [ ] Solicitações
- [ ] Ações
- [ ] Resumos

## FASE 16 — Billing e expansão

- [ ] Checkout
- [ ] Assinatura
- [ ] Webhooks
- [ ] Upsell contextual
- [ ] Kits
- [ ] Reativação

## FASE 17 — Segurança avançada e LGPD

- [ ] Pentest
- [ ] DAST
- [ ] Revisão ASVS
- [ ] Hardening
- [ ] DR
- [ ] Governança/LGPD

## FASE 18 — Observabilidade e escala

- [ ] Logs
- [ ] Métricas
- [ ] Tracing
- [ ] Workers escaláveis
- [ ] Filas
- [ ] Otimização

## FASE 19 — Integrações

- [ ] Google Drive
- [ ] OneDrive
- [ ] Dropbox
- [ ] Microsoft 365
- [ ] ERP
- [ ] RH
- [ ] Contabilidade
- [ ] Assinatura eletrônica
- [ ] API pública

## FASE 20 — Ecossistema

- [ ] Marketplace
- [ ] Integrações de parceiros
- [ ] Extensões
- [ ] Novos produtos VELNOX

---

# 23. REGISTRO DE DECISÕES (ADR)

## DEC-001 — Monólito modular

**Status:** ✅ CONCLUÍDO (auditado em 2026-09-11)

Motivo: simplificar o MVP mantendo fronteiras suficientes para futura evolução.

Evidência: um único app Next.js com camadas `app`/`presentation`, `application`, `domain` e `infrastructure`; dependências verificadas por `tests/unit/architecture/layer-boundaries.test.ts` (passou).

## DEC-002 — TypeScript como linguagem principal

**Status:** ✅ DECIDIDO

Motivo: mesma linguagem no frontend, backend e workers, adequada ao produto web/SaaS.

## DEC-003 — PostgreSQL

**Status:** ✅ DECIDIDO

Motivo: banco relacional maduro e adequado ao domínio empresarial.

## DEC-004 — Storage privado

**Status:** ✅ CONCLUÍDO (implementado na FASE 5 — DEC-035)

Motivo: os documentos são um ativo crítico do sistema.

## DEC-005 — IA via tools autorizadas

**Status:** ✅ DECIDIDO

Motivo: impedir que a IA contorne tenant, RBAC ou regras de negócio.

## DEC-006 — Modelo modular de cobrança

**Status:** ✅ DECIDIDO

Motivo: permitir que cada empresa monte o VELDOCS conforme sua necessidade e aumentar expansão de receita de forma contextual.

## DEC-007 — Trial gratuito de 14 dias

**Status:** ✅ DECIDIDO

Motivo: permitir experiência real antes da assinatura.

## DEC-008 — Upsell contextual

**Status:** ✅ DECIDIDO

Motivo: incentivar expansão apresentando valor e necessidade real, sem dark patterns.

> DEC-009 em diante: decisões tomadas e implementadas durante as FASES 1 e 2, registradas na auditoria de 2026-09-11.

## DEC-009 — Pessoa global com vínculos multiempresa

**Status:** ✅ CONCLUÍDO (decisão do usuário em 2026-09-11)

Motivo: uma mesma pessoa (mesmo e-mail/CPF) precisa acessar várias empresas (ex.: contadores e consultores); com login por CPF, o modelo "uma pessoa, uma empresa" tornaria isso impossível.

Evidência: `users` global + `memberships`; migração `identity_memberships_sessions` com preservação de dados verificada em banco descartável; testes de integração de multiempresa — passaram.

## DEC-010 — Integridade multi-tenant reforçada no banco

**Status:** ✅ CONCLUÍDO

Motivo: defesa em profundidade — FKs compostas `(company_id, ...)` fazem o PostgreSQL rejeitar vínculos entre empresas e o uso de pessoas que não são membros, mesmo com bug na aplicação. Não substitui a autorização server-side.

Evidência: `tests/integration/database/tenant-isolation-constraints.test.ts` (17 testes) — passou.

## DEC-011 — Auditoria append-only no banco

**Status:** ✅ CONCLUÍDO (retenção × LGPD pendente)

Motivo: a trilha de auditoria não pode ser alterada nem apagada pela aplicação. Evidência: trigger `audit_logs_append_only`; testes de integração — passaram.

## DEC-012 — `APP_ENV` separado de `NODE_ENV`

**Status:** ✅ CONCLUÍDO

Motivo: permitir build de produção em staging com regras próprias (HTTPS obrigatório, bloqueio de credenciais locais). Evidência: `src/infrastructure/config/env.ts` e testes unitários.

## DEC-013 — Versões da stack

**Status:** ✅ CONCLUÍDO

Motivo: TypeScript 6.0 (o `typescript-eslint` não suporta 7.x), ESLint 9 (plugins do `eslint-config-next` não suportam 10), Prisma 7.10 estável (a tag `latest` apontava para RC 8), PostgreSQL 17. Ver seção 5.9.

## DEC-014 — Autenticação própria com primitivas auditáveis

**Status:** ✅ CONCLUÍDO

Motivo: bibliotecas prontas trazem tabelas próprias de organização, membros e permissões que conflitam com o tenant por FKs compostas, o RBAC próprio e o login por CPF. Implementação com Argon2id (`@node-rs/argon2`), sessões em banco (só o SHA-256 do token) e cookies conforme a documentação do Next.js 16.

## DEC-015 — CPF opcional protegido

**Status:** ✅ CONCLUÍDO

Motivo: minimização (LGPD) e segurança. O CPF é guardado apenas como HMAC-SHA256 (busca e unicidade) e AES-256-GCM com contexto autenticado. Evidência: teste de integração confirma que nenhuma coluna contém o CPF em claro. Pendência: procedimento de rotação das chaves.

## DEC-016 — Rate limiting em PostgreSQL até existir Redis

**Status:** ✅ CONCLUÍDO

Motivo: evitar nova infraestrutura antes da necessidade. UPSERT atômico em `rate_limit_buckets` atrás da porta `RateLimiter`, substituível por Redis. Evidência: teste de contagem concorrente — passou.

## DEC-017 — Hospedagem no Railway com deploy condicionado ao CI

**Status:** 🟡 PARCIAL (production ativo; staging, backup e configuração versionada pendentes)

Motivo: banco gerenciado, rede privada entre app e banco, HTTPS automático e deploy a partir do GitHub. Configuração aplicada via API (pre-deploy `pnpm db:deploy`, start, healthcheck `/api/health`, restart, `checkSuites: true`). Pendências: staging, backups (bloqueados no plano Hobby) e migração para `.railway/railway.ts` declarando também variáveis e origem.

## DEC-018 — Resend como serviço de e-mail transacional

**Status:** ✅ DECIDIDO (usuário, 2026-09-11) — implementação ⏳ aguardando domínio verificado e chave de API

Motivo: integração simples com Node.js/Next.js e plano inicial adequado ao MVP. Usos previstos: verificação de e-mail, recuperação de senha, link mágico, convites e alertas. O envio ficará atrás da porta de notificações/e-mail, com adaptador de desenvolvimento que não envia e-mails reais. A chave de API deve ficar apenas nas variáveis do Railway.

## DEC-019 — Identidade visual oficial

**Status:** ✅ CONCLUÍDO (2026-09-11)

Motivo: marca própria do VELDOCS conectada ao ecossistema VELNOX.IA. Paleta `#3D5AFE` (azul principal), `#2541B2` (azul escuro) e `#00E5FF` (ciano); logo e ícone em `public/brand/` e `src/app/`. Evidência: `docs/brand/identidade-visual.md`, `tests/unit/presentation/brand.test.ts` e E2E da página inicial. Pendência: arquivos vetoriais originais.

## DEC-020 — Segundo fator próprio (TOTP) obrigatório para OWNER/ADMIN

**Status:** ✅ CONCLUÍDO (decisão do usuário em 2026-09-11; implementado na FASE 2)

**Decisão:** app autenticador (TOTP, RFC 6238) com códigos de recuperação, exigido de OWNER e ADMIN em toda requisição autorizada; confirmação válida por sessão.

**Motivo da implementação própria:** as bibliotecas avaliadas verificam o código mas não informam qual passo de tempo foi aceito, o que impede bloquear a reapresentação do mesmo código dentro da janela de validade. A implementação usa apenas o HMAC do Node e é validada contra os vetores oficiais da RFC 6238.

**Evidência:** `src/infrastructure/security/totp.ts`, `src/application/auth/mfa.ts`, migração `mfa_totp_recovery_codes`; testes unitários, de integração e E2E — passaram.

---

## DEC-021 — Exclusão lógica com liberação do código da filial

**Status:** ✅ CONCLUÍDO (implementado na FASE 3)

**Decisão:** filiais e setores são excluídos logicamente (`deleted_at`), a exclusão é recusada enquanto houver vínculos ativos (setores ou documentos não excluídos) e, ao excluir uma filial, seu `code` é apagado.

**Motivo:** `branches(company_id, code)` é único e não distingue linha excluída; sem liberar o código, um código usado uma vez ficaria bloqueado para sempre na empresa. Pelo mesmo motivo o `ON DELETE RESTRICT` do banco não protege exclusões lógicas — os vínculos são conferidos em transação antes de marcar a exclusão.

**Consequência:** o histórico e a auditoria continuam apontando para a filial excluída, mas ela não aparece em listagens nem pode receber novos setores.

**Evidência:** `src/infrastructure/database/prisma-company-management-repository.ts`; `tests/integration/access/company-management.test.ts` (reuso do código, filial com setor/documento ativo, vínculo já excluído) — passaram.

---

## DEC-022 — Estados do trial derivados do tempo e bloqueio sem assinatura válida

**Status:** ✅ CONCLUÍDO (implementado na FASE 3)

**Decisão:** o banco guarda só o estado **canônico** da assinatura — o que muda por uma ação: `TRIALING`, `ACTIVE`, `PAYMENT_PENDING`, `PAST_DUE`, `CANCELED`, `SUSPENDED`. Os estados da seção 2.8 que dependem apenas do tempo (`TRIAL_ACTIVE`, `TRIAL_EXPIRING`, `TRIAL_EXPIRED`) e `REACTIVATED` são **derivados na leitura**, a partir de `trial_ends_at` e `reactivated_at`.

**Motivo:** gravar "trial expirado" exigiria um processo agendado virando linhas, e entre duas execuções o banco diria "em trial" com o prazo já vencido. Derivando, o estado é sempre exato e não há nada a agendar.

**Política de acesso (decisão do usuário em 2026-09-11):** com assinatura válida — `TRIAL_ACTIVE`, `TRIAL_EXPIRING`, `ACTIVE`, `REACTIVATED` ou `PAYMENT_PENDING` — a empresa usa o Core e os módulos contratados. Com assinatura inválida — `TRIAL_EXPIRED`, `PAST_DUE`, `CANCELED` ou `SUSPENDED` — **bloqueia tudo, Core incluído**, sem carência na inadimplência (HTTP 403 `subscription_inactive`). **Nada é apagado:** os dados ficam guardados e voltam a ficar acessíveis quando a empresa assinar. "Terminando" = últimos 3 dias.

**Empresa sem assinatura:** ainda não passou pelo Builder, onde o trial começa, e usa o Core normalmente. Tratar esse caso como bloqueado trancaria toda conta nova e todas as que já existem.

**Continuam acessíveis durante o bloqueio:** login, sessão, logout, segundo fator e troca de empresa — rotas que não passam pelo autorizador. É o caminho para assinar ou reativar exigido pela seção 2.9; as rotas de assinatura entram com o Builder e a cobrança.

**Evidência:** `src/domain/billing/subscription-status.ts`, `src/infrastructure/access/database-entitlements.ts`; `tests/unit/domain/billing/subscription-status.test.ts` e `tests/integration/access/entitlements.test.ts` — passaram.

---

## DEC-023 — Catálogo e preços versionados em migração

**Status:** ✅ CONCLUÍDO (implementado na FASE 3)

**Decisão:** os 17 módulos da seção 2.3 são povoados pela própria migração `commercial_catalog_and_subscriptions`, espelhando `src/domain/billing/module-catalog.ts`; um teste de integração compara as linhas do banco com o domínio. Os preços definidos pelo usuário em 2026-09-11 entram pela migração `module_prices_initial`, com vigência a partir de 11/09/2026. **Preço nunca é sobrescrito:** mudar um valor é uma migração nova que encerra o atual (`valid_until`) e insere o novo, preservando o histórico. O banco recusa preço negativo, vigência invertida e moeda fora do formato de 3 letras. Módulo sem preço vigente aparece explícito no orçamento, sem valer zero.

**Motivo:** a seção 2.3 diz que os preços serão definidos comercialmente depois, mas que o sistema deve nascer preparado; e a 2.5 exige que o preço venha do backend. Povoar pela migração garante que produção, testes e desenvolvimento tenham exatamente o mesmo catálogo, aplicado pelo `migrate deploy` que já roda no pre-deploy.

**Consequências:** mudar o catálogo exige uma nova migração. Dependências entre módulos existem como mecanismo (`module_dependencies`, `withDependencies`), mas nenhuma foi declarada: a spec (2.6) só cita "WhatsApp depende de Gestão documental", que é Core.

**Evidência:** migração `20260911033935_commercial_catalog_and_subscriptions`; `tests/unit/domain/billing/module-catalog.test.ts` e `tests/integration/access/entitlements.test.ts` — passaram.

---

## DEC-024 — Kits como camada sobre os módulos

**Status:** ✅ CONCLUÍDO (catálogo, preços, orçamento, sugestão, escolha do kit no início do trial e troca durante o trial, implementados na FASE 3; troca em assinatura paga depende do pagamento — FASE 16)

**Decisão (usuário, 2026-09-11):** 6 kits (seção 2.7). Um kit pode ser combinado com módulos avulsos: paga-se o preço do kit e, à parte, só os módulos que ficaram fora dele. O Builder sugere o kit que deixar a mesma seleção mais barata, mesmo que traga módulos a mais; sem economia real, não sugere nada.

**Essencial:** mantido pelo usuário em R$ 69,90, com Core + Controle de vencimentos (os alertas fazem parte de Vencimentos). Fica R$ 0,10 acima dos mesmos módulos avulsos e, pela regra de sugestão, nunca é sugerido — continua disponível para quem escolhê-lo.

**Implementação:** tabelas `kits`, `kit_modules` e `kit_prices` (mesmo histórico e mesmos CHECKs dos preços de módulo), povoadas pela migração `20260911051529_kits_and_subscription_retention`; `src/domain/billing/kit-catalog.ts` e `src/domain/billing/pricing.ts` (`quoteKit`, `suggestKit`), expostos por `createCatalogQueries`.

**Evidência:** `tests/unit/domain/billing/kit-catalog.test.ts`, `tests/unit/domain/billing/pricing.test.ts` e `tests/integration/billing/module-prices.test.ts` (banco × domínio, Gestão + Contratos, sugestões do Gestão, Inteligência e Complete, Essencial nunca sugerido) — passaram.

---

## DEC-025 — Retenção de dados após cancelamento e suspensão

**Status:** 🟡 PARCIAL (prazos calculados; exclusão de contas não implementada)

**Decisão (usuário, 2026-09-11):** assinatura **cancelada** mantém os dados no banco e o login por **1 ano** (obrigação legal); assinatura **suspensa** mantém os dados por **2 meses**, e depois a conta pode ser apagada por completo. Nos dois casos o acesso segue bloqueado (DEC-022).

**Implementação:** `dataRetentionUntil` e `isRetentionExpired` em `src/domain/billing/subscription-status.ts`, contando a partir de `canceled_at` e da nova coluna `suspended_at`. **Nada é apagado automaticamente.**

**Pendente:** confirmar com o jurídico o prazo legal após o cancelamento (o usuário citou 1 ano como exemplo). A exclusão de contas é irreversível e só será implementada com autorização explícita, junto com o registro da exclusão (FASE 17 — LGPD).

**Evidência:** `tests/unit/domain/billing/subscription-status.test.ts` (1 ano, 60 dias, sem data de início, vencimento no instante final, bloqueio mantido) — passou.

---

## DEC-026 — Permissões de assinatura fora do bloqueio

**Status:** ✅ CONCLUÍDO (implementado na FASE 3)

**Decisão:** as permissões `billing.read` e `billing.manage` (só OWNER e ADMIN) continuam valendo quando a assinatura está inválida — trial vencido, atraso, cancelada ou suspensa. Todas as demais seguem bloqueadas (DEC-022).

**Motivo:** a seção 2.9 exige que a empresa bloqueada tenha caminho claro para assinar ou reativar. Sem a exceção, a empresa com trial vencido não conseguiria nem ver a própria situação.

**Implementação:** a regra fica no domínio (`SUBSCRIPTION_EXEMPT_PERMISSIONS` em `src/domain/access-control/permission-modules.ts`) e o autorizador pula o entitlement só para essas permissões — as rotas não decidem nada sozinhas. Um teste garante que só permissões `billing.*` escapam do bloqueio.

**Evidência:** `tests/unit/domain/access-control/permission-modules.test.ts`, `tests/unit/application/access/authorize-and-select.test.ts` e `tests/integration/billing/subscription.test.ts` (trial vencido: `company.read` recusado, situação da assinatura acessível) — passaram.

---

## DEC-027 — Remover membro sem apagar o vínculo

**Status:** ✅ CONCLUÍDO (implementado na FASE 3)

**Decisão:** remover um membro muda o vínculo para `REMOVED` em vez de apagá-lo. O vínculo removido não tem acesso, sai das listagens, perde os perfis e pode ser reativado por um novo convite.

**Motivo:** `audit_logs` referencia o vínculo `(company_id, user_id)` com `ON DELETE RESTRICT` — o histórico de quem fez o quê precisa continuar íntegro. Apagar o vínculo seria impossível para qualquer membro com ações registradas, ou exigiria apagar a própria auditoria.

**Proteções junto com a remoção:** ninguém altera o próprio vínculo; só Proprietário altera, suspende ou remove Proprietário; a empresa nunca fica sem Proprietário ativo — conferido no banco em transação serializável, para que duas alterações simultâneas não passem cada uma na sua checagem.

**Evidência:** `src/infrastructure/database/prisma-member-management-repository.ts`; `tests/integration/access/members.test.ts` (remoção com histórico preservado e novo convite; proteções; último Proprietário) — passaram.

---

## DEC-028 — Convites por link, sem e-mail transacional

**Status:** ✅ CONCLUÍDO (implementado na FASE 3)

**Decisão:** o convite gera um link `/convite/{token}` que quem convida compartilha como quiser. O token é aleatório (32 bytes) e só o SHA-256 fica no banco; o link é exibido uma única vez, vale 7 dias e um uso, e um convite novo para o mesmo e-mail revoga o anterior. Quem não tem conta se cadastra pelo link já como membro, sem criar empresa.

**Motivo:** o e-mail transacional (Resend) está no backlog por decisão do usuário. O link resolve o convite hoje, e o envio por e-mail poderá usar o mesmo token depois.

**Evidência:** `src/application/access/manage-members.ts`, `docs/api/membros-convites.md`; `tests/integration/access/members.test.ts` e `tests/e2e/members.spec.ts` — passaram.

---

## DEC-029 — Telas com Tailwind CSS e dados carregados no servidor

**Status:** ✅ CONCLUÍDO (implementado na FASE 3)

**Decisão:** o estilo usa Tailwind CSS v4 (pedido do usuário em 2026-09-11), integrado pelo PostCSS como na documentação do Next.js 16. Os tokens da marca continuam em `:root` e são expostos ao Tailwind em `@theme` (`brand-*`, `surface-*`). As páginas são componentes de servidor: leem a sessão, redirecionam e carregam os dados com a mesma autorização da API; os componentes de cliente só cuidam da interação.

**Motivos:** carregar no servidor evita a tela piscando antes do redirecionamento e uma ida e volta à API ao abrir a tela, e respeita a regra `react-hooks/set-state-in-effect` do React 19. Toda página é dinâmica por causa do nonce da CSP.

**Cuidados de segurança nas telas:** o destino depois do login só aceita caminhos internos (`safeNextPath`, sem redirecionamento aberto); a chave do autenticador é gerada por clique, porque em desenvolvimento o React executa efeitos duas vezes e a chave exibida poderia não ser a gravada; a tela do convite usa `referrer: no-referrer`, para o token não vazar no cabeçalho `Referer`.

**Evidência:** `src/app/{cadastro,entrar,seguranca,builder,convite/[token],inicio}/page.tsx`, `src/presentation/screens/`, `docs/frontend/telas.md`; `tests/e2e/builder-ui.spec.ts` — passou.

---

## DEC-030 — Troca de kit e módulos só durante o teste grátis

**Status:** ✅ CONCLUÍDO (implementado na FASE 3)

**Decisão:** a empresa troca kit e módulos pelo Builder enquanto o teste grátis está vigente (`TRIAL_ACTIVE` ou `TRIAL_EXPIRING`). A troca substitui a escolha inteira e não reinicia nem estende o trial: as datas continuam as mesmas. O valor após o trial passa a refletir a nova escolha, com os preços vigentes. Módulo que sai vira `INACTIVE` com a data da desativação — nada é apagado — e escolhê-lo de novo reativa a mesma linha. Antes de iniciar o trial a resposta é `409 trial_not_started`; em qualquer outro estado, `409 not_in_trial`.

**Motivos:** a seção 2.8 exige que mudanças de módulos reflitam no preço futuro. Numa assinatura paga, trocar módulos envolve cobrança proporcional e confirmação de pagamento, que só existem na FASE 16; liberar a troca sem isso deixaria a empresa usar módulos não pagos. Com o trial vencido a empresa está bloqueada (DEC-022) e o caminho é assinar, não trocar. A regra fica no domínio (`canChangeModules` em `src/domain/billing/subscription-status.ts`), e o resumo da assinatura expõe `canChangeModules` para a tela não decidir sozinha.

**Cuidados:** a mesma validação do início do trial (módulo e kit existentes, disponíveis e com preço); a transação confere o trial de novo no momento da gravação, para que um trial vencido entre a leitura e a escrita não seja alterado; a auditoria `subscription.modules_changed` só é gravada quando algo muda, com kit anterior e novo, módulos ativados e desativados e o novo valor.

**Evidência:** `src/application/billing/subscription-use-cases.ts` (`changeModules`), `src/infrastructure/database/prisma-subscription-repository.ts`, `src/app/api/subscription/modules/route.ts`; `tests/unit/domain/billing/subscription-status.test.ts`, `tests/unit/application/billing/subscription-use-cases.test.ts`, `tests/integration/billing/module-change.test.ts` e `tests/e2e/module-change.spec.ts` — passaram.

---

## DEC-031 — Busca sem acento por coluna normalizada

**Status:** ✅ CONCLUÍDO (implementado na FASE 4)

**Decisão:** cada documento guarda em `documents.search_text` o título, a descrição e as etiquetas já em minúsculas e sem acento; a busca normaliza os termos da mesma forma e exige que todos apareçam (até 6 termos).

**Motivo:** a alternativa natural seria a extensão `unaccent` do PostgreSQL, que exige privilégio de superusuário para ser criada — algo que não se pode garantir num banco gerenciado, e que faria a migração falhar no deploy. Com a coluna normalizada, "certidao" encontra "Certidão" sem depender de nada instalado no servidor, e a mesma regra vale no teste e em produção.

**Custo aceito:** a busca é `LIKE` com curinga nas duas pontas, ou seja, varredura dentro da empresa. No volume de hoje isso é irrelevante; quando justificar, entra um índice de texto (trigrama ou `tsvector`) sobre a mesma coluna, sem mudar a API.

**Evidência:** `src/domain/documents/search-text.ts`, `src/infrastructure/database/prisma-document-repository.ts`; `tests/unit/domain/documents/document-rules.test.ts` e `tests/integration/documents/documents.test.ts` (busca com e sem acento, vários termos, descrição e etiqueta) — passaram.

---

## DEC-032 — Categorias em até 3 níveis e etiquetas por empresa

**Status:** ✅ CONCLUÍDO (implementado na FASE 4)

**Decisão:** as categorias formam uma árvore de no máximo 3 níveis, com nome único entre irmãs (comparado sem acento e sem maiúsculas) e sem ciclos — mover uma categoria leva a subárvore junto e o limite vale para o resultado. As etiquetas são livres, pertencem à empresa e são identificadas pelo nome normalizado: "Fiscal", "fiscal" e "FISCAL" são a mesma, e a primeira grafia é a que fica.

**Motivos:** a spec (10.1) pede categorias com subcategorias e tags livres, sem definir profundidade. Um limite explícito mantém a navegação compreensível e o caminho legível na tela; sem limite, a árvore vira um labirinto e o filtro por categoria (que inclui as descendentes) fica imprevisível. Nas etiquetas, normalizar evita a lista encher de variações da mesma palavra.

**Implementação:** as regras de árvore ficam no domínio (`src/domain/documents/category-tree.ts`) e dependem de ler a árvore antes de gravar; por isso as escritas de categoria de uma empresa são serializadas por `pg_advisory_xact_lock`, senão duas requisições simultâneas passariam cada uma na sua checagem. No banco, `tags(company_id, normalized_name)` é único e os CHECKs impedem nome em branco e categoria filha de si mesma.

**Evidência:** `src/domain/documents/category-tree.ts`, `src/domain/documents/tags.ts`, migração `documents_categories_tags`; `tests/integration/documents/documents.test.ts` (três níveis e recusa do quarto, nome repetido entre irmãs, ciclo, mover subárvore, etiqueta reaproveitada) — passaram.

---

## DEC-033 — Controle de vencimentos como primeiro módulo pago

**Status:** ✅ CONCLUÍDO (implementado na FASE 4)

**Decisão:** a data de validade é dado do Core — qualquer empresa cadastra e vê. O **controle** sobre ela é do módulo Controle de vencimentos: situação automática (Em dia, Vence em breve, Vencido, Sem validade), filtro e ordenação por vencimento, painel com contadores e "Precisam de atenção", e renovação. As permissões `expirations.read` (todos os perfis padrão) e `expirations.manage` (quem já edita documentos) pertencem ao módulo `vencimentos`, então a autorização exige o perfil **e** o módulo.

**Situação derivada, nunca gravada:** calculada da validade e do dia de hoje **em Brasília** — pelo mesmo motivo dos estados do trial (DEC-022), nada a agendar e nenhum momento em que o banco mente. "Vence em breve" cobre o dia do vencimento e os 30 dias anteriores; o filtro vira intervalo de datas no banco.

**Renovação:** novas datas no mesmo documento; a validade precisa avançar (corrigir para trás é edição, não renovação), e a auditoria `document.renewed` guarda as datas anteriores e as novas.

**Sem o módulo:** a listagem funciona normalmente, sem situação; pedir `status` ou `sort=expiration` responde `403 module_not_enabled`; a seção Vencimentos some do menu e `/vencimentos` explica o que o módulo faz, com o caminho para o Builder (MASTER SPEC 2.10 — mostrar valor sem pressionar).

**Pendente:** aviso ativo (e-mail, WhatsApp). O e-mail transacional está no backlog por decisão do usuário e o WhatsApp é a FASE 15; o painel já entrega a lista que o aviso vai usar.

**Evidência:** `src/domain/documents/expiration.ts`, `src/application/documents/manage-expirations.ts`, `src/app/api/expirations/route.ts`, `src/app/api/documents/[documentId]/renew/route.ts`, migração `expiration_permissions`; `tests/integration/documents/expirations.test.ts` (situação e filtro com datas reais, painel, renovação, GESTOR bloqueado sem o módulo e liberado com ele) e `tests/e2e/expirations.spec.ts` — passaram.

---

## DEC-034 — Painel como entrada do sistema

**Status:** ✅ CONCLUÍDO (implementado na FASE 4, a pedido do usuário)

**Decisão:** depois de entrar, a pessoa vai para o **painel** (`/painel`). O Builder só é a entrada enquanto a empresa ainda não escolheu os módulos **e** a pessoa pode escolhê-los (`billing.manage`); segundo fator pendente continua indo para `/seguranca`. A regra fica num lugar só, `/inicio`, e login, segundo fator, cadastro e convite passam por ela.

**Motivo:** a Assinatura é uma tela de configuração, visitada de vez em quando; abrir sempre nela obrigava a pessoa a procurar a saída. Um Colaborador convidado caía numa tela que não podia usar ("Somente Proprietário ou Administrador…").

**O que o painel mostra, e para quem:** cada parte obedece à regra que já vale nas outras telas, então o painel não revela nada novo a nenhum perfil:

- cadastro documental (total, novos em 30 dias, sem responsável, sem validade, sem categoria) e documentos por categoria — `documents.read`;
- vencimentos (contadores e próximos) — só com o módulo Controle de vencimentos; sem ele, se houver documentos com validade, uma sugestão discreta do módulo (MASTER SPEC 2.10);
- atividade recente — só com `audit.read`, e só ações sobre os dados da empresa: login, segundo fator e sessão ficam de fora, porque dizem respeito a cada pessoa.

**Gráfico:** barras horizontais de uma série só, na cor principal da marca (validada contra as superfícies clara e escura), sem legenda, com o valor na ponta em tinta de texto; categorias além das 6 maiores somam em "Outras categorias". Cada número e cada barra levam à lista de documentos já filtrada.

**Evidência:** `src/app/inicio/page.tsx`, `src/app/_lib/session.ts` (`landingPath`), `src/application/dashboard/dashboard-queries.ts`, `src/presentation/screens/dashboard-view.tsx`; `tests/e2e/dashboard.spec.ts` (empresa nova vai ao Builder e, depois do trial, ao painel; números levam à lista filtrada; sugestão do módulo) e `tests/e2e/builder-ui.spec.ts` (colaborador convidado começa pelo painel) — passaram.

---

## DEC-035 — Arquivos no Railway Storage Buckets, com envio direto e conferência

**Status:** 🟡 PARCIAL (implementado na FASE 5; antivírus pendente)

**Decisão (usuário, 2026-09-11: "manter tudo em um só lugar"):** os arquivos ficam num **Railway Storage Bucket** — S3 compatível, privado, criptografado em repouso, sem cobrança de saída de dados nem de operações. O volume do Railway foi descartado: prende o arquivo a um serviço, impede deploy sem interrupção e não oferece URL assinada.

**Envio direto ao bucket, conferência no servidor:** o servidor confere o que o navegador declarou e emite um formulário assinado cuja política fixa chave, tipo e tamanho máximo; o navegador envia o arquivo direto ao bucket; o servidor então lê no bucket o tamanho e o primeiro 1 KB e só libera o que confere. O que não confere é apagado. Motivo: o `proxy` do Next.js 16 guarda o corpo da requisição em memória (10 MB por padrão), e não há razão para o servidor carregar arquivos de até 25 MB.

**Download:** a rota autoriza e responde `302` para uma URL assinada de 5 minutos, com `Content-Disposition: attachment`; o arquivo nunca passa pelo servidor e cada download fica na auditoria.

**Nada é apagado automaticamente:** o bucket não tem versionamento, então apagar é irreversível. Remover um arquivo tira ele do documento e mantém o objeto; a exceção é o conteúdo recusado na conferência, que nunca ficou disponível.

**Isolamento:** chave `companies/{empresa}/documents/{documento}/files/{arquivo}` feita só de ids; o adaptador confere o prefixo da empresa antes de cada operação e um CHECK no banco exige que a chave bata com os ids da própria linha.

**Antivírus — pendente:** não há varredura. Até ela existir, a proteção é: formatos de documento digitalizado apenas (sem executáveis, compactados ou formatos com macros), assinatura do conteúdo conferida, limite de tamanho e envio só por membros autenticados da empresa. A varredura é **obrigatória antes do portal de terceiros** (FASE 10), quando pessoas de fora passam a enviar arquivos. A escolha da ferramenta é do usuário, porque tem custo mensal (ClamAV como serviço no Railway ocupa memória continuamente).

**Desenvolvimento e CI:** MinIO fixado em `quay.io/minio/minio:RELEASE.2025-09-07T16-13-09Z` — o MinIO parou de publicar imagens no Docker Hub. Um bucket próprio para os testes de integração, que só aceitam nome terminado em `-test`.

**Evidência:** `src/domain/documents/file-policy.ts`, `src/application/documents/manage-document-files.ts`, `src/infrastructure/storage/`, migração `document_files`; `tests/integration/documents/document-files.test.ts` (contra MinIO real) e `tests/e2e/document-files.spec.ts` — passaram.

---

# 24. STATUS GERAL

**Produto:** ✅ CONCLUÍDO (definição e identidade visual; vetores da logo pendentes)
**Arquitetura:** ✅ CONCLUÍDO (monólito modular em camadas; entitlements por empresa na cadeia de autorização)
**Segurança:** 🟡 PARCIAL (autenticação, sessão, CPF protegido, rate limit, CSRF, empresa ativa, RBAC, MFA para OWNER/ADMIN, CSP com nonce, HSTS e logs estruturados; verificação de e-mail e recuperação de senha no backlog)
**Frontend:** 🟡 PARCIAL (Tailwind CSS com a paleta oficial; telas de cadastro, login, segundo fator, Builder, convite, painel, documentos, categorias e vencimentos, com cabeçalho e navegação comuns)
**Backend:** 🟡 PARCIAL (autenticação, empresa ativa, autorização, consultas da empresa e dos membros e gestão de empresa, filiais e setores; catálogo comercial, entitlements por empresa, API do Builder com início do trial e troca de módulos durante o trial, gestão de membros com convites; núcleo documental com categorias, etiquetas, busca e filtros; módulo Controle de vencimentos; painel da empresa; arquivos em storage privado — sem os demais módulos de negócio)
**Banco:** 🟡 PARCIAL (identidade, empresa, acesso, documentos com texto de busca, etiquetas e arquivos, auditoria, catálogo comercial com preços e kits, módulos por empresa e assinatura com prazos de retenção)
**Storage:** 🟡 PARCIAL (Railway Storage Buckets privado; envio direto e download por URL assinada; conteúdo conferido; antivírus pendente)
**Billing:** 🔴 NÃO IMPLEMENTADO
**WhatsApp:** 🔴 NÃO IMPLEMENTADO
**IA:** 🔴 NÃO IMPLEMENTADO
**Testes:** 🟡 PARCIAL (41 arquivos, 501 unitários, 16 arquivos, 186 integração, 59 E2E; integração e E2E com PostgreSQL e storage S3 reais; CI bloqueando o deploy)

## Bloqueadores

- 📋 **Backlog (adiado pelo usuário em 2026-09-11):** e-mail transacional (Resend), login com Google e cópia/backup das chaves e do banco — ver seção 26. Não devem ser cobrados agora; retomar quando o projeto estiver perto de concluir.

- **Arquivos vetoriais da logo (SVG):** não bloqueia; os recortes raster atuais atendem a página e os ícones.

- ⏳ **Proteção da branch `main`**: exige GitHub Pro ou repositório público.
- Pendências da FASE 3: dependências entre módulos além do Core; confirmar com o jurídico o prazo de 1 ano de retenção após o cancelamento; autorizar a exclusão de contas suspensas após 2 meses (irreversível, ainda não implementada). Preços, kits, carência, bloqueio e retenção foram decididos em 2026-09-11.
- Decisões pendentes sem bloqueio imediato: unicidade de CNPJ entre empresas, retenção de `audit_logs` × LGPD, adoção de RLS, rotação de chaves.

## Regra final

O VELDOCS deve evoluir por etapas pequenas e verificáveis. Cada fase deve terminar com código funcionando, testes executados, evidências registradas e este documento atualizado.

---

# 25. REGISTRO DE AUDITORIAS

## 2026-09-11 — Auditoria do MASTER SPEC v0.2 (modelo modular) contra o repositório

O documento v0.2 substituiu integralmente a especificação anterior a pedido do usuário (a versão anterior, com o histórico detalhado de evidências das FASES 0, 1 e 2, está no Git no commit `a874cfa`). Esta auditoria marcou os status reais e registrou as decisões já implementadas (DEC-009 a DEC-017).

### Histórico consolidado

| Data | Entrega | Evidência |
|---|---|---|
| 2026-09-10 | FASE 0 e FASE 1: Next.js 16, Prisma 7 + PostgreSQL 17, Zod, Vitest, Playwright, entidades-base, FKs compostas por tenant, auditoria append-only | commit `e86e5dc` |
| 2026-09-10 | Deploy no Railway (app + PostgreSQL privado); migrações no pre-deploy | commits `6dd399d`, `d5bbee4` |
| 2026-09-10 | CI no GitHub Actions; Railway só publica com CI verde; health check com migrações | PR #1 (`737af20`), PR #2 (`43875a2`) |
| 2026-09-11 | FASE 2 parte 1: pessoa global + vínculos, CPF protegido, Argon2id, cadastro, login por e-mail/CPF, sessão, logout, rate limit, auditoria | PR #3 (`a874cfa`), CI run `34549156042`, deploy `4f338bf6` |

### Verificação em produção (2026-09-11, após o deploy `4f338bf6`)

| Verificação | Resultado |
|---|---|
| CI da `main` e espera do Railway | ✅ deploy em `WAITING` até o CI concluir com sucesso; depois `BUILDING` → `DEPLOYING` → `SUCCESS` |
| Pre-deploy | ✅ migração `20260911003408_identity_memberships_sessions` aplicada ("All migrations have been successfully applied") |
| `GET /api/health` | ✅ HTTP 200 `{"status":"ok","checks":{"database":"up","migrations":"up"}}` |
| `GET /api/auth/session` sem cookie | ✅ HTTP 401 `unauthenticated` |
| `POST /api/auth/signup` sem Origin / com Origin estrangeira | ✅ HTTP 403 `forbidden_origin` |
| `POST /api/auth/login` com conta inexistente | ✅ HTTP 401 genérico, sem `Set-Cookie`, `Cache-Control: no-store` |
| `POST /api/auth/login` com corpo não JSON | ✅ HTTP 415 |

Não foi criada conta de teste em produção: a auditoria append-only impediria removê-la. As flags `Secure`/`__Host-` do cookie estão cobertas por teste automatizado e serão observáveis no primeiro login real.

### Inconsistências corrigidas nesta auditoria

- Referências a decisões com a numeração antiga: DEC-005 (multiempresa) → DEC-009 em `prisma/schema.prisma`, `docs/architecture/fundacao-tecnica.md` e teste de integração; DEC-003 (IA) → DEC-005 em `src/application/ports/ai-provider.ts`.
- Referências a fases do roadmap antigo nos contratos: IA 25 → 13, WhatsApp 30 → 15, storage 6 → 5, notificações 10 → alertas da FASE 4; comentário de documentos no schema (fases 5 e 6); design system sem fase definida.
- `docs/product/visao-do-produto.md` atualizado para o modelo modular (Core + módulos, Builder, trial, VELNOX.IA).
- `README.md`: seção "Estado atual" com a situação real, primeiros passos e nota sobre a estrutura real do código (texto restante mantido como enviado).

### Impactos do modelo modular sobre o que já existe

- O cadastro (`POST /api/auth/signup`) cria empresa e sessão diretamente; deverá conduzir ao Builder, e o trial começará após a escolha dos módulos (FASE 3).
- A autorização planejada para a FASE 2 parte 2 deve seguir a cadeia tenant → RBAC → entitlement → recurso.
- O catálogo de permissões precisará ser associado a módulos (ex.: `documents.*` no Core).
- A verificação de e-mail passou a ser requisito explícito (7.1), aumentando a urgência da escolha do serviço de e-mail.

### Pendências do usuário

- Guardar cópia de `APP_ENCRYPTION_KEY` e `APP_HMAC_KEY` em um cofre de senhas.
- Enviar logo e cor padrão do sistema.
- Escolher o serviço de e-mail transacional e criar as credenciais OAuth do Google.
- Decidir sobre backups (plano Pro no Railway ou alternativa) e proteção da `main`.

## 2026-09-11 — FASE 2 (parte 2): empresa ativa e autorização nas rotas

### O que foi feito

| Item | Evidência |
|---|---|
| Cadeia de autorização | `src/application/access/authorize.ts`: sessão → pessoa ativa → empresa ativa → vínculo ACTIVE em empresa ACTIVE → permissão (união dos perfis) → entitlement do módulo |
| Empresa ativa | `POST /api/auth/active-company` (`select-active-company.ts`); resposta idêntica para empresa inexistente, sem vínculo ou suspensa; auditoria `auth.active_company_selected` |
| Módulo de cada permissão | `src/domain/access-control/permission-modules.ts` (todas no Core); `createCoreOnlyEntitlementService` provisório até a FASE 3 |
| Rotas de negócio | `GET /api/company` (`company.read`), `GET /api/company/members` e `GET /api/company/members/[userId]` (`members.read`), sempre com `authorizeRequest` |
| Consultas | `src/application/access/company-queries.ts` só aceita `AuthorizedContext`; `prisma-access-control-repository.ts` filtra sempre por empresa |
| Respostas | `401 unauthenticated`, `403 active_company_required`, `403 forbidden`, `403 module_not_enabled`, `404` para recurso fora da empresa |

### Testes (local)

| Suíte | Resultado |
|---|---|
| `pnpm lint` / `tsc --noEmit` | ✅ sem erros |
| `pnpm test` | ✅ 14 arquivos, 178 testes |
| `pnpm test:integration` | ✅ 5 arquivos, 69 testes (novos: OWNER, VISUALIZADOR sem acesso a membros, união de perfis, suspensão imediata, pessoa em duas empresas, IDOR, módulo não habilitado) |
| `pnpm test:e2e` | ✅ 12 testes (novos: dados da empresa ativa, membro de outra empresa → 404, seleção de empresa alheia → 404, ids inválidos → 404, sem sessão → 401, origem obrigatória) |

Verificação em produção: após o merge e o deploy desta mudança.

### Observações

- Não há gestão de membros e perfis nas rotas (convites, atribuição de perfis): isso pertence à FASE 3.
- MFA obrigatório para OWNER/ADMIN ainda não é exigido na cadeia de autorização (MFA não implementado).
- Negações de acesso ainda não são registradas em log estruturado (logs pendentes).

## 2026-09-11 — Identidade visual, e-mail transacional e backups

| Item | Resultado |
|---|---|
| Logo e paleta | `docs/brand/VELDOCS-logo.pdf` (fonte) → `public/brand/veldocs-logo-light.png`, `veldocs-logo-dark.png`, `veldocs-icon.png`; `src/app/favicon.ico`, `icon.png` (192), `apple-icon.png` (180); tokens `--brand-primary`, `--brand-dark`, `--brand-cyan` |
| Página inicial | logo oficial clara/escura conforme o tema, `themeColor` com as superfícies da marca |
| E-mail transacional | Resend escolhido (DEC-018); aguardando domínio verificado e chave de API |
| Backups | decisão adiada pelo usuário |
| Chaves `APP_ENCRYPTION_KEY`/`APP_HMAC_KEY` | cópia fora do Railway continua pendente com o usuário (valores nunca exibidos nesta sessão) |

Observação: o PDF da marca contém uma única imagem raster (1536 × 1024); os arquivos do projeto são recortes dela. Substituir por vetores (SVG) quando disponíveis.

## 2026-09-11 — FASE 2 (parte 3): segundo fator obrigatório para OWNER/ADMIN

### O que foi feito

| Item | Evidência |
|---|---|
| TOTP próprio | `src/infrastructure/security/totp.ts` (RFC 6238; devolve o passo aceito para impedir replay) |
| Casos de uso | `src/application/auth/mfa.ts`: iniciar cadastro, confirmar (entrega 10 códigos de recuperação) e verificar (app ou código de recuperação) |
| Banco | migração `mfa_totp_recovery_codes`: `user_totp_credentials` (segredo cifrado, confirmação, último passo) e `user_recovery_codes` (HMAC-SHA256, uso único), com CHECKs de formato |
| Autorização | perfis OWNER/ADMIN recebem `mfa_enrollment_required` sem cadastro e `mfa_required` sem confirmação na sessão |
| Rotas | `POST /api/auth/mfa/enroll`, `/enroll/confirm` e `/verify`; `GET /api/auth/session` passa a devolver `mfa` |
| Limite | 10 tentativas por pessoa a cada 15 minutos |

### Testes (local)

| Suíte | Resultado |
|---|---|
| `pnpm test` | ✅ 18 arquivos, 232 testes (novos: vetores oficiais da RFC 6238, replay, política de MFA, códigos de recuperação, casos de uso) |
| `pnpm test:integration` | ✅ 6 arquivos, 74 testes (novos: cadastro e confirmação, segredo cifrado no banco, replay, código de recuperação de uso único, MFA por sessão, limite de tentativas) |
| `pnpm test:e2e` | ✅ 15 testes (novos: OWNER bloqueado até configurar o app autenticador; código inválido e reuso recusados) |

Verificação em produção: após o merge e o deploy.

### Observações

- Erros encontrados nos próprios testes durante o desenvolvimento (corrigidos): códigos de recuperação falsos com caracteres fora do alfabeto base32; testes que reapresentavam o mesmo código do app (o sistema recusou corretamente); URI do app autenticador comparada sem decodificar; lista de tabelas dependendo da ordenação do banco.
- Pendente: desativar/recadastrar o segundo fator e gerar novos códigos de recuperação (exigirá reautenticação por senha).

---

# 26. BACKLOG (adiado pelo usuário)

Itens que dependem de decisão, conta ou credencial do usuário e foram **adiados por escolha dele em 2026-09-11**. Enquanto estiverem aqui, não devem ser cobrados a cada etapa.

## Quando retomar

**Antes da FASE 7 (MVP oficial e testes)** — e obrigatoriamente antes de qualquer cliente real usar o sistema. Nesse momento, apresentar esta lista ao usuário.

## Itens

| Item | O que falta | O que fica bloqueado |
|---|---|---|
| **E-mail transacional (Resend — DEC-018)** | domínio de envio verificado no Resend e chave de API nas variáveis do Railway | verificação de e-mail (obrigatória no MASTER SPEC), recuperação de senha, link mágico, convites e alertas por e-mail |
| **Login com Google** | credenciais OAuth (Google Cloud Console) e URL de callback | entrar com Google |
| **Cópia das chaves e backup do banco** | guardar `APP_ENCRYPTION_KEY` e `APP_HMAC_KEY` em cofre de senhas; definir backup do PostgreSQL (plano Pro no Railway ou dump para storage externo) | recuperação em caso de perda das chaves (CPFs cifrados e login por CPF) e recuperação de desastre |

## Riscos enquanto estiverem no backlog

- ⚠️ **Não há backup do banco de produção.** Perda de dados seria irreversível.
- ⚠️ **As chaves de criptografia existem apenas no Railway.** Sem cópia, CPFs cifrados ficam ilegíveis e o login por CPF para de funcionar.
- ⚠️ **Sem verificação de e-mail**, qualquer endereço pode ser usado no cadastro; e **sem recuperação de senha**, quem esquecer a senha perde o acesso.

Esses riscos são aceitáveis enquanto o sistema não tem clientes reais.

## 2026-09-11 — FASE 2 (parte 4): headers de segurança, logs e limite nas rotas

### O que foi feito

| Item | Evidência |
|---|---|
| Headers | `src/proxy.ts` + `src/infrastructure/http/security-headers.ts`: CSP com nonce por requisição e `strict-dynamic`, HSTS em HTTPS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP e `x-request-id` |
| Página dinâmica | `export const dynamic = "force-dynamic"` na página inicial: sem isso o HTML pré-gerado não teria o nonce e a CSP bloquearia os scripts do Next.js |
| Logs | `src/infrastructure/observability/logger.ts`: JSON por evento, nível por `LOG_LEVEL`, redação automática de campos sensíveis; usados nas recusas de autorização e nos bloqueios por limite |
| Limite | `enforceRequestRateLimit`: 120 req/min por IP nas rotas de negócio, com `429` e `Retry-After` |

### Testes (local)

| Suíte | Resultado |
|---|---|
| `pnpm test` | ✅ 21 arquivos, 256 testes (novos: CSP/HSTS, logger com redação, limite por IP) |
| `pnpm test:integration` | ✅ 6 arquivos, 74 testes |
| `pnpm test:e2e` | ✅ 17 testes (novos: headers nas rotas e na página; nonce diferente por requisição e presente nos scripts) |
| `pnpm build` | ✅ proxy registrado; página inicial dinâmica |

Verificação em produção: após o merge e o deploy.

### Observações

- O limite de 120 req/min é por IP. Atrás do proxy do Railway o IP vem do último valor de `X-Forwarded-For`.
- Um ajuste foi necessário no helper de limite: ele lia a configuração de ambiente para obter o logger, o que quebrava testes unitários; o logger passou a ser injetável.

---

## 2026-09-11 — FASE 3 (primeira metade): empresa, filiais e setores

### O que foi feito

| Item | Evidência |
|---|---|
| Dados da empresa | `PATCH /api/company` (`company.update`): nome, razão social e CNPJ; `CompanySummary` passou a expor `taxId` |
| CNPJ | `src/domain/company/cnpj.ts`: validação dos dois dígitos verificadores, recusa de sequências repetidas, aceita com ou sem máscara e grava somente dígitos |
| Filiais | `GET/POST /api/company/branches`, `GET/PATCH/DELETE /api/company/branches/[branchId]` (`branches.read` / `branches.manage`) |
| Setores | `GET/POST /api/company/departments`, `GET/PATCH/DELETE /api/company/departments/[departmentId]` (`departments.read` / `departments.manage`); setor da empresa inteira (sem filial) ou de uma filial da mesma empresa |
| Escopo por empresa | `src/application/access/manage-company.ts` só aceita `AuthorizedContext`; o repositório recebe sempre `context.companyId` e todo `where` o inclui |
| Exclusão | Lógica, recusada enquanto houver setores ou documentos ativos (HTTP 409 `resource_in_use`); o código da filial é liberado para reuso (DEC-021) |
| Rotas de escrita | `src/infrastructure/http/write-route.ts`: origem (CSRF) → limite por IP (30/min, mais restrito que leitura) → autorização → corpo JSON, com erros de validação por campo em `issues` |
| Auditoria | `company.updated`, `branch.created/updated/deleted`, `department.created/updated/deleted`; tentativa recusada não gera evento |

### Testes (local)

| Suíte | Resultado |
|---|---|
| `pnpm lint` / `tsc --noEmit` | ✅ sem erros |
| `pnpm test` | ✅ 23 arquivos, 281 testes (novos: CNPJ, casos de uso da gestão com repositório em memória) |
| `pnpm test:integration` | ✅ 7 arquivos, 90 testes (novos: código duplicado, reuso após exclusão, filial/setor em uso, filial de outra empresa, auditoria gravada) |
| `pnpm test:e2e` | ✅ 23 testes (novos: edição da empresa, CNPJ inválido → 400 com campo, ciclo filial+setor, isolamento entre empresas, origem obrigatória, ids inválidos → 404) |

Verificação em produção: após o merge e o deploy.

### Observações

- Os ajudantes de sessão do E2E (`signup`, `enrollMfa`) foram extraídos para `tests/e2e/support/session.ts` e são usados pelas duas specs.
- A segunda metade da FASE 3 (catálogo de módulos, preços, dependências, kits, trial de 14 dias e Builder) continua bloqueada por decisões comerciais do usuário.
- Gestão de membros, convites e atribuição de perfis ainda não foi feita: é o próximo passo dentro desta metade.

---

## 2026-09-11 — FASE 3 (segunda metade, parte 1): catálogo de módulos, entitlements e estados do trial

### O que foi feito

| Item | Evidência |
|---|---|
| Catálogo | `src/domain/billing/module-catalog.ts`: os 17 módulos da seção 2.3 (Core obrigatório e 16 contratáveis), com nome, descrição, benefício e resolução de dependências |
| Banco | migração `20260911033935_commercial_catalog_and_subscriptions`: `modules`, `module_dependencies`, `module_prices`, `company_modules` e `subscriptions`; povoa o catálogo e dá o Core às empresas já existentes (DEC-023) |
| Estados do trial | `src/domain/billing/subscription-status.ts`: 14 dias, "terminando" nos últimos 3, estado canônico gravado e estados do tempo derivados na leitura (DEC-022), transições permitidas e reativação |
| Entitlements | `src/infrastructure/access/database-entitlements.ts` substitui o provisório "só Core" na cadeia de autorização: Core sempre liberado; módulo pago exige contratação ativa e assinatura que conceda acesso |
| Cadastro | empresa nova nasce com o Core em `company_modules` e sem assinatura — o trial começa no Builder (seção 2.4) |
| Testes de integração | a limpeza entre testes passou a preservar as tabelas povoadas pela migração; sem isso, qualquer cadastro falharia pela FK do Core |

### Testes (local)

| Suíte | Resultado |
|---|---|
| `pnpm lint` / `tsc --noEmit` | ✅ sem erros |
| `pnpm test` | ✅ 25 arquivos, 305 testes (novos: catálogo, estados e transições do trial) |
| `pnpm test:integration` | ✅ 8 arquivos, 104 testes (novos: banco × catálogo, entitlement por estado da assinatura, isolamento entre empresas, FK do catálogo, Core no cadastro) |
| `pnpm test:e2e` | ✅ 23 testes |
| `pnpm build` | ✅ |

Verificação em produção: após o merge e o deploy (a migração roda no pre-deploy).

### Observações

- Nenhuma permissão pertence ainda a módulo pago: as capacidades desses módulos são de fases futuras. O entitlement já é verificado e passa a bloquear automaticamente quando elas existirem.
- `module_prices` está pronta e vazia: os preços dependem de decisão comercial (seção 2.3).
- Faltam nesta metade: Builder, preço em tempo real e início do trial.

---

## 2026-09-11 — Docker local e incidente de deploy

### O que foi feito

| Item | Evidência |
|---|---|
| Docker | `docker/Dockerfile` (alvos `dev` e `runner`) e serviço `app` no `docker-compose.yml`; `pnpm docker:dev` usa `docker compose watch` |
| Verificação | executada **de dentro do container**: health 200 (banco e migrações `up`), cadastro 201 com o Core gravado no banco, rota criada no host servida pelo container em ~4 s e 404 depois de removida |

### Incidente

- O PR #10 colocou o `Dockerfile` na raiz. O Railway detecta esse arquivo e passou a construir por ele em vez do nixpacks: o deploy `5b7f79f2` falhou no build. Produção não caiu — seguiu na versão anterior.
- Correção no PR #11: arquivo movido para `docker/Dockerfile`. Deploy `a00dbfa3` SUCCESS; health, rotas da FASE 3 e página verificadas em produção.

### Observações

- As primeiras verificações do Docker por `localhost:3000` foram atendidas por um `next dev` órfão no host, que escutava também em IPv6, e não pelo container. Foram refeitas de dentro do container, depois de encerrar o processo órfão.
- No Windows, encerrar um comando em segundo plano pode deixar processos filhos vivos (`pnpm` → `next`, `docker compose watch`). Conferir portas e processos antes de dar uma verificação por concluída.

---

## 2026-09-11 — FASE 3: política de bloqueio sem assinatura válida

### Decisões do usuário

| Pergunta | Resposta |
|---|---|
| Carência antes de bloquear inadimplente? | Não: `PAST_DUE` bloqueia na hora |
| O trial vencido bloqueia também o Core? | Sim, bloqueia tudo; os dados ficam guardados até a empresa assinar |

### O que mudou

| Item | Evidência |
|---|---|
| Porta | `EntitlementService.checkModule` devolve `enabled`, `module_not_enabled` ou `subscription_inactive` (antes: sim/não) |
| Autorização | nova recusa `subscription_inactive` — HTTP 403 com mensagem orientando a assinar |
| Regra | `src/infrastructure/access/database-entitlements.ts`: assinatura inválida bloqueia tudo; empresa sem assinatura (antes do Builder) segue usando o Core; módulo pago exige assinatura válida e contratação ativa |
| Fora do bloqueio | login, sessão, logout, segundo fator e troca de empresa não passam pelo autorizador |

### Testes (local)

| Suíte | Resultado |
|---|---|
| `pnpm lint` / `tsc --noEmit` | ✅ sem erros |
| `pnpm test` | ✅ 25 arquivos, 308 testes (novos: recusa `subscription_inactive` no autorizador e na resposta HTTP; todo estado com regra explícita) |
| `pnpm test:integration` | ✅ 8 arquivos, 106 testes (novos: trial vencido e `PAST_DUE`/`CANCELED`/`SUSPENDED` bloqueiam o Core; empresa sem assinatura usa o Core; pela cadeia de autorização real: bloqueio, dados intactos e liberação ao assinar) |
| `pnpm test:e2e` | ✅ 23 testes |
| `pnpm build` | ✅ |

Verificação em produção: após o merge e o deploy. Nenhuma empresa tem assinatura hoje — o trial nasce no Builder —, então a mudança não bloqueia ninguém.

### Observações

- Toda requisição autorizada passa a consultar a assinatura da empresa (busca por chave única, indexada).
- A spec (2.3) lista 16 módulos contratáveis além do Core; o README listava 15 e omitia "Score documental" — corrigido.

---

## 2026-09-11 — FASE 3: preços dos módulos e tabela de kits

### Preços (implementado)

Tabela enviada pelo usuário, gravada pela migração `20260911044509_module_prices_initial` com vigência a partir de 11/09/2026 00:00 (Brasília):

| # | Módulo | Preço mensal |
|---|---|---|
| 1 | Core (obrigatório) | R$ 49,90 |
| 2 | Controle de vencimentos | R$ 19,90 |
| 3 | Funcionários | R$ 29,90 |
| 4 | Fornecedores | R$ 29,90 |
| 5 | Contratos | R$ 39,90 |
| 6 | Solicitações | R$ 29,90 |
| 7 | Aprovações | R$ 19,90 |
| 8 | Automação | R$ 39,90 |
| 9 | Análise inteligente de documentos | R$ 59,90 |
| 10 | Assistente IA | R$ 39,90 |
| 11 | WhatsApp | R$ 59,90 |
| 12 | Portal de terceiros | R$ 39,90 |
| 13 | Relatórios avançados | R$ 29,90 |
| 14 | OCR / extração de dados | R$ 39,90 |
| 15 | Score documental | R$ 29,90 |
| 16 | Radar de risco | R$ 39,90 |
| 17 | Modo auditoria | R$ 39,90 |

| Item | Evidência |
|---|---|
| Integridade | CHECKs: preço não negativo, vigência em ordem, moeda com 3 letras |
| Preço vigente | `src/infrastructure/database/prisma-billing-catalog-repository.ts`: mensal, já iniciado e não encerrado; o de início mais recente vence |
| Orçamento | `src/domain/billing/pricing.ts` + `src/application/billing/catalog-queries.ts`: Core sempre incluído, dependências resolvidas, módulo sem preço e chave desconhecida explícitos |
| Testes de integração | a limpeza entre testes passou a preservar também `module_prices` |

Orçamentos conferidos com os preços reais: só o Core R$ 49,90; Core + Vencimentos + WhatsApp R$ 129,70; todos os 17 módulos R$ 638,30.

### Kits (recebidos, não implementados)

| Kit | Indicado para | Módulos incluídos | Preço | Soma avulsa | Economia |
|---|---|---|---|---|---|
| Essencial | Empresas que querem começar | Core + Controle de vencimentos + "Alertas" | R$ 69,90 | R$ 69,80 | ⚠️ **−R$ 0,10** |
| Gestão | Empresas que controlam pessoas e fornecedores | Core + Vencimentos + Funcionários + Fornecedores + Solicitações | R$ 129,90 | R$ 159,50 | R$ 29,60 (18,6%) |
| Inteligência | Empresas que querem IA e análise | Core + Análise inteligente + OCR + Assistente IA + Score documental + Radar de risco | R$ 199,90 | R$ 259,40 | R$ 59,50 (22,9%) |
| Comunicação | Empresas que precisam interagir com terceiros | Core + WhatsApp + Portal de terceiros + Solicitações | R$ 119,90 | R$ 179,60 | R$ 59,70 (33,2%) |
| Controle Avançado | Empresas com processos mais estruturados | Core + Contratos + Aprovações + Automação + Relatórios avançados + Modo auditoria | R$ 169,90 | R$ 219,40 | R$ 49,50 (22,6%) |
| Complete | Empresas que querem praticamente tudo | Core + todos os 16 módulos | R$ 399,90 | R$ 638,30 | R$ 238,40 (37,3%) |

O **Essencial** sairia R$ 0,10 mais caro que os mesmos módulos avulsos, e "Alertas" não é módulo do catálogo. Os kits só serão modelados depois desse ajuste e da regra de combinação com módulos avulsos.

### Testes (local)

| Suíte | Resultado |
|---|---|
| `pnpm lint` / `tsc --noEmit` | ✅ sem erros |
| `pnpm test` | ✅ 26 arquivos, 313 testes (novos: orçamento mensal) |
| `pnpm test:integration` | ✅ 9 arquivos, 115 testes (novos: preços da migração × tabela do usuário, vigência futura e encerrada, CHECKs, orçamentos com preços reais) |
| `pnpm test:e2e` | ✅ 23 testes |
| `pnpm build` | ✅ |

Verificação em produção: após o merge e o deploy (a migração roda no pre-deploy).

---

## 2026-09-11 — FASE 3: kits e retenção de dados

### Decisões do usuário

| Pergunta | Resposta |
|---|---|
| Kit Essencial (R$ 0,10 acima do avulso) | Mantido como está |
| Kit + módulos avulsos, com sugestão do kit mais barato | Pode |
| Assinatura cancelada | Bloqueia tudo; dados e login guardados por 1 ano (obrigação legal) |
| Assinatura suspensa | Bloqueada; dados guardados por 2 meses, depois a conta pode ser apagada |

### O que foi feito

| Item | Evidência |
|---|---|
| Kits | tabelas `kits`, `kit_modules` e `kit_prices` povoadas pela migração `20260911051529_kits_and_subscription_retention`; `src/domain/billing/kit-catalog.ts` |
| Orçamento com kit | `quoteKit`: preço do kit + só os módulos fora dele |
| Sugestão | `suggestKit`: o kit que barateia a mesma seleção, mesmo com módulos a mais; sem economia real, nenhuma |
| Retenção | `dataRetentionUntil` / `isRetentionExpired` e coluna `subscriptions.suspended_at`; nada é apagado automaticamente |

Sugestões conferidas com os preços reais: módulos do Gestão avulsos (R$ 159,50) → Gestão R$ 129,90; Inteligência sem o Radar (R$ 219,50) → kit completo R$ 199,90; todos os módulos (R$ 638,30) → Complete R$ 399,90; Core + Vencimentos (R$ 69,80) → nenhuma sugestão.

### Testes (local)

| Suíte | Resultado |
|---|---|
| `pnpm lint` / `tsc --noEmit` | ✅ sem erros |
| `pnpm test` | ✅ 27 arquivos, 332 testes (novos: catálogo de kits, kit + avulsos, sugestão, retenção) |
| `pnpm test:integration` | ✅ 9 arquivos, 123 testes (novos: kits banco × domínio, preços de kit, CHECKs, orçamentos e sugestões com preços reais) |
| `pnpm test:e2e` | ✅ 23 testes |
| `pnpm build` | ✅ |

Verificação em produção: após o merge e o deploy. A migração só acrescenta tabelas, dados de catálogo e uma coluna opcional; nenhuma empresa é afetada.

### Observações

- A exclusão de contas após a retenção não foi implementada: é irreversível e depende de autorização explícita.
- O prazo de 1 ano após o cancelamento foi citado como exemplo e deve ser confirmado com o jurídico.
- Uma execução local da integração falhou em `tests/integration/auth/mfa.test.ts` ("falha ao confirmar"), num teste que esta mudança não toca (diff contra `main` vazio nessa área); a execução seguinte passou 123/123. Causa provável: o teste confirma com o código do passo TOTP anterior (`-1`) e falha se o passo de 30 s virar entre gerar o código e o servidor verificar — mais provável com a máquina sob carga. Correção sugerida, ainda não feita: fixar o relógio nesse teste.

---

## 2026-09-11 — FASE 3: API do Builder e início do trial

### O que foi feito

| Item | Evidência |
|---|---|
| Catálogo | `GET /api/builder/catalog`: 17 módulos e 6 kits com preços vigentes, moeda e duração do trial |
| Preço em tempo real | `GET /api/builder/quote`: total avulso com sugestão de kit, ou kit + módulos fora dele |
| Início do trial | `POST /api/builder/trial`: valida módulos, kit, disponibilidade e preço; cria a assinatura `TRIALING` de 14 dias e ativa os módulos numa transação; uma única vez por empresa |
| Situação | `GET /api/subscription`: estado efetivo, acesso, dias restantes, kit, módulos, valor após o trial e retenção |
| Permissões | `billing.read` e `billing.manage` só para OWNER e ADMIN; valem com a assinatura bloqueada (DEC-026) |
| Banco | migração `20260911054436_builder_trial_and_billing_permissions`: `subscriptions.kit_key` e permissões concedidas aos OWNER/ADMIN existentes |
| Auditoria | `subscription.trial_started` com kit, módulos e valor mensal |
| Documentação | `docs/api/builder.md` |

### Testes (local)

| Suíte | Resultado |
|---|---|
| `pnpm lint` / `tsc --noEmit` | ✅ sem erros |
| `pnpm test` | ✅ 28 arquivos, 346 testes (novos: situação e início do trial, validações, corrida, exceção das permissões de assinatura) |
| `pnpm test:integration` | ✅ 10 arquivos, 127 testes (novos: permissões por perfil, Gestão + Contratos com R$ 169,80, escolha inválida sem efeito, empresa bloqueada vendo a assinatura) |
| `pnpm test:e2e` | ✅ 26 testes (novos: fluxo completo do Builder, escolha inválida, sessão e origem) |
| `pnpm build` | ✅ |

Verificação em produção: após o merge e o deploy. A migração só acrescenta uma coluna opcional e permissões; nenhuma empresa é bloqueada.

### Observações

- A tela do Builder não existe: o frontend ainda não tem nem as telas de login.
- Trocar kit ou módulos durante o trial ainda não é possível (seção 2.8).

---

## 2026-09-11 — FASE 3: membros, perfis e convites

### O que foi feito

| Item | Evidência |
|---|---|
| Convites | `POST/GET /api/company/invitations`, `DELETE /api/company/invitations/[id]`; link `/convite/{token}` exibido uma vez, só o SHA-256 no banco, 7 dias, um uso, novo convite revoga o anterior (DEC-028) |
| Link do convite | `GET /api/invitations/[token]` (prévia com e-mail mascarado), `POST …/accept` (com sessão, mesmo e-mail) e `POST …/signup` (conta nova já como membro, sem criar empresa) |
| Gestão | `PUT /api/company/members/[userId]/roles`, `PUT …/status`, `DELETE /api/company/members/[userId]` |
| Perfis | `GET /api/company/roles` com permissões e membros ativos |
| Proteções | ninguém altera o próprio vínculo; só Proprietário mexe em Proprietário; nunca sem Proprietário ativo, em transação serializável |
| Remoção | status `REMOVED`: sem acesso, fora das listagens, histórico preservado, pode voltar por convite (DEC-027) |
| Banco | migração `20260911061303_members_invitations` |
| Documentação | `docs/api/membros-convites.md` |

### Testes (local)

| Suíte | Resultado |
|---|---|
| `pnpm lint` / `tsc --noEmit` | ✅ sem erros |
| `pnpm test` | ✅ 30 arquivos, 357 testes (novos: regras de perfis entre membros, validade e máscara do convite) |
| `pnpm test:integration` | ✅ 11 arquivos, 135 testes (novos: convite e cadastro pelo link, aceite com sessão e outro e-mail, revogação e vencimento, proteções, remoção e retorno, último Proprietário) |
| `pnpm test:e2e` | ✅ 29 testes (novos: fluxo completo por HTTP com duas sessões, convite revogado, sessão e origem) |
| `pnpm build` | ✅ |

Verificação em produção: após o merge e o deploy. A migração só acrescenta um valor ao enum e uma tabela.

### Observações

- A tela `/convite/{token}` entra junto com as telas de acesso e do Builder, logo em seguida; até lá o link funciona pela API.
- Perfis personalizados (`roles.manage`) continuam pendentes.

---

## 2026-09-11 — FASE 3: telas de acesso, segundo fator, Builder e convite

### O que foi feito

| Tela | Rota | O que faz |
|---|---|---|
| Cadastro | `/cadastro` | cria conta e empresa e segue para o segundo fator |
| Login | `/entrar` | e-mail ou CPF e senha; volta ao destino pedido, só caminhos internos |
| Segundo fator | `/seguranca` | configura o app autenticador (chave, código, códigos de recuperação) ou verifica com código do app ou de recuperação |
| Builder | `/builder` | kits e módulos com preços, total em tempo real calculado no servidor, sugestão de kit e início do trial; depois, o resumo da assinatura |
| Convite | `/convite/[token]` | aceite com a conta atual ou cadastro já como membro |
| Início | `/inicio` | encaminha para o próximo passo |
| Página inicial | `/` | chamadas para criar conta e entrar |

Tailwind CSS 4.3.3 com os tokens da marca em `@theme`; páginas de servidor com dados carregados sob a mesma autorização da API (DEC-029). Documentação em `docs/frontend/telas.md`.

### Testes (local)

| Suíte | Resultado |
|---|---|
| `pnpm lint` / `tsc --noEmit` | ✅ sem erros |
| `pnpm test` | ✅ 31 arquivos, 372 testes (novos: destino seguro depois do login, mensagens da API, formatação de dinheiro e datas) |
| `pnpm test:integration` | ✅ 11 arquivos, 135 testes |
| `pnpm test:e2e` | ✅ 34 testes (novos, no navegador: cadastro → segundo fator → kit Gestão + Contratos → trial; sugestão de kit; login com código de recuperação; convite pela tela; telas protegidas) |
| `pnpm build` | ✅ |

Verificação em produção: após o merge e o deploy.

### Observações

- Dois ajustes durante a implementação: o carregamento do Builder saiu de um `useEffect` para o servidor (regra `react-hooks/set-state-in-effect` do React 19), e uma expectativa do E2E supunha a barra codificada no redirecionamento (`next=%2Fbuilder`), que o Next.js não codifica.
- Troca de kit e módulos durante o trial: próxima etapa.

---

## 2026-09-11 — FASE 3: troca de kit e módulos durante o trial

### O que foi feito

| Item | Evidência |
|---|---|
| API | `PUT /api/subscription/modules` (`billing.manage`) com `{ kitKey, modules }`: mesma validação do início do trial; só com o teste grátis vigente (`409 trial_not_started` / `409 not_in_trial`) |
| Banco | numa transação que confere o trial de novo: grava o novo kit, ativa os módulos novos e desativa os que saíram (`INACTIVE` com data, sem apagar); datas do trial inalteradas; sem migração |
| Entitlements | módulo desativado deixa de valer na hora (`module_not_enabled`) |
| Tela | "Alterar módulos" no resumo do Builder: kits e módulos marcados com a escolha atual, total em tempo real, "Salvar alterações" e "Cancelar" |
| Situação | `canChangeModules` no resumo da assinatura |
| Auditoria | `subscription.modules_changed` com kit anterior e novo, módulos ativados e desativados e o novo valor — só quando algo muda |
| Decisão | DEC-030 |
| Documentação | `docs/api/builder.md`, `docs/frontend/telas.md` |

### Testes (local)

| Suíte | Resultado |
|---|---|
| `pnpm lint` / `tsc --noEmit` | ✅ sem erros |
| `pnpm test` | ✅ 31 arquivos, 381 testes (novos: quando a troca é permitida; troca com e sem kit, sem mudança e sem auditoria, antes do trial, trial vencido, assinatura ativa e cancelada, escolha inválida, trial vencendo durante a gravação) |
| `pnpm test:integration` | ✅ 12 arquivos, 140 testes (novos: Gestão + Contratos → Comunicação + Vencimentos com R$ 139,80, nada apagado, datas mantidas, auditoria e entitlements; módulo reativado na mesma linha; fora do trial; escolha inválida; conferência na transação) |
| `pnpm test:e2e` | ✅ 37 testes (novos: troca pela API com as recusas; troca pela tela; cancelar sem alterar) |
| `pnpm build` | ✅ |

Verificação em produção: após o merge e o deploy. Sem migração.

### Observações

- Troca de módulos em assinatura paga fica para a FASE 16, junto com o pagamento (DEC-030).
- A sequência pedida — membros e convites, telas com o Builder e troca de módulos durante o trial — está concluída. A FASE 3 segue 🟡 PARCIAL por perfis personalizados e pela exclusão de contas após a retenção.

---

## 2026-09-11 — FASE 4: núcleo documental (metadados, categorias, etiquetas e busca)

### O que foi feito

| Item | Evidência |
|---|---|
| Documentos | `GET/POST /api/documents` e `GET/PATCH/DELETE /api/documents/[documentId]`: título, descrição, categoria, filial, setor, responsável, emissão, validade e etiquetas |
| Categorias | `GET/POST /api/categories` e `GET/PATCH/DELETE /api/categories/[categoryId]`: árvore de até 3 níveis com caminho completo, nome único entre irmãs, sem ciclo (DEC-032) |
| Etiquetas | tabelas `tags` e `document_tags`; a etiqueta é da empresa e não duplica por acento ou maiúscula; `GET /api/tags` com a contagem de documentos vivos |
| Busca | `q` sem depender de acento em título, descrição e etiquetas, via `documents.search_text` (DEC-031) |
| Filtros | categoria (incluindo subcategorias), etiqueta, responsável, filial, setor, ordenação (`recent`/`title`/`created`) e paginação |
| Regras | responsável precisa ser membro ativo (reconferido só quando muda); setor precisa combinar com a filial; validade nunca antes da emissão; datas de calendário sem fuso |
| Exclusão | lógica, em documentos e categorias: some das listagens, nada é apagado (MASTER SPEC 17.2) |
| Banco | migração `20260911173626_documents_categories_tags`: coluna `search_text`, tabelas `tags` e `document_tags` e CHECKs de título, datas, nome e etiqueta |
| Auditoria | `document.created` (referências e contagens), `document.updated` (campos alterados), `document.deleted`, `category.created/updated/deleted` — sem título nem conteúdo |
| Documentação | `docs/api/documentos.md`, modelo de dados, DEC-031 e DEC-032 |

### Testes (local)

| Suíte | Resultado |
|---|---|
| `pnpm lint` / `tsc --noEmit` | ✅ sem erros |
| `pnpm test` | ✅ 33 arquivos, 414 testes (novos: busca sem acento, etiquetas normalizadas, árvore de categorias, datas de calendário, validações e auditoria dos casos de uso) |
| `pnpm test:integration` | ✅ 13 arquivos, 161 testes (novos: vínculos de outra empresa recusados campo a campo, setor × filial, responsável suspenso, busca e filtros, paginação, exclusão lógica, três níveis de categoria, ciclo, nome repetido, etiquetas reaproveitadas) |
| `pnpm test:e2e` | ✅ 42 testes (novos: ciclo completo pela API, validações, isolamento entre empresas, sessão e origem, ids inválidos) |
| `pnpm build` | ✅ |

Verificação em produção: após o merge e o deploy. A migração só acrescenta uma coluna com valor padrão, duas tabelas e CHECKs; nenhuma empresa é afetada.

### Observações

- O arquivo do documento (upload, download e antivírus) é a FASE 5 e vai precisar de um serviço externo de armazenamento — peço autorização antes.
- Situação automática de vencimento, alertas e dashboard são a etapa seguinte da FASE 4.
- A busca hoje varre os documentos da empresa; o índice de texto entra quando o volume justificar (DEC-031).

---

## 2026-09-11 — FASE 4: telas de documentos e categorias

### O que foi feito

| Item | Evidência |
|---|---|
| Tela de documentos | `/documentos`: lista com busca, filtros (categoria, etiqueta, responsável), ordenação, paginação e resumo; formulário para criar e editar; exclusão com confirmação na própria linha |
| Tela de categorias | `/categorias`: árvore com recuo por nível, descrição e contagem de documentos; formulário com categoria superior; recusa de exclusão explicada |
| Navegação | cabeçalho comum `AppShell` (marca, empresa, Documentos/Categorias/Assinatura, pessoa e Sair), com a seção atual em `aria-current`; o Builder passou a usá-lo |
| Paleta | azul da marca nos botões e na seção ativa; categoria do documento em azul escuro no tema claro e ciano no escuro, como manda a regra de acessibilidade da identidade visual |
| Permissões na tela | botões e campos aparecem conforme `context.permissions` (sem `documents.create` não há "Novo documento"; sem `members.read` não há campo Responsável) — a API continua conferindo tudo |
| Datas | `formatCalendarDate` exibe a data em UTC: `2026-02-01` aparece como 01/02/2026, e não 31/01 |
| Verificação visual | capturas das telas nos temas claro e escuro conferidas durante a implementação |

### Testes (local)

| Suíte | Resultado |
|---|---|
| `pnpm lint` / `tsc --noEmit` | ✅ sem erros |
| `pnpm test` | ✅ 34 arquivos, 421 testes (novos: etiquetas do formulário, consulta da listagem, resumo da página e datas de calendário) |
| `pnpm test:integration` | ✅ 13 arquivos, 161 testes |
| `pnpm test:e2e` | ✅ 45 testes (novos, no navegador: categoria e subcategoria, documento com etiquetas e validade, busca sem acento, edição, exclusão, recusas explicadas e navegação entre as seções) |
| `pnpm build` | ✅ |

Verificação em produção: após o merge e o deploy. Sem migração.

### Observações

- Dois ajustes durante a implementação: `api-client` passou a aceitar `PATCH`, e os testes precisaram escopar os rótulos repetidos entre filtro e formulário ("Categoria", "Responsável").
- Próxima etapa: situação automática de vencimento, alertas e dashboard.

---

## 2026-09-11 — FASE 4: Controle de vencimentos (primeiro módulo pago)

### O que foi feito

| Item | Evidência |
|---|---|
| Situação automática | Em dia, Vence em breve (30 dias), Vencido e Sem validade, derivados da validade e do dia em Brasília (`src/domain/documents/expiration.ts`) |
| Painel | `GET /api/expirations`: contadores por situação e documentos que precisam de atenção, do mais urgente; janela e limite ajustáveis |
| Filtro e ordenação | `status` e `sort=expiration` em `GET /api/documents`, com a situação de cada documento — só com o módulo |
| Renovação | `POST /api/documents/[documentId]/renew`: novas datas no mesmo documento, validade precisa avançar; auditoria `document.renewed` com as datas anteriores |
| Permissões | `expirations.read` e `expirations.manage`, do módulo `vencimentos`; migração `expiration_permissions` concede aos perfis das empresas existentes (DEC-033) |
| Telas | `/vencimentos` com contadores, "Precisam de atenção" e renovação; situação e filtro em `/documentos`; seção no menu só com o módulo; sem o módulo, a tela apresenta o módulo e leva ao Builder |
| Ajuste de texto | a lista de documentos mostra "Validade: dd/mm/aaaa" — "Vence em" ficava errado para documento já vencido |
| E2E | tempo de espera do `expect` passou de 5 s para 15 s: com a suíte inteira em paralelo, navegações encadeadas renderizadas no servidor estouravam os 5 s sem defeito (o teste afetado passava isolado em 11 s) |

### Testes (local)

| Suíte | Resultado |
|---|---|
| `pnpm lint` / `tsc --noEmit` | ✅ sem erros |
| `pnpm test` | ✅ 36 arquivos, 445 testes (novos: situação nas bordas da janela, hoje em Brasília, contas com datas, painel, regras da renovação, permissões por módulo) |
| `pnpm test:integration` | ✅ 14 arquivos, 173 testes (novos: situação e filtro com datas reais, ordenação por vencimento, painel com janela ajustável, exclusão fora das contas, isolamento, renovação e auditoria, GESTOR bloqueado sem o módulo e liberado com ele) |
| `pnpm test:e2e` | ✅ 50 testes (novos: 403 sem o módulo e painel com ele, filtro por situação, renovação e recusa para trás, sessão e origem; no navegador, painel com renovação e a apresentação do módulo para quem não o tem) |
| `pnpm build` | ✅ |

Verificação em produção: após o merge e o deploy. A migração só insere duas permissões e as concede aos perfis de sistema.

### Observações

- Conferência visual do painel e da lista nos temas claro e escuro durante a implementação.
- Aviso ativo de vencimento depende de canal: e-mail transacional (backlog) ou WhatsApp (FASE 15).

---

## 2026-09-11 — FASE 4: painel da empresa e nova entrada

### O que foi feito

| Item | Evidência |
|---|---|
| API | `GET /api/dashboard` (`documents.read`): cadastro documental, documentos por categoria, vencimentos com o módulo e atividade recente com `audit.read` |
| Tela | `/painel`: saudação, indicadores do cadastro (total, novos, sem responsável, sem validade, sem categoria), bloco de vencimentos, gráfico de documentos por categoria e atividade recente |
| Navegação | "Painel" é a primeira seção do menu, e a logo leva a ele |
| Entrada | `/inicio` decide: segundo fator pendente → `/seguranca`; empresa sem módulos e pessoa que pode escolher → `/builder`; senão → `/painel`. Login, segundo fator, cadastro e convite passam por ela (DEC-034) |
| Lista filtrada pela URL | `/documentos?status=…` e `/documentos?categoryId=…` abrem a lista já filtrada; a página confere os valores |
| Sugestão do módulo | sem o Controle de vencimentos e com documentos com validade, o painel sugere o módulo no lugar do bloco de vencimentos |
| Gráfico | barras de uma série na cor principal (validada nos dois temas), valor na ponta, "Outras categorias" além das 6 maiores |
| Documentação | `docs/api/painel.md`, telas e DEC-034 |

### Testes (local)

| Suíte | Resultado |
|---|---|
| `pnpm lint` / `tsc --noEmit` | ✅ sem erros |
| `pnpm test` | ✅ 38 arquivos, 464 testes (novos: partes do painel por permissão e módulo, janela de 30 dias, ações da atividade, frases e tempo decorrido) |
| `pnpm test:integration` | ✅ 15 arquivos, 179 testes (novos: cadastro incompleto e excluídos fora das contas, agrupamento com "outras", atividade com nomes e sem eventos de acesso, id de auditoria inválido, isolamento) |
| `pnpm test:e2e` | ✅ 54 testes (novos: painel pela API; entrada no Builder e depois no painel; números que abrem a lista filtrada; sugestão do módulo; colaborador convidado começa pelo painel) |
| `pnpm build` | ✅ |

Verificação em produção: após o merge e o deploy. Sem migração.

---

## 2026-09-11 — FASE 5: storage privado e arquivos dos documentos

### O que foi feito

| Item | Evidência |
|---|---|
| Storage | Railway Storage Buckets em produção (escolha do usuário: tudo num lugar só); MinIO fixado no docker-compose e no CI (DEC-035) |
| Envio | `POST /api/documents/[id]/files` emite formulário assinado (chave, tipo e tamanho na política); o navegador envia direto ao bucket; `POST …/files/[fileId]/complete` confere tamanho e assinatura do conteúdo e libera ou recusa |
| Download | `GET …/files/[fileId]/download`: autorização e `302` para URL assinada de 5 minutos, auditado |
| Remoção | `DELETE …/files/[fileId]`: tira do documento e mantém o objeto (o bucket não tem versionamento) |
| Política | PDF, JPEG, PNG e WebP; extensão × tipo; 25 MB; nome higienizado; chave só com ids e prefixo da empresa |
| Banco | migração `document_files` com CHECKs de chave × ids da linha, tipo, tamanho e coerência de situação |
| Segurança | CSP libera só a origem do bucket; variáveis de storage validadas (https fora de development, senha local recusada) |
| Tela | seção "Arquivos" no formulário do documento: anexar, conferir, baixar e remover |
| Documentação | `docs/api/arquivos.md`, modelo de dados, telas, DEC-035 |

### Testes (local)

| Suíte | Resultado |
|---|---|
| `pnpm lint` / `tsc --noEmit` | ✅ sem erros |
| `pnpm test` | ✅ 41 arquivos, 501 testes (novos: allowlist, magic bytes, nome higienizado, chave do objeto, casos de uso do envio com storage falso, configuração e CSP do storage) |
| `pnpm test:integration` | ✅ 16 arquivos, 186 testes (novos, contra MinIO real: envio direto e download, conteúdo disfarçado recusado e apagado, política assinada, conclusão antes do envio, remoção sem apagar, isolamento, CHECK da chave) |
| `pnpm test:e2e` | ✅ 59 testes (novos: fluxo completo pela API, recusas, sessão, origem e outra empresa; no navegador, anexar, baixar e remover, e o motivo da recusa) |
| `pnpm build` | ✅ |

### Observações

- Antivírus pendente, obrigatório antes do portal de terceiros; a ferramenta depende de decisão do usuário por ter custo mensal.
- O MinIO deixou de publicar imagens no Docker Hub: as versões fixadas vêm do quay.io.
- Limpeza de envios não concluídos e retenção de objetos removidos ficam para quando houver volume.
