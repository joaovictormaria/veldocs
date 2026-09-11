# VELDOCS — Visão do produto (FASE 0)

> Documento derivado do `MASTER_PROJECT_SPEC.md` v0.2 (seções 1 e 2). Em caso de divergência, o MASTER SPEC prevalece.

## Nome, marca e identidade

- **Produto:** VELDOCS — gestão documental empresarial.
- **Ecossistema:** VELNOX.IA (empresa). O VELDOCS tem identidade visual própria, conectada à família VELNOX, sem depender da identidade do VELNOX.APP.
- **Assinatura:** Gestão inteligente de documentos empresariais.
- **Conceito:** **Zero surpresa documental.**
- **Identidade visual:** definida — logo, ícone e paleta `#3D5AFE` (azul principal), `#2541B2` (azul escuro) e `#00E5FF` (ciano). Ver [`docs/brand/identidade-visual.md`](../brand/identidade-visual.md).

## Propósito

SaaS B2B para empresas organizarem, monitorarem e controlarem documentos empresariais, responsáveis, prazos, pendências e processos de renovação — evoluindo de gerenciador documental para **assistente operacional da documentação empresarial**.

## Problema

Documentação dispersa entre pastas locais, Google Drive/OneDrive, e-mail, WhatsApp, planilhas, lembretes manuais e processos não padronizados, causando desorganização, atrasos, perda de documentos e falta de visibilidade sobre vencimentos.

## Público-alvo inicial

Pequenas e médias empresas que precisam controlar documentos próprios, de funcionários, fornecedores e contratos, sem uma plataforma corporativa excessivamente complexa.

## Proposta de valor

> Organizar documentos, acompanhar prazos, identificar riscos e ajudar a empresa a resolver pendências antes que elas se tornem problemas.

## "Zero surpresa documental"

Nenhum vencimento, pendência ou risco documental deve ser descoberto tarde demais: o sistema **percebe → alerta → explica → recomenda → (quando autorizado) executa**.

## Experiência

| Canal | Papel |
|---|---|
| Dashboard | administração e gestão completa |
| WhatsApp | consultas e ações rápidas |
| IA | interpretação, orientação e automação assistida |

## Modelo comercial modular

> **Monte o VELDOCS que sua empresa precisa.**

```text
Cadastro → VELDOCS Builder → seleção de módulos → preço mensal em tempo real
        → 14 dias grátis → uso → assinatura ou bloqueio controlado
```

- **Core obrigatório** (preço-base, não removível): empresa, usuários, autenticação, permissões, multi-tenancy, gestão documental, storage e dashboard básico.
- **Módulos adicionais** com preço próprio: vencimentos, funcionários, fornecedores, contratos, solicitações, aprovações, automação, análise inteligente, assistente IA, WhatsApp, portal de terceiros, relatórios avançados, OCR, score, radar de risco e modo auditoria.
- **Regras no backend:** catálogo, preço vigente, moeda, período, dependências, limites, entitlement e status de cada módulo. O frontend só apresenta o que o servidor calcula e valida.
- **Kits** com desconto como camada opcional sobre a compra modular.
- **Trial de 14 dias** com estado próprio no backend (`TRIAL_ACTIVE`, `TRIAL_EXPIRING`, `TRIAL_EXPIRED`, `ACTIVE`, `PAYMENT_PENDING`, `PAST_DUE`, `CANCELED`, `SUSPENDED`, `REACTIVATED`). Ao expirar sem assinatura, a conta entra em estado controlado e os dados não são apagados.
- **Upsell contextual**, explicável e opcional, sem dark patterns.

Os preços reais serão definidos comercialmente; o sistema nasce preparado para preço por módulo.

## Escopo do MVP funcional

Empresa, usuários, autenticação, RBAC/permissões, multi-tenancy, Core modular, catálogo e entitlements de módulos, documentos, categorias, upload seguro, storage privado, pesquisa, vencimentos, alertas, dashboard, auditoria/histórico, versionamento, Builder de módulos, trial de 14 dias e estados de assinatura/trial.

Fora do MVP: V2 (funcionários, fornecedores, solicitações, aprovações, portal externo, contratos, automações, calendário, relatórios, recomendação contextual), V3 (IA, OCR, extração, inconsistências, duplicidades, score, radar, WhatsApp, resumos, zero digitação, assistente proativo, modo auditoria) e produto maduro (billing completo, painel administrativo, observabilidade, escala, integrações, marketplace).
