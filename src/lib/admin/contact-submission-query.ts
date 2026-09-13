export type ContactSubmissionSearchParamValue = string | string[] | undefined;

export type AdminContactSubmissionPageSearchParams = {
  [key: string]: ContactSubmissionSearchParamValue;

  filterField?: ContactSubmissionSearchParamValue;
  filterValue?: ContactSubmissionSearchParamValue;
  q?: ContactSubmissionSearchParamValue;
};

export type ContactSubmissionStatus = "new" | "read" | "archived";
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
  const filterValue = firstParamValue(params.filterValue);

  return {
    filterField: "status",
    filterValue:
      firstParamValue(params.filterField) === "status" &&
      (filterValue === "new" ||
        filterValue === "read" ||
        filterValue === "archived")
        ? filterValue
        : "",
    query: firstParamValue(params.q)?.trim() ?? "",
  };
}
