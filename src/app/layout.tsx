import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { BRAND_SURFACES } from "@/presentation/brand";
import { PRODUCT_IDENTITY } from "@/presentation/product-identity";
import "./globals.css";

export const metadata: Metadata = {
  title: PRODUCT_IDENTITY.name,
  description: `${PRODUCT_IDENTITY.tagline} ${PRODUCT_IDENTITY.motto}`,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BRAND_SURFACES.light },
    { media: "(prefers-color-scheme: dark)", color: BRAND_SURFACES.dark },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
