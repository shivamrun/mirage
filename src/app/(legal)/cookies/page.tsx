import { LegalPage } from "@/components/legal";
import { cookieSections, legalLastUpdated } from "@/shared/legal";
import { getPageMetadata, siteConfig } from "@/shared/metadata";

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
