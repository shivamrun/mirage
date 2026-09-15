import type { EmailListStatus } from "@/zod";

export const defaultEmailListKeys = ["waitlist", "newsletter"] as const;

export const defaultEmailLists = [
  {
    description: "Early access requests and launch updates.",
    emailVerificationRequired: true,
    key: "waitlist",
    name: "Waitlist",
    status: "active",
  },
  {
    description: "Product news and occasional announcements.",
    emailVerificationRequired: true,
    key: "newsletter",
    name: "Newsletter",
    status: "active",
  },
] satisfies {
  description: string;
  emailVerificationRequired: boolean;
  key: (typeof defaultEmailListKeys)[number];
  name: string;
  status: EmailListStatus;
}[];

export function isDefaultEmailListKey(key: string) {
  return defaultEmailListKeys.includes(
    key as (typeof defaultEmailListKeys)[number],
  );
}

export function canDeleteEmailList(key: string) {
  return !isDefaultEmailListKey(key);
}
