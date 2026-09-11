# VELDOCS — Telas

Fonte da verdade: `src/app/*/page.tsx` (rotas), [`src/presentation/screens/`](../../src/presentation/screens/) (interação) e [`src/presentation/components/ui.tsx`](../../src/presentation/components/ui.tsx) (componentes base).

## Rotas

| Tela | Rota | Quem acessa | O que faz |
|---|---|---|---|
| Página inicial | `/` | todos | apresenta o produto; chamadas para criar conta e entrar |
| Cadastro | `/cadastro` | sem sessão | cria conta e empresa e segue para o segundo fator |
| Login | `/entrar` | sem sessão | e-mail ou CPF e senha; volta ao destino pedido em `?next=` |
| Segundo fator | `/seguranca` | com sessão e MFA pendente | configura o app autenticador ou verifica com código do app ou de recuperação |
| Builder | `/builder` | com sessão e MFA em dia | kits, módulos, total em tempo real, sugestão de kit e início do trial; depois, o resumo da assinatura, com "Alterar módulos" durante o trial |
| Convite | `/convite/[token]` | todos | aceite com a conta atual ou cadastro já como membro |
| Início | `/inicio` | todos | encaminha para o próximo passo |

## Fluxos

```text
Cadastro ──► Segundo fator ──► Builder ──► trial de 14 dias
Login ─────► Segundo fator (se o perfil exigir) ──► Builder
Convite ───► cadastro pelo link ou aceite ──► Início ──► próximo passo
```

`/inicio` decide o próximo passo no servidor: sem sessão → login; perfil que exige segundo fator ainda não confirmado → `/seguranca`; senão → `/builder`.

## Arquitetura das telas

- **Páginas são componentes de servidor.** Leem a sessão, redirecionam antes de renderizar e carregam os dados com a mesma autorização da API — o Builder chama `authorize(…, "billing.read")` e os casos de uso diretamente. Nada pisca antes do redirecionamento, e a tela não precisa buscar os dados de novo ao abrir.
- **Componentes de cliente** (`"use client"`) só cuidam da interação e chamam a API da própria aplicação (`src/presentation/api-client.ts`, mesma origem, cookie `HttpOnly`).
- **Toda página é dinâmica** (`export const dynamic = "force-dynamic"`): a CSP usa nonce por requisição, e HTML pré-gerado não teria o nonce.
- Props de componente de cliente precisam ser serializáveis: datas vão como texto ISO.

## Segurança nas telas

| Cuidado | Onde |
|---|---|
| Destino depois do login só aceita caminhos internos (`/…`, nunca `//…` nem URL externa) | `safeNextPath` em `api-client.ts` |
| Chave do autenticador gerada por clique, não ao abrir a tela — em desenvolvimento o React executa efeitos duas vezes, e a chave exibida poderia não ser a gravada | `mfa-form.tsx` |
| Link de convite com `referrer: no-referrer`, para o token não vazar no cabeçalho `Referer` | `convite/[token]/page.tsx` |
| Total do Builder sempre calculado no servidor | `GET /api/builder/quote` |

## Estilo

Tailwind CSS v4 (DEC-029), integrado pelo PostCSS (`postcss.config.mjs`). Os tokens da marca ficam em `:root` e são expostos ao Tailwind em `@theme` (`src/app/globals.css`):

| Classe | Token | Cor |
|---|---|---|
| `brand-primary` | `--brand-primary` | `#3D5AFE` |
| `brand-dark` | `--brand-dark` | `#2541B2` |
| `brand-cyan` | `--brand-cyan` | `#00E5FF` |
| `surface-light` | `--surface-light` | `#FBFAFA` |
| `surface-dark` | `--surface-dark` | `#121317` |

Tema escuro pelo `prefers-color-scheme` (`dark:`). A logo clara ou escura acompanha o tema.

## Testes

| Nível | Arquivo |
|---|---|
| Unitário | [`tests/unit/presentation/api-client-and-format.test.ts`](../../tests/unit/presentation/api-client-and-format.test.ts) — destino seguro, mensagens da API, formatação |
| E2E no navegador | [`tests/e2e/builder-ui.spec.ts`](../../tests/e2e/builder-ui.spec.ts) — cadastro → segundo fator → kit Gestão + Contratos → trial; sugestão de kit; login com código de recuperação; convite pela tela; telas protegidas; [`tests/e2e/module-change.spec.ts`](../../tests/e2e/module-change.spec.ts) — troca de kit e módulos pelo resumo e cancelar sem alterar |
