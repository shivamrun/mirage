import type { Metadata } from "next";

import { LoginForm } from "@/components/auth";

export const metadata: Metadata = {
  title: "Sign In | Grove",
};

type LoginPageProps = {
  searchParams: Promise<{
    reset?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { reset } = await searchParams;

  return <LoginForm resetSuccess={reset === "success"} />;
}
