import { EmailLayout, EmailText } from "@/adapters/email/components";

export default function AccountDataExportTemplate({
  name,
}: {
  name?: null | string;
}) {
  return (
    <EmailLayout
      previewText="Your requested Mirage data export is attached."
      title="Your Mirage data export"
    >
      <EmailText>Hi {name || "there"},</EmailText>
      <EmailText>
        Your requested account data export is attached as a compressed JSON
        file. Keep it private because it may contain personal information.
      </EmailText>
    </EmailLayout>
  );
}
