"use client";

import { FlaskConicalIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/shared/api/client";

export function NotificationRealtimeTestButton() {
  const [isPending, setIsPending] = useState(false);

  async function sendTestNotification() {
    setIsPending(true);

    try {
      const { error } = await api.api.account.notifications.test.post();

      if (error) {
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
