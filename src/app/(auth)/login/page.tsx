import { isGoogleAuthConfigured } from "@/features/auth/better-auth/server";
import { LoginForm } from "@/features/auth/components";
import AuthContainer from "@/features/auth/components/auth-container";
import { getSafeAuthRedirect } from "@/features/auth/redirect";
import { getPageMetadata } from "@/shared/metadata";

export const metadata = getPageMetadata("Sign In", { path: "/login" });

type LoginPageProps = {
  searchParams: Promise<{
    callbackURL?: string;
    reset?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { callbackURL, reset } = await searchParams;

  return (
    <AuthContainer
      authForm={
        <LoginForm
          redirectTo={getSafeAuthRedirect(callbackURL)}
          resetSuccess={reset === "success"}
          googleAuthEnabled={isGoogleAuthConfigured}
        />
      }
    />
  );
}
