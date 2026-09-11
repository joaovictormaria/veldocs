# VELDOCS

**Gestão inteligente de documentos empresariais.**  
**by VELNOX.IA**

> **Zero surpresa documental.**

## O que é

O VELDOCS é um SaaS B2B para empresas organizarem, monitorarem e controlarem documentos, vencimentos, responsáveis, pendências, contratos e processos relacionados à documentação empresarial.

O objetivo não é ser apenas um armazenamento de arquivos. O VELDOCS deve funcionar como um **assistente operacional da documentação da empresa**: organiza, monitora, alerta, explica, recomenda e, quando autorizado, executa ações.

## Modelo do produto

O VELDOCS será **modular**.

Depois do cadastro, a empresa entra no **VELDOCS Builder** e escolhe quais módulos deseja utilizar.

```text
CADASTRO
   ↓
VELDOCS BUILDER
   ↓
Escolha dos módulos
   ↓
Preço mensal em tempo real
   ↓
14 DIAS GRÁTIS
   ↓
Uso do sistema
   ↓
Assinatura / reativação
```

O **Core VELDOCS** é a base obrigatória. Os demais módulos podem ter preço próprio.

Exemplos:

- Vencimentos
- Funcionários
- Fornecedores
- Contratos
- Solicitações
- Aprovações
- Automações
- Análise inteligente
- Assistente IA
- WhatsApp
- Portal de terceiros
- Relatórios avançados
- OCR
- Score documental
- Radar de risco
- Modo auditoria

O cliente deve sempre visualizar o impacto de cada ativação/desativação no valor mensal.

## Trial

Após montar sua configuração, a empresa recebe **14 dias gratuitos** para experimentar o VELDOCS conforme as regras do trial.

O sistema deve informar claramente:

- dias restantes;
- módulos ativos;
- valor mensal após o trial;
- oportunidades de expansão;
- caminho para assinatura.

Quando o trial terminar sem assinatura válida, a conta entra em estado controlado. Os dados não devem ser apagados imediatamente.

## Expansão modular

O VELDOCS deve incentivar novos módulos por **valor contextual**, e não por pressão.

Exemplos:

> Você cadastrou muitos funcionários. O módulo Funcionários pode facilitar o controle da documentação deles.

> Você realizou várias consultas de documentos. O WhatsApp pode permitir consultas rápidas sem abrir o dashboard.

> Você enviou muitos documentos manualmente. A análise inteligente pode extrair os dados automaticamente.

O sistema pode oferecer testes limitados, recomendações, prévias e kits com desconto.

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
- Score e radar de risco
- Modo auditoria

## Canais

### Dashboard

É o centro administrativo para configuração, gestão e análise.

### WhatsApp

É a interface rápida para consultas e ações autorizadas.

Exemplo:

> “Como está o contrato da Empresa X?”

O sistema consulta os dados reais respeitando empresa, usuário, RBAC e entitlement do módulo.

### IA

É o copiloto operacional dentro do dashboard e, futuramente, também no WhatsApp.

## Segurança

A segurança é parte central da arquitetura. O projeto deve considerar desde o início:

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

Referências principais:

- OWASP ASVS 5.0
- OWASP API Security Top 10

## Arquitetura

O VELDOCS começa como **monólito modular**, evitando microserviços prematuros, mas mantendo fronteiras claras para evolução futura.

```text
                         VELDOCS
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
      Dashboard         WhatsApp             IA
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
                       API / Backend
                            │
               ┌────────────┼────────────┐
               │            │            │
              Auth       Tenant        RBAC
               │            │            │
               └────────────┼────────────┘
                            │
                      Entitlements
                            │
                     Módulos de negócio
                            │
                PostgreSQL + Storage
                            │
                       Redis / Workers
```

## Stack oficial

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend

- Node.js
- TypeScript
- Monólito modular

### Dados

- PostgreSQL
- Prisma

### Validação

- Zod

### Testes

- Vitest
- Playwright

### Infraestrutura planejada

- Redis
- Object Storage privado S3/R2 ou equivalente
- Workers
- WhatsApp Business API
- Provedor de IA via interface desacoplada
- E-mail transacional

Python não será a linguagem principal neste momento.

## Estrutura de documentação

O arquivo [`MASTER_PROJECT_SPEC.md`](./MASTER_PROJECT_SPEC.md) é a **fonte única de verdade** para a implementação.

```text
VELDOCS/
├── MASTER_PROJECT_SPEC.md
├── README.md
├── docs/
│   ├── architecture/
│   ├── security/
│   ├── modules/
│   ├── api/
│   ├── database/
│   └── audits/
├── frontend/
├── backend/
└── ...
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

### Status

- ✅ CONCLUÍDO
- 🟡 PARCIAL
- 🔴 NÃO IMPLEMENTADO
- ⚠️ PROBLEMA
- ⏳ BLOQUEADO
- 🔍 AUDITAR

### Evidência de conclusão

Para marcar ✅, registrar:

- arquivos/evidências;
- testes;
- resultado;
- data;
- observações.

## Roadmap resumido

**FASE 0 — Produto e posicionamento**  
Marca → proposta → público → modelo modular → Core + módulos → trial de 14 dias

**FASE 1 — Fundação técnica**  
Next.js → React → TypeScript → Node.js → PostgreSQL → Prisma → Zod → testes → monólito modular

**FASE 2 — Segurança base**  
Auth → sessão → multi-tenancy → RBAC → rate limiting → auditoria

**FASE 3 — Empresa + módulos comerciais**  
Usuários → empresas → permissões → catálogo → entitlements → Builder → trial

**FASE 4–7 — MVP**  
Documentos → storage → vencimentos → alertas → dashboard → histórico → versionamento → testes → staging

**FASE 8–12 — Expansão operacional**  
Beta → funcionários → fornecedores → solicitações → aprovações → portal → contratos → automações

**FASE 13–15 — Inteligência**  
IA → OCR → análise → risco → score → WhatsApp → ações → modo auditoria

**FASE 16–20 — Escala comercial e plataforma**  
Billing → upsell → observabilidade → segurança avançada → integrações → ecossistema

## Estado atual

Auditado em 2026-09-11 (detalhes e evidências na seção 25 do `MASTER_PROJECT_SPEC.md`):

- **FASE 0 — Produto e posicionamento:** concluída, incluindo a identidade visual ([`docs/brand/identidade-visual.md`](./docs/brand/identidade-visual.md)).
- **FASE 1 — Fundação técnica:** concluída.
- **FASE 2 — Segurança base:** quase concluída. Prontos: pessoa com vínculos multiempresa, cadastro, login por e-mail ou CPF + senha, sessão segura, limites de tentativa, auditoria, empresa ativa, permissões (RBAC) nas rotas, segundo fator obrigatório para OWNER/ADMIN, headers de segurança (CSP com nonce e HSTS), logs estruturados e limite por IP. Pendentes: verificação de e-mail, recuperação de senha, link mágico e login com Google (backlog).
- **FASE 3 — Empresa + módulos comerciais:** primeira metade concluída — gestão da empresa (com CNPJ validado), filiais e setores, com isolamento por empresa, exclusão que recusa registro em uso e auditoria ([`docs/api/empresa-filiais-setores.md`](./docs/api/empresa-filiais-setores.md)). Segunda metade iniciada: catálogo com os 17 módulos da spec, entitlements por empresa, estados do trial de 14 dias, preços de módulos e kits com cálculo do total mensal e sugestão de kit no backend, e prazos de retenção após cancelamento e suspensão. Membros: convite por link, troca de perfil, suspensão e remoção ([`docs/api/membros-convites.md`](./docs/api/membros-convites.md)). Telas de cadastro, login, segundo fator, Builder e convite, com Tailwind CSS ([`docs/frontend/telas.md`](./docs/frontend/telas.md)); o Builder lista o catálogo, calcula o preço em tempo real com sugestão de kit, inicia o trial e, durante ele, troca kit e módulos sem apagar dados ([`docs/api/builder.md`](./docs/api/builder.md)). Pendentes: perfis personalizados e exclusão de contas após a retenção.
- **FASE 4 — Núcleo documental:** iniciada. API de documentos com categorias em árvore, etiquetas, responsável, filial, setor, emissão e validade, busca sem acento, filtros, ordenação e paginação ([`docs/api/documentos.md`](./docs/api/documentos.md)). Exclusão lógica em tudo. Telas `/documentos` e `/categorias`, com busca, filtros e formulários ([`docs/frontend/telas.md`](./docs/frontend/telas.md)). Pendentes: arquivo e upload (FASE 5), situação automática de vencimento com alertas e dashboard.
- **CI/CD:** GitHub Actions (lint, tipos, testes unitários, integração, build e E2E) e deploy no Railway somente com CI verde.

Produção: https://veldocs-app-production.up.railway.app

Backlog (adiado, ver seção 26 do `MASTER_PROJECT_SPEC.md`): e-mail transacional (Resend), login com Google e cópia das chaves/backup do banco.

> A estrutura real do código é um único app Next.js em camadas (`src/app`, `src/presentation`, `src/application`, `src/domain`, `src/infrastructure`), com `prisma/` e `tests/`, e não pastas `frontend/` e `backend/` separadas. Ver [`docs/architecture/fundacao-tecnica.md`](./docs/architecture/fundacao-tecnica.md).

### Primeiros passos (desenvolvimento)

Requisitos: Node.js 24, pnpm 10 e Docker.

```bash
cp .env.example .env   # gere APP_ENCRYPTION_KEY e APP_HMAC_KEY conforme o arquivo
pnpm install
pnpm db:up             # PostgreSQL local (127.0.0.1:5440)
pnpm db:deploy         # aplica as migrações
pnpm dev               # http://localhost:3000
```

Qualidade: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm build`.

### Rodando tudo em Docker

Alternativa ao `pnpm dev`: a aplicação também roda em container, junto com o banco.

```bash
pnpm docker:dev    # sobe app + banco e sincroniza as alterações do código
pnpm docker:logs   # acompanha os logs da aplicação
pnpm docker:down   # encerra tudo
```

`pnpm docker:dev` usa `docker compose watch` e precisa **ficar rodando**: é ele quem copia para o container o que muda em `src/` e `public/` (leva ~5 s até a alteração aparecer). Alterações em `package.json`, `pnpm-lock.yaml`, `prisma/`, `next.config.ts` ou `tsconfig.json` reconstroem a imagem automaticamente.

Para apenas executar sem sincronizar o código, use `pnpm docker:up` (em segundo plano).

O código **não** é montado do host: em Windows o watcher de arquivos não é confiável através de bind mount, então o código vai na imagem e o `watch` mantém o container em dia.

O arquivo fica em [`docker/Dockerfile`](./docker/Dockerfile), e **não** na raiz: o Railway detecta um `Dockerfile` na raiz e passa a construir por ele em vez do nixpacks. Ele também tem o alvo `runner`, com build de produção, para conferir localmente:

```bash
docker build -f docker/Dockerfile --target runner -t veldocs-prod . && docker run --rm --env-file .env -p 3000:3000 veldocs-prod
```
