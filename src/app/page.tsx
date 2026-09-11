import Link from "next/link";
import { BrandLogo } from "@/presentation/components/ui";
import { PRODUCT_IDENTITY } from "@/presentation/product-identity";

/**
 * A CSP usa nonce por requisição (src/proxy.ts), e o nonce só pode ser
 * aplicado aos scripts com renderização dinâmica.
 */
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <p className="mb-4 text-xs font-medium uppercase tracking-[0.08em] text-slate-500">{PRODUCT_IDENTITY.tagline}</p>
      <h1 className="mb-8 leading-none">
        <BrandLogo className="w-full max-w-md" />
      </h1>
      <p className="mb-2 text-lg font-semibold text-brand-dark dark:text-brand-cyan">{PRODUCT_IDENTITY.motto}</p>
      <p className="text-slate-600 dark:text-slate-400">{PRODUCT_IDENTITY.valueProposition}</p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/cadastro"
          className="inline-flex items-center rounded-lg bg-brand-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-brand-dark"
        >
          Começar 14 dias grátis
        </Link>
        <Link
          href="/entrar"
          className="inline-flex items-center rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Entrar
        </Link>
      </div>
    </main>
  );
}
