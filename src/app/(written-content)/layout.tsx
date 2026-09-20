import { AppHeader } from "@/components/app/app-header";
import { getCurrentUser } from "@/server/db/services/auth/access";

export default async function WrittenContentLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <main className="min-h-dvh bg-background">
      <AppHeader isAuthenticated={Boolean(user)} />
      {children}
    </main>
  );
}
