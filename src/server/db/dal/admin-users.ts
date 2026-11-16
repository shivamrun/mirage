import { paginateDrizzle } from "@evensurface/paginate-drizzle";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  ne,
  notInArray,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type {
  AdminUsersQueryState,
  FilterField,
  FilterOperator,
  SearchOperator,
  SortField,
} from "@/features/admin/query/users-query";
import type { RoleValue } from "@/features/auth/roles";
import db from "@/server/db";
import { user as userTable } from "@/server/db/schema";

type ListAdminUsersOptions = {
  limit: number;
  page: number;
  state: AdminUsersQueryState;
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

type TextFilterField = Exclude<
  FilterField,
  "banned" | "banExpires" | "createdAt" | "emailVerified" | "updatedAt"
>;

type DateFilterField = Extract<
  FilterField,
  "banExpires" | "createdAt" | "updatedAt"
>;

const textFilterColumns = {
  banReason: userTable.banReason,
  email: userTable.email,
  id: userTable.id,
  image: userTable.image,
  name: userTable.name,
  role: userTable.role,
} satisfies Record<TextFilterField, AnyPgColumn>;

const dateFilterColumns = {
  banExpires: userTable.banExpires,
  createdAt: userTable.createdAt,
  updatedAt: userTable.updatedAt,
} satisfies Record<DateFilterField, AnyPgColumn>;

const sortColumns = {
  banExpires: userTable.banExpires,
  banReason: userTable.banReason,
  banned: userTable.banned,
  createdAt: userTable.createdAt,
  email: userTable.email,
  emailVerified: userTable.emailVerified,
  id: userTable.id,
  name: userTable.name,
  role: userTable.role,
  updatedAt: userTable.updatedAt,
} satisfies Record<SortField, AnyPgColumn>;

const userListSelection = {
  banExpires: userTable.banExpires,
  banReason: userTable.banReason,
  banned: userTable.banned,
  createdAt: userTable.createdAt,
  email: userTable.email,
  emailVerified: userTable.emailVerified,
  id: userTable.id,
  image: userTable.image,
  name: userTable.name,
  role: userTable.role,
  updatedAt: userTable.updatedAt,
};

function getTextFilterPattern(value: string, operator: SearchOperator) {
  if (operator === "starts_with") {
    return `${value}%`;
  }

  if (operator === "ends_with") {
    return `%${value}`;
  }

  return `%${value}%`;
}

function getListSearchCondition(state: AdminUsersQueryState) {
  if (!state.query) {
    return;
  }

  const searchColumn =
    state.searchField === "email" || state.query.includes("@")
      ? userTable.email
      : userTable.name;

  return ilike(
    searchColumn,
    getTextFilterPattern(state.query, state.searchOperator),
  );
}

function getBooleanFilterCondition(
  field: Extract<FilterField, "banned" | "emailVerified">,
  value: string,
  operator: FilterOperator,
) {
  const filterValue = value === "true";
  const column =
    field === "banned" ? userTable.banned : userTable.emailVerified;

  return operator === "ne" ? ne(column, filterValue) : eq(column, filterValue);
}

function getDateFilterWindow(value: string) {
  const startsAt = new Date(`${value}T00:00:00.000Z`);
  const endsAt = new Date(startsAt);

  endsAt.setUTCHours(23, 59, 59, 999);

  return {
    endsAt,
    startsAt,
  };
}

function getDateFilterCondition(
  field: DateFilterField,
  value: string,
  operator: FilterOperator,
) {
  const column = dateFilterColumns[field];
  const { endsAt, startsAt } = getDateFilterWindow(value);

  switch (operator) {
    case "eq":
      return and(gte(column, startsAt), lte(column, endsAt));
    case "ne":
      return or(lt(column, startsAt), gt(column, endsAt));
    case "lt":
      return lt(column, startsAt);
    case "lte":
      return lte(column, endsAt);
    case "gt":
      return gt(column, endsAt);
    case "gte":
      return gte(column, startsAt);
    default:
      return;
  }
}

function getRoleFilterCondition(value: string) {
  return sql`concat(',', coalesce(${userTable.role}, ''), ',') like ${`%,${value},%`}`;
}

function getTextFilterCondition(
  field: TextFilterField,
  value: string,
  operator: FilterOperator,
) {
  if (field === "role") {
    return getRoleFilterCondition(value);
  }

  const column = textFilterColumns[field];

  switch (operator) {
    case "contains":
      return ilike(column, `%${value}%`);
    case "starts_with":
      return ilike(column, `${value}%`);
    case "ends_with":
      return ilike(column, `%${value}`);
    case "eq":
      return eq(column, value);
    case "ne":
      return ne(column, value);
    case "in":
      return inArray(column, value.split(",").filter(Boolean));
    case "not_in":
      return notInArray(column, value.split(",").filter(Boolean));
    default:
      return;
  }
}

function getListFilterCondition(state: AdminUsersQueryState) {
  if (!state.filterValue) {
    return;
  }

  if (state.filterField === "banned" || state.filterField === "emailVerified") {
    return getBooleanFilterCondition(
      state.filterField,
      state.filterValue,
      state.filterOperator,
    );
  }

  if (
    state.filterField === "banExpires" ||
    state.filterField === "createdAt" ||
    state.filterField === "updatedAt"
  ) {
    return getDateFilterCondition(
      state.filterField,
      state.filterValue,
      state.filterOperator,
    );
  }

  return getTextFilterCondition(
    state.filterField,
    state.filterValue,
    state.filterOperator,
  );
}

function getWhereClause(state: AdminUsersQueryState) {
  const conditions = [
    getListSearchCondition(state),
    getListFilterCondition(state),
  ].filter((condition): condition is SQL => Boolean(condition));

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export async function listAdminUsers({
  limit,
  page,
  state,
}: ListAdminUsersOptions) {
  const whereClause = getWhereClause(state);
  const sortColumn = sortColumns[state.sortBy];
  const sortDirection = state.sortDirection === "asc" ? asc : desc;
  const result = await paginateDrizzle({
    countQuery: db.$count(userTable, whereClause),
    limit,
    page,
    query: () =>
      db
        .select(userListSelection)
        .from(userTable)
        .where(whereClause)
        .orderBy(sortDirection(sortColumn), asc(userTable.id)),
  });

  return {
    items: result.items.map((user) => user satisfies AdminUserListItem),
    pagination: result.pagination,
  };
}
