# VELDOCS

**Gestão inteligente de documentos empresariais.**

O VELDOCS é um SaaS B2B criado para empresas organizarem, monitorarem e controlarem documentos, vencimentos, responsáveis, pendências e processos de renovação.

> **Zero surpresa documental.**

## Visão

O VELDOCS não deve ser apenas um local para armazenar PDFs. O objetivo é funcionar como um assistente operacional da documentação empresarial: organizar, monitorar, alertar, explicar riscos, sugerir ações e, quando autorizado, executar tarefas.

## Principais capacidades

- Gestão de documentos e versões
- Controle de vencimentos e renovações
- Alertas e notificações
- Usuários, setores, filiais e permissões
- Funcionários e fornecedores
- Contratos
- Solicitação e aprovação de documentos
- Portal externo para terceiros
- Automação por regras
- Dashboard e relatórios
- Auditoria e histórico
- Assistente com IA
- Integração com WhatsApp
- OCR e extração de dados
- Radar de risco e score documental

## Diferencial

O produto deve combinar **Dashboard + WhatsApp + Assistente/IA + Automações** sobre um mesmo motor documental seguro.

O usuário poderá, por exemplo:

> “Como está o contrato da Empresa X?”

E receber o status real do documento, respeitando empresa, usuário e permissões.

## Segurança

A segurança é parte central da arquitetura. O projeto deve considerar, desde o início:

- Multi-tenancy seguro
- RBAC e autorização server-side
- Storage privado
- Upload seguro
- Signed URLs temporárias
- MFA
- Rate limiting
- Auditoria
- LGPD
- Segurança de API
- Segurança do WhatsApp
- Segurança da IA e proteção contra prompt injection
- Backup e recuperação

As principais referências de segurança são o **OWASP ASVS 5.0** e o **OWASP API Security Top 10**.

## Arquitetura inicial

O VELDOCS começa como um **monólito modular**, com fronteiras claras entre apresentação, aplicação, domínio e infraestrutura. A arquitetura deve permitir escalar workers e componentes específicos futuramente sem introduzir microserviços prematuramente.

```text
Usuário
  ├── Dashboard
  └── WhatsApp
          │
          ▼
      API / Backend
          │
   ┌──────┼────────┐
   │      │        │
 Auth   Tenant    RBAC
   │      │        │
   └──────┼────────┘
          │
     Módulos de negócio
          │
   PostgreSQL + Storage
          │
     Redis / Workers
          │
   OCR / Antivírus / Alertas
```

## Estrutura do projeto

O arquivo [`MASTER_PROJECT_SPEC.md`](./MASTER_PROJECT_SPEC.md) é a fonte única de verdade para a implementação.

```text
VELDOCS/
├── MASTER_PROJECT_SPEC.md
├── README.md
├── docs/
│   ├── product/          # visão do produto (FASE 0)
│   ├── architecture/     # fundação técnica, camadas, ambientes
│   └── database/         # modelo de dados base
├── prisma/               # schema e migrações (PostgreSQL)
├── src/
│   ├── app/              # apresentação: rotas Next.js e route handlers
│   ├── presentation/     # apresentação: UI reutilizável
│   ├── application/      # casos de uso e portas (interfaces)
│   ├── domain/           # regras e tipos de domínio
│   └── infrastructure/   # config, banco e integrações concretas
├── tests/                # unit, integration, e2e
└── docker-compose.yml    # PostgreSQL local
```

## Regra de desenvolvimento

Antes de implementar qualquer funcionalidade:

1. Ler o `MASTER_PROJECT_SPEC.md`.
2. Auditar o código existente.
3. Comparar especificação, código, banco, testes e infraestrutura.
4. Implementar somente o que estiver pendente.
5. Executar testes.
6. Registrar evidência.
7. Atualizar o `MASTER_PROJECT_SPEC.md`.

Nenhuma funcionalidade deve ser considerada concluída apenas porque existe uma tela ou um arquivo de código.

## Status

- ✅ CONCLUÍDO
- 🟡 PARCIAL
- 🔴 NÃO IMPLEMENTADO
- ⚠️ PROBLEMA
- ⏳ BLOQUEADO
- 🔍 AUDITAR

## Roadmap resumido

**MVP**

Empresa → Usuários → Permissões → Documentos → Storage → Vencimentos → Alertas → Dashboard → Auditoria → Versionamento

**V2**

Funcionários → Fornecedores → Solicitações → Aprovações → Portal externo → Contratos → Automações → Calendário → Relatórios

**V3**

IA → OCR → Detecção inteligente → Score → Radar de risco → WhatsApp → Ações via WhatsApp → Assistente proativo → Modo auditoria

**Produto maduro**

Billing → Administração → Observabilidade → Escala → Integrações → Ecossistema

## Estado atual

FASE 0 (produto) e FASE 1 (fundação técnica) concluídas — ver status e evidências no `MASTER_PROJECT_SPEC.md`. O desenvolvimento deve seguir o roadmap detalhado do `MASTER_PROJECT_SPEC.md`.

### Primeiros passos

Requisitos: Node.js 24, pnpm 10, Docker.

```bash
cp .env.example .env
pnpm install
pnpm db:up        # PostgreSQL local (127.0.0.1:5440)
pnpm db:deploy    # aplica migrações
pnpm dev          # http://localhost:3000
```

Qualidade: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm build`.

Detalhes: [`docs/architecture/fundacao-tecnica.md`](./docs/architecture/fundacao-tecnica.md).
