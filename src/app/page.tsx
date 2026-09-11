import Image from "next/image";
import { BRAND_ASSETS } from "@/presentation/brand";
import { PRODUCT_IDENTITY } from "@/presentation/product-identity";

export default function HomePage() {
  return (
    <main className="foundation">
      <p className="eyebrow">Em fundação técnica</p>
      <h1 className="brand-logo">
        <Image
          className="logo-light"
          src={BRAND_ASSETS.logoLight.src}
          width={BRAND_ASSETS.logoLight.width}
          height={BRAND_ASSETS.logoLight.height}
          alt={PRODUCT_IDENTITY.name}
        />
        <Image
          className="logo-dark"
          src={BRAND_ASSETS.logoDark.src}
          width={BRAND_ASSETS.logoDark.width}
          height={BRAND_ASSETS.logoDark.height}
          alt={PRODUCT_IDENTITY.name}
        />
      </h1>
      <p className="motto">{PRODUCT_IDENTITY.motto}</p>
      <p className="value">{PRODUCT_IDENTITY.valueProposition}</p>
    </main>
  );
}
