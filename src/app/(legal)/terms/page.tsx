import { LegalPage } from "@/components/legal";
import { legalLastUpdated, termsSections } from "@/shared/legal";
import { getPageMetadata, siteConfig } from "@/shared/metadata";

export const metadata = getPageMetadata("Terms of Service", {
  description: `The terms that apply when you use ${siteConfig.name}.`,
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      description={`The terms that apply when you create an account or use ${siteConfig.name}.`}
      href="/terms"
      lastUpdated={legalLastUpdated}
      sections={termsSections}
    />
  );
}
