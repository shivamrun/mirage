export const creditSampleItems = [
  {
    key: "tiny-note",
    name: "Tiny note",
    description: "Create a compact sample note that proves credit spending.",
    credits: 10,
  },
  {
    key: "project-idea",
    name: "Project idea",
    description: "Create a slightly richer sample idea entry.",
    credits: 30,
  },
  {
    key: "launch-checklist",
    name: "Launch checklist",
    description: "Create a fuller sample checklist entry.",
    credits: 50,
  },
] as const;

export type CreditSampleItem = (typeof creditSampleItems)[number];
export type CreditSampleItemKey = CreditSampleItem["key"];

export const creditSampleItemKeys = creditSampleItems.map(
  (item) => item.key,
) as [CreditSampleItemKey, ...CreditSampleItemKey[]];

export function getCreditSampleItem(key: string) {
  return creditSampleItems.find((item) => item.key === key) ?? null;
}
