"use client";

import { FlaskConicalIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function NotificationRealtimeTestButton() {
  const [isPending, setIsPending] = useState(false);

  async function sendTestNotification() {
    setIsPending(true);

    try {
      const response = await fetch("/api/account/notifications/test", {
        credentials: "same-origin",
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Unable to send test notification.");
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button
      disabled={isPending}
      onClick={() => sendTestNotification()}
      type="button"
      variant="outline"
    >
      <FlaskConicalIcon data-icon="inline-start" />
      {isPending ? "Sending..." : "Send test"}
    </Button>
  );
}
