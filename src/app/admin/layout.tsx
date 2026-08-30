import { AppShell } from "@/components/app/app-shell";
import { VerifiedRoleGate } from "@/components/auth/verified-role-gate";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <VerifiedRoleGate requiredRole="admin">
      <AppShell>{children}</AppShell>
    </VerifiedRoleGate>
  );
}
