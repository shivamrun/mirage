"use client";

import { toast } from "sonner";

const criticalToastOptions = {
  duration: Infinity,
} as const;

export function showCriticalEmailToast(message: string) {
  toast.error(message, criticalToastOptions);
}

export function showEmailErrorToast(message: string) {
  toast.error(message);
}

export function showEmailInfoToast(message: string) {
  toast.info(message);
}

export function showEmailSuccessToast(message: string) {
  toast.success(message);
}
