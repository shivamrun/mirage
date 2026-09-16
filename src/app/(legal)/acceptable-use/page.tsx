import { LegalPage } from "@/components/legal";
import { acceptableUseSections, legalLastUpdated } from "@/shared/legal";
import { getPageMetadata, siteConfig } from "@/shared/metadata";

export const metadata = getPageMetadata("Acceptable Use Policy", {
  description: `Rules for responsible use of ${siteConfig.name}.`,
  path: "/acceptable-use",
});

export default function AcceptableUsePage() {
  return (
    <LegalPage
      title="Acceptable Use Policy"
      description={`Rules for responsible use of ${siteConfig.name}.`}
      href="/acceptable-use"
      lastUpdated={legalLastUpdated}
      sections={acceptableUseSections}
    />
  );
}
