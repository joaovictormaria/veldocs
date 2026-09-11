import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/presentation/components/ui";
import { LogoutButton } from "@/presentation/screens/logout-button";

const NAV = [
  { href: "/documentos", label: "Documentos" },
  { href: "/categorias", label: "Categorias" },
  { href: "/builder", label: "Assinatura" },
] as const;

export type NavKey = (typeof NAV)[number]["href"];

/**
 * Moldura das telas de quem já entrou: marca, navegação, pessoa e sair.
 * É componente de servidor — a interação fica nos filhos.
 */
export function AppShell({
  userName,
  companyName,
  current,
  children,
}: {
  readonly userName: string;
  readonly companyName: string;
  readonly current: NavKey;
  readonly children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4">
          <div className="flex items-center gap-4">
            <BrandLogo className="w-28" />
            <span className="hidden text-sm text-slate-500 sm:inline">{companyName}</span>
          </div>

          <nav aria-label="Seções" className="order-3 flex w-full gap-1 sm:order-0 sm:w-auto">
            {NAV.map((item) => {
              const active = item.href === current;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-brand-primary/10 text-brand-dark dark:bg-brand-primary/20 dark:text-brand-cyan"
                      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:inline dark:text-slate-400">{userName}</span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
