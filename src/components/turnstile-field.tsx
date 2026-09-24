"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import * as React from "react";
import { FieldDescription, FieldError } from "@/components/ui/field";

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

type TurnstileFieldProps = {
  action: string;
  error?: string;
  id: string;
  onTokenChange: (token: string) => void;
};

const TurnstileField = React.forwardRef<TurnstileInstance, TurnstileFieldProps>(
  function TurnstileField({ action, error, id, onTokenChange }, ref) {
    if (!turnstileSiteKey) {
      return (
        <FieldError>
          Security check is not configured. Please try again later.
        </FieldError>
      );
    }

    return (
      <div className="flex flex-col gap-2">
        <Turnstile
          id={id}
          ref={ref}
          className="w-full"
          onError={() => onTokenChange("")}
          onExpire={() => onTokenChange("")}
          onSuccess={onTokenChange}
          options={{
            action,
            responseField: false,
            size: "flexible",
            theme: "auto",
          }}
          siteKey={turnstileSiteKey}
        />
        {error ? <FieldError>{error}</FieldError> : null}
      </div>
    );
  },
);

export { TurnstileField };
