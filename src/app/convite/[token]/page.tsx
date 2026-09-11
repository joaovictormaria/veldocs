import type { Metadata } from "next";
import { getAuthServices } from "@/infrastructure/composition/auth-services";
import { InvitationClient } from "@/presentation/screens/invitation-client";
import { currentSession } from "../../_lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Convite — VELDOCS", referrer: "no-referrer" };

/** Tela do link de convite: aceite com a conta atual ou cadastro já como membro. */
export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [preview, session] = await Promise.all([
    token.length <= 100 ? getAuthServices().members.previewInvitation(token) : null,
    currentSession(),
  ]);

  return (
    <InvitationClient
      token={token}
      invitation={preview ? { ...preview, expiresAt: preview.expiresAt.toISOString() } : null}
      signedInEmail={session?.user.email ?? null}
    />
  );
}
