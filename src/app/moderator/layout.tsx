import { VerifiedRoleGate } from "@/components/auth/verified-role-gate";

export default function ModeratorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <VerifiedRoleGate requiredRole="moderator">{children}</VerifiedRoleGate>
  );
}
