import Link from "next/link";

import {
  AuthFormShell,
  AuthStatusMessage,
} from "@/components/auth/auth-form-shell";
import { siteConfig } from "@/lib/metadata";

const verificationErrorMessages: Record<string, string> = {
  INVALID_TOKEN: "That verification link is invalid. Please request a new one.",
  TOKEN_EXPIRED:
    "That verification link has expired. Please request a new one.",
  USER_NOT_FOUND: "We could not find an account for that verification link.",
  INVALID_USER: "That verification link does not match the current account.",
};

function getVerificationErrorMessage(error?: string) {
  if (!error) {
    return "We could not verify your email from that link.";
  }

  return Object.hasOwn(verificationErrorMessages, error)
    ? verificationErrorMessages[error]
    : "We could not verify your email.";
}

function EmailVerificationStatus({
  error,
  status,
}: {
  error?: string;
  status?: string;
}) {
  const isSuccess = status === "success" && !error;

  return (
    <AuthFormShell
      title={isSuccess ? "Email verified" : "Verification failed"}
      description={
        isSuccess
          ? `You're all set. Your ${siteConfig.name} account is ready to use.`
          : "That link did not work. You can request a fresh verification email from your account page."
      }
      footer={
        <Link className="link-text" href="/login">
          Back to sign in
        </Link>
      }
    >
      <AuthStatusMessage tone={isSuccess ? "success" : "error"}>
        {isSuccess
          ? "Thanks, your email is verified."
          : getVerificationErrorMessage(error)}
      </AuthStatusMessage>
    </AuthFormShell>
  );
}

export { EmailVerificationStatus };
