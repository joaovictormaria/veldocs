import Image from "next/image";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { BRAND_ASSETS } from "@/presentation/brand";
import { PRODUCT_IDENTITY } from "@/presentation/product-identity";

/** Logo clara ou escura conforme o tema do sistema. */
export function BrandLogo({ className = "" }: { readonly className?: string }) {
  return (
    <span className={`block ${className}`}>
      <Image
        className="block h-auto w-full dark:hidden"
        src={BRAND_ASSETS.logoLight.src}
        width={BRAND_ASSETS.logoLight.width}
        height={BRAND_ASSETS.logoLight.height}
        alt={PRODUCT_IDENTITY.name}
        loading="eager"
      />
      <Image
        className="hidden h-auto w-full dark:block"
        src={BRAND_ASSETS.logoDark.src}
        width={BRAND_ASSETS.logoDark.width}
        height={BRAND_ASSETS.logoDark.height}
        alt={PRODUCT_IDENTITY.name}
        loading="eager"
      />
    </span>
  );
}

export function AuthCard({
  title,
  subtitle,
  children,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <BrandLogo className="mb-8 w-40" />
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </div>
    </main>
  );
}

export function Field({
  id,
  label,
  error,
  hint,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & {
  readonly id: string;
  readonly label: string;
  readonly error?: string | null;
  readonly hint?: string;
}) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-xs outline-none transition focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/30 aria-invalid:border-red-500 dark:border-slate-700 dark:bg-slate-950"
        {...input}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const BUTTON_VARIANTS = {
  primary: "bg-brand-primary text-white hover:bg-brand-dark",
  secondary:
    "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800",
  ghost: "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
} as const;

export function Button({
  variant = "primary",
  loading = false,
  className = "",
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly variant?: keyof typeof BUTTON_VARIANTS;
  readonly loading?: boolean;
}) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary disabled:cursor-not-allowed disabled:opacity-60 ${BUTTON_VARIANTS[variant]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {children}
    </button>
  );
}

const ALERT_TONES = {
  error: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
  info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-100",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
} as const;

export function Alert({ tone = "error", children }: { readonly tone?: keyof typeof ALERT_TONES; readonly children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${ALERT_TONES[tone]}`}>
      {children}
    </div>
  );
}

export const LINK_CLASS = "font-medium text-brand-primary hover:underline dark:text-brand-cyan";

/** Cartão padrão das telas internas. */
export const CARD = "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900";
