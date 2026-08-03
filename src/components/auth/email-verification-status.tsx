import Link from "next/link";

import {
  AuthFormShell,
  AuthStatusMessage,
} from "@/components/auth/auth-form-shell";

const verificationErrorMessages: Record<string, string> = {
  INVALID_TOKEN: "This verification link is invalid. Please request a new one.",
  TOKEN_EXPIRED:
    "This verification link has expired. Please request a new one.",
  USER_NOT_FOUND: "We could not find the account for this verification link.",
  INVALID_USER: "This verification link does not match the current account.",
};

function getVerificationErrorMessage(error?: string) {
  if (!error) {
    return "We could not verify your email from this link.";
  }

  return verificationErrorMessages[error] ?? "Email verification failed.";
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
          ? "Your email is confirmed. You are good to go."
          : "That link did not work. You can request a fresh verification email from your account page."
      }
      footer={
        <Link className="font-medium text-primary" href="/login">
          Back to sign in
        </Link>
      }
    >
      <AuthStatusMessage tone={isSuccess ? "success" : "error"}>
        {isSuccess
          ? "Thanks, your email has been verified."
          : getVerificationErrorMessage(error)}
      </AuthStatusMessage>
    </AuthFormShell>
  );
}

export { EmailVerificationStatus };
