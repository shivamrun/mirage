import {
  adminContactSubmissionSearchParamsSchema,
  type ContactSubmissionStatus,
} from "@/zod/contact-submission";

export type { ContactSubmissionStatus };

export type ContactSubmissionSearchParamValue = string | string[] | undefined;

export type AdminContactSubmissionPageSearchParams = {
  [key: string]: ContactSubmissionSearchParamValue;

  filterField?: ContactSubmissionSearchParamValue;
  filterValue?: ContactSubmissionSearchParamValue;
  q?: ContactSubmissionSearchParamValue;
};

export type ContactSubmissionFilterField = "status";

export type AdminContactSubmissionQueryState = {
  filterField: ContactSubmissionFilterField;
  filterValue: ContactSubmissionStatus | "";
  query: string;
};

export type AdminContactSubmissionListItem = {
  id: string;
  name: string;
  email: string;
  company: string | null;
  message: string;
  status: ContactSubmissionStatus;
  createdAt: Date | string;
};

export type ContactSubmissionHrefOptions = {
  filterField?: ContactSubmissionFilterField;
  filterValue?: ContactSubmissionStatus | "";
  query?: string;
};

function firstParamValue(value?: ContactSubmissionSearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseAdminContactSubmissionSearchParams(
  params: AdminContactSubmissionPageSearchParams,
): AdminContactSubmissionQueryState {
  const parsed = adminContactSubmissionSearchParamsSchema.parse({
    filterField: firstParamValue(params.filterField),
    filterValue: firstParamValue(params.filterValue),
    q: firstParamValue(params.q),
  });

  return {
    filterField: "status",
    filterValue: parsed.filterField === "status" ? parsed.filterValue : "",
    query: parsed.q,
  };
}
