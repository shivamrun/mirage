"use client";

import { RefreshCw, Unlink } from "lucide-react";
import * as React from "react";
import { HeadingBlock } from "@/components/heading-block";
import { Button } from "@/components/ui/button";
import { FieldSet } from "@/components/ui/field";
import { authClient } from "@/features/auth/client";
import {
  getAuthErrorMessage,
  getUnexpectedAuthErrorMessage,
} from "@/features/auth/components/auth-errors";
import { AuthStatusMessage } from "@/features/auth/components/auth-form-shell";
import { GoogleIcon } from "@/features/auth/components/google-auth-button";
import { api } from "@/shared/api/client";

type LinkedAccount = {
  providerId: string;
  accountId: string;
  createdAt: string;
  email: string | null;
};

type StatusMessage = {
  text: string;
  tone: "success" | "error" | "info";
};

function formatAccountLabel(account: LinkedAccount) {
  return account.email || "Google account";
}

function formatConnectedDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Connected";
  }

  const day = date.getDate();
  const suffix =
    day % 10 === 1 && day % 100 !== 11
      ? "st"
      : day % 10 === 2 && day % 100 !== 12
        ? "nd"
        : day % 10 === 3 && day % 100 !== 13
          ? "rd"
          : "th";
  const month = date.toLocaleString("en-US", { month: "short" });

  return `Connected ${day}${suffix} ${month} ${date.getFullYear()}`;
}

function AccountConnectedAccounts({
  googleAuthEnabled = false,
  googleAccountStatus,
}: {
  googleAuthEnabled?: boolean;
  googleAccountStatus?: string;
}) {
  const [accounts, setAccounts] = React.useState<LinkedAccount[]>([]);
  const [status, setStatus] = React.useState<StatusMessage>();
  const [isLoading, setIsLoading] = React.useState(true);
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [unlinkingAccountId, setUnlinkingAccountId] = React.useState<string>();

  const googleAccount = accounts.find(
    (account) => account.providerId === "google",
  );

  const loadAccounts = React.useCallback(async () => {
    setIsLoading(true);

    try {
      const { data, error } = await api.api.account["google-account"].get();

      if (error) {
        setStatus({
          text: "Could not load Google account.",
          tone: "error",
        });
        return;
      }

      setAccounts(data.account ? [data.account] : []);
    } catch (reason) {
      setStatus({
        text: getUnexpectedAuthErrorMessage(reason),
        tone: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadAccounts().catch(() => undefined);
  }, [loadAccounts]);

  React.useEffect(() => {
    if (googleAccountStatus === "linked") {
      setStatus({
        text: "Google account connected.",
        tone: "success",
      });
      return;
    }

    if (googleAccountStatus === "error") {
      setStatus({
        text: "Google account was not connected. Try again.",
        tone: "error",
      });
    }
  }, [googleAccountStatus]);

  async function connectGoogleAccount() {
    if (!googleAuthEnabled) {
      return;
    }

    setStatus(undefined);
    setIsConnecting(true);

    try {
      const result = await authClient.linkSocial({
        provider: "google",
        callbackURL: "/account/security?googleAccount=linked",
        errorCallbackURL: "/account/security?googleAccount=error",
      });

      if (result.error) {
        setStatus({
          text: getAuthErrorMessage(result.error),
          tone: "error",
        });
        setIsConnecting(false);
        return;
      }

      if (result.data?.url) {
        window.location.href = result.data.url;
      }
    } catch (reason) {
      setStatus({
        text: getUnexpectedAuthErrorMessage(reason),
        tone: "error",
      });
      setIsConnecting(false);
    }
  }

  async function disconnectGoogleAccount(account: LinkedAccount) {
    setStatus(undefined);
    setUnlinkingAccountId(account.accountId);

    try {
      const result = await authClient.unlinkAccount({
        providerId: "google",
        accountId: account.accountId,
      });

      if (result.error) {
        setStatus({
          text: getAuthErrorMessage(result.error),
          tone: "error",
        });
        return;
      }

      setAccounts((currentAccounts) =>
        currentAccounts.filter(
          (currentAccount) =>
            currentAccount.providerId !== account.providerId ||
            currentAccount.accountId !== account.accountId,
        ),
      );
      setStatus({
        text: "Google account disconnected.",
        tone: "success",
      });
    } catch (reason) {
      setStatus({
        text: getUnexpectedAuthErrorMessage(reason),
        tone: "error",
      });
    } finally {
      setUnlinkingAccountId(undefined);
    }
  }

  return (
    <FieldSet>
      {status ? (
        <AuthStatusMessage tone={status.tone}>{status.text}</AuthStatusMessage>
      ) : null}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading connections...</p>
      ) : null}

      {!isLoading && !googleAccount ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <HeadingBlock
            className="min-w-0"
            description={
              googleAuthEnabled
                ? "Connect Google to sign in with that account."
                : "Google sign-in is not configured yet."
            }
            size="sm"
            title="No Google account connected"
            titleAs="h3"
          />
          <Button
            className="w-full sm:w-fit"
            disabled={!googleAuthEnabled || isConnecting}
            onClick={connectGoogleAccount}
            type="button"
            variant="outline"
          >
            <GoogleIcon />
            {isConnecting ? "Opening Google..." : "Connect"}
          </Button>
        </div>
      ) : null}

      {googleAccount ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border/70">
              <GoogleIcon />
            </div>
            <HeadingBlock
              className="min-w-0"
              description={formatConnectedDate(googleAccount.createdAt)}
              size="sm"
              title={formatAccountLabel(googleAccount)}
              titleAs="p"
              titleClassName="truncate"
            />
          </div>
          <Button
            aria-label={`Disconnect ${formatAccountLabel(googleAccount)}`}
            disabled={unlinkingAccountId === googleAccount.accountId}
            onClick={() => disconnectGoogleAccount(googleAccount)}
            size="icon-sm"
            type="button"
            variant="outline"
          >
            {unlinkingAccountId === googleAccount.accountId ? (
              <RefreshCw />
            ) : (
              <Unlink />
            )}
          </Button>
        </div>
      ) : null}
    </FieldSet>
  );
}

export { AccountConnectedAccounts };
