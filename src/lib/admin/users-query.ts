import { authRoles } from "@/lib/auth/roles";
import {
  firstParamValue,
  formString,
  optionValueSet,
  rawHrefFromSearchParams,
  type SearchParamValue,
} from "./query-params";

export type { SearchParamValue } from "./query-params";

export const ADMIN_USERS_PAGE_PATH = "/admin/users";
export const ADMIN_USERS_PAGE_SIZE = 10;
export const DEFAULT_SEARCH_FIELD = "auto";
export const DEFAULT_SEARCH_OPERATOR = "contains";
export const DEFAULT_FILTER_FIELD = "role";
export const DEFAULT_SORT_BY = "createdAt";
export const DEFAULT_SORT_DIRECTION = "desc";

export const ADMIN_USERS_SEARCH_FIELD_VALUES = [
  "auto",
  "email",
  "name",
] as const;
export const ADMIN_USERS_SEARCH_OPERATOR_VALUES = [
  "contains",
  "starts_with",
  "ends_with",
] as const;
export const ADMIN_USERS_FILTER_FIELD_VALUES = [
  "id",
  "name",
  "email",
  "emailVerified",
  "image",
  "role",
  "banned",
  "banReason",
  "banExpires",
  "createdAt",
  "updatedAt",
] as const;
export const ADMIN_USERS_FILTER_OPERATOR_VALUES = [
  "eq",
  "ne",
  "lt",
  "lte",
  "gt",
  "gte",
  "in",
  "not_in",
  "contains",
  "starts_with",
  "ends_with",
] as const;
export const ADMIN_USERS_SORT_FIELD_VALUES = [
  "id",
  "name",
  "email",
  "emailVerified",
  "role",
  "banned",
  "banReason",
  "banExpires",
  "createdAt",
  "updatedAt",
] as const;
export const ADMIN_USERS_ROLE_FILTER_VALUES = authRoles;
export const ADMIN_USERS_BOOLEAN_FILTER_VALUES = ["true", "false"] as const;

export type SearchField = (typeof ADMIN_USERS_SEARCH_FIELD_VALUES)[number];
export type SearchOperator =
  (typeof ADMIN_USERS_SEARCH_OPERATOR_VALUES)[number];
export type FilterField = (typeof ADMIN_USERS_FILTER_FIELD_VALUES)[number];
export type FilterOperator =
  (typeof ADMIN_USERS_FILTER_OPERATOR_VALUES)[number];
export type RoleFilterValue = (typeof ADMIN_USERS_ROLE_FILTER_VALUES)[number];
export type SortField = (typeof ADMIN_USERS_SORT_FIELD_VALUES)[number];

export type SortDirection = "asc" | "desc";

export type FilterValueKind = "boolean" | "date" | "role" | "text";

export type AdminUsersFilterFieldConfig = {
  value: FilterField;
  valueKind: FilterValueKind;
  operators: readonly FilterOperator[];
  defaultOperator: FilterOperator;
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
    valueKind: "text",
    operators: textFilterOperators,
    defaultOperator: "contains",
  },
  name: {
    value: "name",
    valueKind: "text",
    operators: textFilterOperators,
    defaultOperator: "contains",
  },
  email: {
    value: "email",
    valueKind: "text",
    operators: textFilterOperators,
    defaultOperator: "contains",
  },
  emailVerified: {
    value: "emailVerified",
    valueKind: "boolean",
    operators: booleanFilterOperators,
    defaultOperator: "eq",
  },
  image: {
    value: "image",
    valueKind: "text",
    operators: textFilterOperators,
    defaultOperator: "contains",
  },
  role: {
    value: "role",
    valueKind: "role",
    operators: roleFilterOperators,
    defaultOperator: "eq",
  },
  banned: {
    value: "banned",
    valueKind: "boolean",
    operators: booleanFilterOperators,
    defaultOperator: "eq",
  },
  banReason: {
    value: "banReason",
    valueKind: "text",
    operators: textFilterOperators,
    defaultOperator: "contains",
  },
  banExpires: {
    value: "banExpires",
    valueKind: "date",
    operators: dateFilterOperators,
    defaultOperator: "gte",
  },
  createdAt: {
    value: "createdAt",
    valueKind: "date",
    operators: dateFilterOperators,
    defaultOperator: "gte",
  },
  updatedAt: {
    value: "updatedAt",
    valueKind: "date",
    operators: dateFilterOperators,
    defaultOperator: "gte",
  },
} as const satisfies Record<FilterField, AdminUsersFilterFieldConfig>;

const dateFilterPattern = /^\d{4}-\d{2}-\d{2}$/;
const roleFilterValues = optionValueSet(ADMIN_USERS_ROLE_FILTER_VALUES);

function parsePage(value?: SearchParamValue) {
  const pageValue = firstParamValue(value);
  const page = Number(pageValue);

  return Number.isInteger(page) && page > 0 ? page : 1;
}

const searchFieldValues = optionValueSet(ADMIN_USERS_SEARCH_FIELD_VALUES);
const searchOperatorValues = optionValueSet(ADMIN_USERS_SEARCH_OPERATOR_VALUES);
const filterFieldValues = optionValueSet(ADMIN_USERS_FILTER_FIELD_VALUES);
const filterOperatorValues = optionValueSet(ADMIN_USERS_FILTER_OPERATOR_VALUES);
const sortFieldValues = optionValueSet(ADMIN_USERS_SORT_FIELD_VALUES);

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

  return ADMIN_USERS_FILTER_OPERATOR_VALUES.filter((operator) =>
    fieldConfig.operators.includes(operator),
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

export type UsersHrefOptions = {
  page?: number;
  query?: string;
  searchField?: AdminUsersQueryState["searchField"];
  searchOperator?: AdminUsersQueryState["searchOperator"];

  filterField?: AdminUsersQueryState["filterField"];
  filterValue?: string;
  filterOperator?: AdminUsersQueryState["filterOperator"];

  sortBy?: AdminUsersQueryState["sortBy"];
  sortDirection?: AdminUsersQueryState["sortDirection"];
};

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
  return rawHrefFromSearchParams(ADMIN_USERS_PAGE_PATH, params);
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
