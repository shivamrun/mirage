"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

type CopyableIdProps = {
  value: string;
  maxLength?: number;
};

export function CopyableId({ value, maxLength = 12 }: CopyableIdProps) {
  const [copied, setCopied] = useState(false);

  const truncated =
    value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;

  async function copy() {
    await navigator.clipboard.writeText(value);

    setCopied(true);

    window.setTimeout(() => {
      setCopied(false);
    }, 1500);
  }

  return (
    <HoverCard closeDelay={150} openDelay={100}>
      <HoverCardTrigger className="cursor-default font-mono text-xs cursor-pointer">
        {truncated}
      </HoverCardTrigger>

      <HoverCardContent align="start" className="w-auto max-w-md" side="top">
        <div className="flex min-w-0 items-center gap-2">
          <code className="min-w-0 break-all font-mono text-xs">{value}</code>

          <Button
            aria-label="Copy ID"
            className="size-7 shrink-0"
            onClick={copy}
            size="icon"
            type="button"
            variant="ghost"
          >
            {copied ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
