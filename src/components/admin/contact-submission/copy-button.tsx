"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

type ContactSubmissionCopyButtonProps = {
  label: string;
  value: string;
};

export function ContactSubmissionCopyButton({
  label,
  value,
}: ContactSubmissionCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);

    window.setTimeout(() => {
      setCopied(false);
    }, 1500);
  }

  return (
    <Button
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      className="size-7 shrink-0"
      onClick={copy}
      size="icon"
      title={copied ? "Copied" : `Copy ${label}`}
      type="button"
      variant="ghost"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}
