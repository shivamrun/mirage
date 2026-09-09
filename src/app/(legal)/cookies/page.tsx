import { LegalPage } from "@/components/legal";
import { cookieSections, legalLastUpdated } from "@/lib/legal";
import { getPageMetadata, siteConfig } from "@/lib/metadata";

export const metadata = getPageMetadata("Cookie Policy", {
  description: `How ${siteConfig.name} uses cookies and similar technologies.`,
  path: "/cookies",
});

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      description={`How ${siteConfig.name} uses cookies and similar technologies.`}
      href="/cookies"
      lastUpdated={legalLastUpdated}
      sections={cookieSections}
    />
  );
}
