import { LegalPage } from "@/components/legal";
import { legalLastUpdated, privacySections } from "@/shared/legal";
import { getPageMetadata, siteConfig } from "@/shared/metadata";

export const metadata = getPageMetadata("Privacy Policy", {
  description: `How ${siteConfig.name} collects, uses, and protects information.`,
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description={`How ${siteConfig.name} collects, uses, and protects information.`}
      href="/privacy"
      lastUpdated={legalLastUpdated}
      sections={privacySections}
    />
  );
}
