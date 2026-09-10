# VELDOCS — Visão do produto (FASE 0)

> Documento derivado do `MASTER_PROJECT_SPEC.md` (seções 1 e 2). Em caso de divergência, o MASTER SPEC prevalece.

## Nome e identidade

- **Nome:** VELDOCS
- **Descrição curta:** Gestão inteligente de documentos empresariais.
- **Conceito:** **Zero surpresa documental.**

## Propósito

Ser um SaaS B2B para empresas organizarem, monitorarem e controlarem documentos empresariais, seus responsáveis, prazos, pendências e processos de renovação.

O VELDOCS não é apenas um repositório de PDFs: é um assistente operacional da documentação empresarial — organiza, monitora, alerta, explica riscos, sugere ações e, quando autorizado, executa tarefas.

## Problema

Empresas controlam documentos com uma combinação de pastas locais, Google Drive/OneDrive, e-mail, WhatsApp, planilhas e lembretes manuais. O resultado é desorganização, atrasos, perda de documentos e falta de visibilidade sobre vencimentos.

## Público-alvo inicial

Pequenas e médias empresas que precisam controlar documentos próprios, de funcionários, fornecedores e contratos, sem a complexidade de uma plataforma corporativa.

## Proposta de valor

> Organizar documentos, acompanhar prazos, identificar riscos e ajudar a empresa a resolver pendências antes que elas se tornem problemas.

## "Zero surpresa documental"

Nenhum vencimento, pendência ou risco documental deve ser descoberto tarde demais. O sistema deve **perceber → alertar → explicar → recomendar → (quando autorizado) executar**.

## Escopo inicial do MVP

Ordem do roadmap: Empresa → Usuários → Permissões → Documentos → Storage → Vencimentos → Alertas → Dashboard → Auditoria → Versionamento.

| Incluído no MVP | Fora do MVP (V2/V3/maduro) |
|---|---|
| Empresa, filiais e setores | Funcionários e fornecedores |
| Usuários e autenticação | Contratos |
| RBAC / permissões | Solicitações, aprovações e portal externo |
| Multi-tenancy | Automações, calendário e relatórios |
| Documentos e categorias | IA, OCR e extração de dados |
| Upload seguro e storage privado | WhatsApp |
| Pesquisa | Score documental e radar de risco |
| Vencimentos e alertas | Billing e assinatura |
| Dashboard | Painel administrativo do SaaS |
| Auditoria/histórico | Integrações externas |
| Versionamento | |

## Canais

- **MVP:** dashboard web.
- **Futuro:** WhatsApp, portal externo, automações e notificações multicanal.
