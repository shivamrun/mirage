import { authRoles, type RoleValue } from "@/lib/auth/roles";

export const ADMIN_USERS_PAGE_PATH = "/admin/users";
export const ADMIN_USERS_PAGE_SIZE = 10;
export const DEFAULT_SEARCH_FIELD = "auto";
export const DEFAULT_SEARCH_OPERATOR = "contains";
export const DEFAULT_FILTER_FIELD = "role";
export const DEFAULT_SORT_BY = "createdAt";
export const DEFAULT_SORT_DIRECTION = "desc";

export const ADMIN_USERS_SEARCH_FIELDS = [
  { label: "Auto", value: "auto" },
  { label: "Email", value: "email" },
  { label: "Name", value: "name" },
] as const;

export const ADMIN_USERS_SEARCH_OPERATORS = [
  { label: "Contains", value: "contains" },
  { label: "Starts with", value: "starts_with" },
  { label: "Ends with", value: "ends_with" },
] as const;

export const ADMIN_USERS_FILTER_FIELDS = [
  { label: "ID", value: "id" },
  { label: "Name", value: "name" },
  { label: "Email", value: "email" },
  { label: "Email verified", value: "emailVerified" },
  { label: "Image", value: "image" },
  { label: "Role", value: "role" },
  { label: "Banned", value: "banned" },
  { label: "Ban reason", value: "banReason" },
  { label: "Ban expires", value: "banExpires" },
  { label: "Joined", value: "createdAt" },
  { label: "Updated", value: "updatedAt" },
] as const;

export const ADMIN_USERS_FILTER_OPERATORS = [
  { label: "Equals", value: "eq" },
  { label: "Does not equal", value: "ne" },
  { label: "Less than", value: "lt" },
  { label: "Less than or equal", value: "lte" },
  { label: "Greater than", value: "gt" },
  { label: "Greater than or equal", value: "gte" },
  { label: "In", value: "in" },
  { label: "Not in", value: "not_in" },
  { label: "Contains", value: "contains" },
  { label: "Starts with", value: "starts_with" },
  { label: "Ends with", value: "ends_with" },
] as const;

export const ADMIN_USERS_ROLE_FILTER_VALUES = authRoles.map((role) => ({
  label: role
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase()),
  value: role,
}));

export const ADMIN_USERS_BOOLEAN_FILTER_VALUES = [
  { label: "True", value: "true" },
  { label: "False", value: "false" },
] as const;

export const ADMIN_USERS_SORT_FIELDS = [
  { label: "ID", value: "id" },
  { label: "Name", value: "name" },
  { label: "Email", value: "email" },
  { label: "Email verified", value: "emailVerified" },
  { label: "Role", value: "role" },
  { label: "Banned", value: "banned" },
  { label: "Ban reason", value: "banReason" },
  { label: "Ban expires", value: "banExpires" },
  { label: "Joined", value: "createdAt" },
  { label: "Updated", value: "updatedAt" },
] as const;

export type SearchField = (typeof ADMIN_USERS_SEARCH_FIELDS)[number]["value"];
export type SearchOperator =
  (typeof ADMIN_USERS_SEARCH_OPERATORS)[number]["value"];
export type FilterField = (typeof ADMIN_USERS_FILTER_FIELDS)[number]["value"];
export type FilterOperator =
  (typeof ADMIN_USERS_FILTER_OPERATORS)[number]["value"];
export type RoleFilterValue =
  (typeof ADMIN_USERS_ROLE_FILTER_VALUES)[number]["value"];
export type SortField = (typeof ADMIN_USERS_SORT_FIELDS)[number]["value"];

export type SortDirection = "asc" | "desc";
export type SearchParamValue = string | string[] | undefined;

export type FilterValueKind = "boolean" | "date" | "role" | "text";

export type AdminUsersFilterValueOption = {
  label: string;
  value: string;
};

export type AdminUsersFilterFieldConfig = {
  value: FilterField;
  label: string;
  valueKind: FilterValueKind;
  operators: readonly FilterOperator[];
  defaultOperator: FilterOperator;
  inputType?: "date" | "email" | "text" | "url";
  placeholder: string;
  emptyLabel?: string;
  options?: readonly AdminUsersFilterValueOption[];
};

export type AdminUsersPageSearchParams = {
  [key: string]: SearchParamValue;

  page?: SearchParamValue;
  q?: SearchParamValue;
  searchField?: SearchParamValue;
  searchOperator?: SearchParamValue;

  filterField?: SearchParamValue;
  filterValue?: SearchParamValue;
  filterOperator?: SearchParamValue;

  sortBy?: SearchParamValue;
  sortDirection?: SearchParamValue;
};

export type AdminUsersQueryState = {
  query: string;
  searchField: SearchField;
  searchOperator: SearchOperator;

  filterField: FilterField;
  filterValue: string;
  filterOperator: FilterOperator;

  sortBy: SortField;
  sortDirection: SortDirection;
};

export type ParsedAdminUsersSearchParams = AdminUsersQueryState & {
  page: number;
};

export type AdminUsersFilterStatus = {
  hasSearchOptions: boolean;
  hasFilter: boolean;
  hasCustomSort: boolean;
  hasFilters: boolean;
  activeCount: number;
};

export type AdminUserListItem = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: null | string;
  role?: RoleValue;
  banned?: boolean | null;
  banReason?: null | string;
  banExpires?: Date | string | null;
  createdAt: Date | string;
  updatedAt?: Date | string;
};

export type UsersHrefOptions = {
  page?: number;
  query?: string;
  searchField?: SearchField;
  searchOperator?: SearchOperator;

  filterField?: FilterField;
  filterValue?: string;
  filterOperator?: FilterOperator;

  sortBy?: SortField;
  sortDirection?: SortDirection;
};

const textFilterOperators = [
  "eq",
  "ne",
  "in",
  "not_in",
  "contains",
  "starts_with",
  "ends_with",
] as const satisfies readonly FilterOperator[];

const booleanFilterOperators = [
  "eq",
  "ne",
] as const satisfies readonly FilterOperator[];

const dateFilterOperators = [
  "eq",
  "ne",
  "lt",
  "lte",
  "gt",
  "gte",
] as const satisfies readonly FilterOperator[];

const roleFilterOperators = ["eq"] as const satisfies readonly FilterOperator[];

export const ADMIN_USERS_FILTER_FIELD_CONFIGS = {
  id: {
    value: "id",
    label: "ID",
    valueKind: "text",
    operators: textFilterOperators,
    defaultOperator: "contains",
    inputType: "text",
    placeholder: "User ID",
  },
  name: {
    value: "name",
    label: "Name",
    valueKind: "text",
    operators: textFilterOperators,
    defaultOperator: "contains",
    inputType: "text",
    placeholder: "Jane Doe",
  },
  email: {
    value: "email",
    label: "Email",
    valueKind: "text",
    operators: textFilterOperators,
    defaultOperator: "contains",
    inputType: "text",
    placeholder: "jane@example.com",
  },
  emailVerified: {
    value: "emailVerified",
    label: "Email verified",
    valueKind: "boolean",
    operators: booleanFilterOperators,
    defaultOperator: "eq",
    placeholder: "true",
    emptyLabel: "Any verification state",
    options: ADMIN_USERS_BOOLEAN_FILTER_VALUES,
  },
  image: {
    value: "image",
    label: "Image",
    valueKind: "text",
    operators: textFilterOperators,
    defaultOperator: "contains",
    inputType: "text",
    placeholder: "https://example.com/avatar.png",
  },
  role: {
    value: "role",
    label: "Role",
    valueKind: "role",
    operators: roleFilterOperators,
    defaultOperator: "eq",
    placeholder: "admin",
    emptyLabel: "Any role",
    options: ADMIN_USERS_ROLE_FILTER_VALUES,
  },
  banned: {
    value: "banned",
    label: "Banned",
    valueKind: "boolean",
    operators: booleanFilterOperators,
    defaultOperator: "eq",
    placeholder: "true",
    emptyLabel: "Any ban state",
    options: ADMIN_USERS_BOOLEAN_FILTER_VALUES,
  },
  banReason: {
    value: "banReason",
    label: "Ban reason",
    valueKind: "text",
    operators: textFilterOperators,
    defaultOperator: "contains",
    inputType: "text",
    placeholder: "Spam, abuse, chargeback...",
  },
  banExpires: {
    value: "banExpires",
    label: "Ban expires",
    valueKind: "date",
    operators: dateFilterOperators,
    defaultOperator: "gte",
    inputType: "date",
    placeholder: "2026-08-31",
  },
  createdAt: {
    value: "createdAt",
    label: "Joined",
    valueKind: "date",
    operators: dateFilterOperators,
    defaultOperator: "gte",
    inputType: "date",
    placeholder: "2026-08-31",
  },
  updatedAt: {
    value: "updatedAt",
    label: "Updated",
    valueKind: "date",
    operators: dateFilterOperators,
    defaultOperator: "gte",
    inputType: "date",
    placeholder: "2026-08-31",
  },
} as const satisfies Record<FilterField, AdminUsersFilterFieldConfig>;

const dateFilterPattern = /^\d{4}-\d{2}-\d{2}$/;
const roleFilterValues = optionValueSet(ADMIN_USERS_ROLE_FILTER_VALUES);

function firstParamValue(value?: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function allParamValues(value?: SearchParamValue) {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function parsePage(value?: SearchParamValue) {
  const pageValue = firstParamValue(value);
  const page = Number(pageValue);

  return Number.isInteger(page) && page > 0 ? page : 1;
}

function optionValueSet<const T extends readonly { value: string }[]>(
  options: T,
) {
  return new Set<string>(options.map((option) => option.value));
}

const searchFieldValues = optionValueSet(ADMIN_USERS_SEARCH_FIELDS);
const searchOperatorValues = optionValueSet(ADMIN_USERS_SEARCH_OPERATORS);
const filterFieldValues = optionValueSet(ADMIN_USERS_FILTER_FIELDS);
const filterOperatorValues = optionValueSet(ADMIN_USERS_FILTER_OPERATORS);
const sortFieldValues = optionValueSet(ADMIN_USERS_SORT_FIELDS);

export function getAdminUsersFilterFieldConfig(
  field: FilterField,
): AdminUsersFilterFieldConfig {
  return ADMIN_USERS_FILTER_FIELD_CONFIGS[field];
}

export function getDefaultAdminUsersFilterOperator(field: FilterField) {
  return getAdminUsersFilterFieldConfig(field).defaultOperator;
}

export function getAdminUsersFilterOperatorOptions(field: FilterField) {
  const fieldConfig = getAdminUsersFilterFieldConfig(field);

  return ADMIN_USERS_FILTER_OPERATORS.filter((operator) =>
    fieldConfig.operators.includes(operator.value),
  );
}

export function getAdminUsersFilterOperatorLabel(
  field: FilterField,
  operator: FilterOperator,
) {
  if (field === "role" && operator === "eq") {
    return "Has role";
  }

  return (
    ADMIN_USERS_FILTER_OPERATORS.find((option) => option.value === operator)
      ?.label ?? operator
  );
}

function parseSearchField(value?: SearchParamValue): SearchField {
  const searchField = firstParamValue(value);

  return searchField && searchFieldValues.has(searchField)
    ? (searchField as SearchField)
    : DEFAULT_SEARCH_FIELD;
}

function parseSearchOperator(value?: SearchParamValue): SearchOperator {
  const searchOperator = firstParamValue(value);

  return searchOperator && searchOperatorValues.has(searchOperator)
    ? (searchOperator as SearchOperator)
    : DEFAULT_SEARCH_OPERATOR;
}

function parseFilterField(value?: SearchParamValue): FilterField {
  const filterField = firstParamValue(value);

  return filterField && filterFieldValues.has(filterField)
    ? (filterField as FilterField)
    : DEFAULT_FILTER_FIELD;
}

function parseFilterOperator(
  field: FilterField,
  value?: SearchParamValue,
): FilterOperator {
  const filterOperator = firstParamValue(value);
  const fieldConfig = getAdminUsersFilterFieldConfig(field);

  return filterOperator &&
    filterOperatorValues.has(filterOperator) &&
    fieldConfig.operators.includes(filterOperator as FilterOperator)
    ? (filterOperator as FilterOperator)
    : fieldConfig.defaultOperator;
}

function parseSortBy(value?: SearchParamValue): SortField {
  const sortBy = firstParamValue(value);

  return sortBy && sortFieldValues.has(sortBy)
    ? (sortBy as SortField)
    : DEFAULT_SORT_BY;
}

function parseSortDirection(value?: SearchParamValue): SortDirection {
  return firstParamValue(value) === "asc" ? "asc" : "desc";
}

function normalizeTextFilterValue(value: string, operator: FilterOperator) {
  const trimmedValue = value.trim();

  if (operator === "in" || operator === "not_in") {
    return trimmedValue
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .join(",");
  }

  return trimmedValue;
}

function normalizeDateFilterValue(value: string) {
  const trimmedValue = value.trim();

  if (!dateFilterPattern.test(trimmedValue)) {
    return "";
  }

  const dateValue = new Date(`${trimmedValue}T00:00:00.000Z`);

  return Number.isNaN(dateValue.getTime()) ||
    !dateValue.toISOString().startsWith(trimmedValue)
    ? ""
    : trimmedValue;
}

function parseFilterValue(
  field: FilterField,
  operator: FilterOperator,
  value?: SearchParamValue,
) {
  const filterValue = firstParamValue(value)?.trim() ?? "";

  if (!filterValue) {
    return "";
  }

  const fieldConfig = getAdminUsersFilterFieldConfig(field);

  if (fieldConfig.valueKind === "boolean") {
    return filterValue === "true" || filterValue === "false" ? filterValue : "";
  }

  if (fieldConfig.valueKind === "date") {
    return normalizeDateFilterValue(filterValue);
  }

  if (fieldConfig.valueKind === "role") {
    return roleFilterValues.has(filterValue) ? filterValue : "";
  }

  return normalizeTextFilterValue(filterValue, operator);
}

export function parseAdminUsersSearchParams(
  params: AdminUsersPageSearchParams,
): ParsedAdminUsersSearchParams {
  const filterField = parseFilterField(params.filterField);
  const filterOperator = parseFilterOperator(
    filterField,
    params.filterOperator,
  );

  return {
    page: parsePage(params.page),
    query: firstParamValue(params.q)?.trim() ?? "",
    searchField: parseSearchField(params.searchField),
    searchOperator: parseSearchOperator(params.searchOperator),
    filterField,
    filterValue: parseFilterValue(
      filterField,
      filterOperator,
      params.filterValue,
    ),
    filterOperator,
    sortBy: parseSortBy(params.sortBy),
    sortDirection: parseSortDirection(params.sortDirection),
  };
}

export function getAdminUsersFilterStatus({
  filterValue,
  query,
  searchField,
  searchOperator,
  sortBy,
  sortDirection,
}: AdminUsersQueryState): AdminUsersFilterStatus {
  const hasSearchOptions =
    Boolean(query) &&
    (searchField !== DEFAULT_SEARCH_FIELD ||
      searchOperator !== DEFAULT_SEARCH_OPERATOR);
  const hasFilter = Boolean(filterValue);
  const hasCustomSort =
    sortBy !== DEFAULT_SORT_BY || sortDirection !== DEFAULT_SORT_DIRECTION;

  return {
    hasSearchOptions,
    hasFilter,
    hasCustomSort,
    hasFilters: hasSearchOptions || hasFilter || hasCustomSort,
    activeCount:
      Number(hasSearchOptions) + Number(hasFilter) + Number(hasCustomSort),
  };
}

export function usersPageHref({
  page = 1,
  query,
  searchField,
  searchOperator,

  filterField,
  filterValue,
  filterOperator,

  sortBy,
  sortDirection,
}: UsersHrefOptions) {
  const params = new URLSearchParams();

  if (page > 1) {
    params.set("page", String(page));
  }

  if (query) {
    params.set("q", query);

    if (searchField && searchField !== DEFAULT_SEARCH_FIELD) {
      params.set("searchField", searchField);
    }

    if (searchOperator && searchOperator !== DEFAULT_SEARCH_OPERATOR) {
      params.set("searchOperator", searchOperator);
    }
  }

  if (filterField && filterValue) {
    params.set("filterField", filterField);
    params.set("filterValue", filterValue);

    if (
      filterOperator &&
      filterOperator !== getDefaultAdminUsersFilterOperator(filterField)
    ) {
      params.set("filterOperator", filterOperator);
    }
  }

  if (sortBy && sortBy !== DEFAULT_SORT_BY) {
    params.set("sortBy", sortBy);
  }

  if (sortDirection && sortDirection !== DEFAULT_SORT_DIRECTION) {
    params.set("sortDirection", sortDirection);
  }

  const search = params.toString();

  return search ? `${ADMIN_USERS_PAGE_PATH}?${search}` : ADMIN_USERS_PAGE_PATH;
}

function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : undefined;
}

export function adminUsersHrefFromFormData(formData: FormData) {
  const state = parseAdminUsersSearchParams({
    q: formString(formData, "q"),
    searchField: formString(formData, "searchField"),
    searchOperator: formString(formData, "searchOperator"),
    filterField: formString(formData, "filterField"),
    filterValue: formString(formData, "filterValue"),
    filterOperator: formString(formData, "filterOperator"),
    sortBy: formString(formData, "sortBy"),
    sortDirection: formString(formData, "sortDirection"),
  });

  return usersPageHref({
    query: state.query,
    searchField: state.searchField,
    searchOperator: state.searchOperator,
    filterField: state.filterField,
    filterValue: state.filterValue,
    filterOperator: state.filterOperator,
    sortBy: state.sortBy,
    sortDirection: state.sortDirection,
  });
}

export function adminUsersRawHrefFromSearchParams(
  params: AdminUsersPageSearchParams,
) {
  const searchParams = new URLSearchParams();

  for (const [key, paramValue] of Object.entries(params)) {
    for (const value of allParamValues(paramValue)) {
      searchParams.append(key, value);
    }
  }

  const search = searchParams.toString();

  return search ? `${ADMIN_USERS_PAGE_PATH}?${search}` : ADMIN_USERS_PAGE_PATH;
}

export function adminUsersHrefFromSearchParams(
  params: AdminUsersPageSearchParams,
) {
  const { page, ...state } = parseAdminUsersSearchParams(params);

  return usersPageHref({
    page,
    ...state,
  });
}
