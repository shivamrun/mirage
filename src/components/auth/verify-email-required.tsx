import Link from "next/link";

import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { VerifyEmailRequiredForm } from "@/components/auth/verify-email-required-form";

type VerifyEmailRequiredProps = {
  callbackURL: string;
  email: string;
  sent?: boolean;
};

function VerifyEmailRequired({
  callbackURL,
  email,
  sent = false,
}: VerifyEmailRequiredProps) {
  return (
    <AuthFormShell
      title="Verify your email"
      description="Your workspace is ready. Confirm your email address and we will bring you right back here."
      footer={
        <Link className="link-text" href="/account">
          Manage account
        </Link>
      }
    >
      <VerifyEmailRequiredForm
        callbackURL={callbackURL}
        email={email}
        sent={sent}
      />
    </AuthFormShell>
  );
}

export { VerifyEmailRequired };
