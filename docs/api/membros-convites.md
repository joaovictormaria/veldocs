# VELDOCS — API de membros, perfis e convites

Fonte da verdade: `src/app/api/company/members/`, `src/app/api/company/roles/`, `src/app/api/company/invitations/`, `src/app/api/invitations/`, [`src/application/access/manage-members.ts`](../../src/application/access/manage-members.ts) e [`src/infrastructure/database/prisma-member-management-repository.ts`](../../src/infrastructure/database/prisma-member-management-repository.ts).

A empresa vem sempre da sessão (`AuthorizedContext`). Membro, convite ou perfil de outra empresa se comporta como inexistente.

## Endpoints da empresa

| Método | Rota | Permissão | Resposta |
|---|---|---|---|
| `GET` | `/api/company/roles` | `roles.read` | perfis com permissões e membros ativos |
| `GET` | `/api/company/members` | `members.read` | membros (sem os removidos) |
| `GET` | `/api/company/invitations` | `members.read` | convites pendentes |
| `POST` | `/api/company/invitations` | `members.invite` | `201 { invitation, inviteUrl }` |
| `DELETE` | `/api/company/invitations/[invitationId]` | `members.invite` | `204` |
| `PUT` | `/api/company/members/[userId]/roles` | `members.manage` | `{ member }` — body `{ "roleKeys": ["GESTOR"] }` |
| `PUT` | `/api/company/members/[userId]/status` | `members.manage` | `{ member }` — body `{ "status": "SUSPENDED" \| "ACTIVE" }` |
| `DELETE` | `/api/company/members/[userId]` | `members.manage` | `204` |

## Endpoints do link de convite

| Método | Rota | Sessão | Resposta |
|---|---|---|---|
| `GET` | `/api/invitations/[token]` | não | `{ invitation: { companyName, email (mascarado), roleName, expiresAt } }` |
| `POST` | `/api/invitations/[token]/accept` | sim | `{ companyId }` — a empresa do convite vira a ativa |
| `POST` | `/api/invitations/[token]/signup` | não | `201 { userId, companyId }` + cookie de sessão — body `{ name, password, cpf? }` |

## Convites

- **Por link**, sem e-mail transacional por enquanto (o Resend está no backlog): `inviteUrl` aponta para `/convite/{token}` e é exibido **uma única vez** — só o SHA-256 do token fica no banco (DEC-028).
- Vale **7 dias** e **uma vez**. Um convite novo para o mesmo e-mail **revoga** o anterior.
- A prévia pública mostra o e-mail **mascarado** (`no***@example.com`): a pessoa reconhece o endereço, mas um link vazado não entrega o e-mail inteiro.
- **Quem já tem conta** aceita com a própria sessão; o e-mail da conta precisa ser o do convite.
- **Quem não tem conta** se cadastra pelo link: a conta nasce com o e-mail do convite, já como membro da empresa, **sem criar empresa nova**. Mesmo limite de cadastros por IP do cadastro comum.
- O e-mail convidado não vai para a auditoria; o perfil sim.

## Regras de gestão

| Regra | Resposta |
|---|---|
| Ninguém altera, suspende ou remove o próprio vínculo | `403 cannot_modify_self` |
| Só Proprietário concede, altera, suspende ou remove Proprietário | `403 role_not_allowed` |
| A empresa precisa manter pelo menos um Proprietário ativo | `409 last_owner` |
| Convite para quem já é membro | `409 already_member` |
| Convite expirado, revogado, usado ou inexistente | `404 invitation_not_available` |
| Aceite com conta de outro e-mail | `403 email_mismatch` |
| Cadastro pelo link com e-mail que já tem conta | `409 account_exists` |

A garantia de Proprietário ativo roda no banco, em transação **serializável**, depois de cada troca de perfil, suspensão ou remoção. Assim, duas alterações simultâneas não deixam a empresa sem nenhum Proprietário.

## Remoção

Remover **não apaga o vínculo** — a auditoria referencia `(empresa, pessoa)` e o histórico precisa continuar íntegro (DEC-027). O vínculo fica `REMOVED`:

- sem acesso (a cadeia de autorização exige vínculo `ACTIVE`);
- fora das listagens de membros e das empresas da pessoa;
- sem perfis;
- pode ser convidado de novo: o aceite reativa o vínculo com o perfil do novo convite.

Suspensão bloqueia o acesso na requisição seguinte, sem precisar encerrar sessões.

## Auditoria

`member.invited`, `invitation.revoked`, `invitation.accepted`, `member.roles_changed`, `member.suspended`, `member.reactivated`, `member.removed`.

## Testes

| Nível | Arquivo |
|---|---|
| Unitário | [`tests/unit/domain/access-control/member-rules.test.ts`](../../tests/unit/domain/access-control/member-rules.test.ts), [`tests/unit/domain/identity/invitation.test.ts`](../../tests/unit/domain/identity/invitation.test.ts) |
| Integração | [`tests/integration/access/members.test.ts`](../../tests/integration/access/members.test.ts) |
| E2E | [`tests/e2e/members.spec.ts`](../../tests/e2e/members.spec.ts) |
