import type { Metadata } from "next";

import { LoginForm } from "@/components/auth";
import { getSafeAuthRedirect } from "@/lib/auth/redirect";

export const metadata: Metadata = {
  title: "Sign In | Grove",
};

type LoginPageProps = {
  searchParams: Promise<{
    callbackURL?: string;
    reset?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackURL, reset } = await searchParams;

  return (
    <LoginForm
      redirectTo={getSafeAuthRedirect(callbackURL)}
      resetSuccess={reset === "success"}
    />
  );
}
