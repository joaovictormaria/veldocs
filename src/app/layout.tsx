import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PRODUCT_IDENTITY } from "@/presentation/product-identity";
import "./globals.css";

export const metadata: Metadata = {
  title: PRODUCT_IDENTITY.name,
  description: `${PRODUCT_IDENTITY.tagline} ${PRODUCT_IDENTITY.motto}`,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
