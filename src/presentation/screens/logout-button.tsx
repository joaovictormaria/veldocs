"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/presentation/api-client";
import { Button } from "@/presentation/components/ui";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const logout = async () => {
    setBusy(true);
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/entrar");
    router.refresh();
  };

  return (
    <Button variant="ghost" loading={busy} onClick={logout}>
      Sair
    </Button>
  );
}
