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
      <a
        href="https://portifolio.velnoxia.com.br"
        target="_blank"
        rel="noopener noreferrer"
        className="group mt-16 inline-flex items-center gap-2.5 self-start rounded-full border border-slate-300 py-2 pl-4 pr-2 text-xs text-slate-500 transition hover:border-brand-primary dark:border-slate-700 dark:text-slate-400"
      >
        <span className="whitespace-nowrap">Site desenvolvido por</span>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-brand-primary px-3 py-1.5 font-bold text-white">
          João Victor Maria
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </span>
      </a>
    </main>
  );
}
