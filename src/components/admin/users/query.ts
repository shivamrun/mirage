import {
  type AdminUsersPageSearchParams,
  type AdminUsersQueryState,
  DEFAULT_SEARCH_FIELD,
  DEFAULT_SEARCH_OPERATOR,
  DEFAULT_SORT_BY,
  DEFAULT_SORT_DIRECTION,
  getDefaultAdminUsersFilterOperator,
  parseAdminUsersSearchParams,
  type SearchParamValue,
} from "@/lib/admin/users-query";

export {
  ADMIN_USERS_BOOLEAN_FILTER_VALUES,
  ADMIN_USERS_FILTER_FIELD_CONFIGS,
  ADMIN_USERS_FILTER_FIELDS,
  ADMIN_USERS_FILTER_OPERATORS,
  ADMIN_USERS_PAGE_SIZE,
  ADMIN_USERS_ROLE_FILTER_VALUES,
  ADMIN_USERS_SEARCH_FIELDS,
  ADMIN_USERS_SEARCH_OPERATORS,
  ADMIN_USERS_SORT_FIELDS,
  type AdminUserListItem,
  type AdminUsersFilterFieldConfig,
  type AdminUsersFilterStatus,
  type AdminUsersFilterValueOption,
  type AdminUsersPageSearchParams,
  type AdminUsersQueryState,
  DEFAULT_FILTER_FIELD,
  DEFAULT_SEARCH_FIELD,
  DEFAULT_SEARCH_OPERATOR,
  DEFAULT_SORT_BY,
  DEFAULT_SORT_DIRECTION,
  type FilterField,
  type FilterOperator,
  type FilterValueKind,
  getAdminUsersFilterFieldConfig,
  getAdminUsersFilterOperatorLabel,
  getAdminUsersFilterOperatorOptions,
  getAdminUsersFilterStatus,
  getDefaultAdminUsersFilterOperator,
  type ParsedAdminUsersSearchParams,
  parseAdminUsersSearchParams,
  type RoleFilterValue,
  type SearchField,
  type SearchOperator,
  type SearchParamValue,
  type SortDirection,
  type SortField,
} from "@/lib/admin/users-query";

export const ADMIN_USERS_PAGE_PATH = "/admin/users";

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

function allParamValues(value?: SearchParamValue) {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
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
