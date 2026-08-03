import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth";
import { getSafeAuthRedirect } from "@/lib/auth/redirect";

export const metadata: Metadata = {
  title: "Create Account | Grove",
};

type RegisterPageProps = {
  searchParams: Promise<{
    callbackURL?: string;
  }>;
};

export default async function RegisterPage({
  searchParams,
}: RegisterPageProps) {
  const { callbackURL } = await searchParams;

  return <RegisterForm redirectTo={getSafeAuthRedirect(callbackURL)} />;
}
