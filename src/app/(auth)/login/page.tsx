import { LoginForm } from "@/components/auth";
import AuthContainer from "@/components/auth/auth-container";
import { getSafeAuthRedirect } from "@/lib/auth/redirect";
import { getPageMetadata } from "@/lib/metadata";
import { isGoogleAuthConfigured } from "@/server/auth/better-auth";

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
