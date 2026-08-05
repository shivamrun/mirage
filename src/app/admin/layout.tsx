import { VerifiedRoleGate } from "@/components/auth/verified-role-gate";

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <VerifiedRoleGate requiredRole="admin">{children}</VerifiedRoleGate>;
}
