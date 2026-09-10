import { PRODUCT_IDENTITY } from "@/presentation/product-identity";

export default function HomePage() {
  return (
    <main className="foundation">
      <p className="eyebrow">Em fundação técnica</p>
      <h1>{PRODUCT_IDENTITY.name}</h1>
      <p className="tagline">{PRODUCT_IDENTITY.tagline}</p>
      <p className="motto">{PRODUCT_IDENTITY.motto}</p>
      <p className="value">{PRODUCT_IDENTITY.valueProposition}</p>
    </main>
  );
}
