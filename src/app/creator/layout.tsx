import { VerifiedRoleGate } from "@/components/auth/verified-role-gate";

export default function CreatorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <VerifiedRoleGate requiredRole="creator">{children}</VerifiedRoleGate>;
}
