import {
  ADMIN_USERS_FILTER_FIELD_VALUES,
  ADMIN_USERS_FILTER_OPERATOR_VALUES,
  ADMIN_USERS_SEARCH_FIELD_VALUES,
  ADMIN_USERS_SEARCH_OPERATOR_VALUES,
  ADMIN_USERS_SORT_FIELD_VALUES,
  ADMIN_USERS_BOOLEAN_FILTER_VALUES as BOOLEAN_FILTER_VALUES,
  type FilterField,
  type FilterOperator,
  type FilterValueKind,
  getAdminUsersFilterFieldConfig,
  getAdminUsersFilterOperatorOptions,
  ADMIN_USERS_ROLE_FILTER_VALUES as ROLE_FILTER_VALUES,
} from "@/features/admin/query/users-query";

export type AdminUsersFilterValueOption = {
  label: string;
  value: string;
};

export type AdminUsersFilterControlConfig = {
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

const fieldLabels = {
  id: "ID",
  name: "Name",
  email: "Email",
  emailVerified: "Email verified",
  image: "Image",
  role: "Role",
  banned: "Banned",
  banReason: "Ban reason",
  banExpires: "Ban expires",
  createdAt: "Joined",
  updatedAt: "Updated",
} as const satisfies Record<FilterField, string>;

const operatorLabels = {
  eq: "Equals",
  ne: "Does not equal",
  lt: "Less than",
  lte: "Less than or equal",
  gt: "Greater than",
  gte: "Greater than or equal",
  in: "In",
  not_in: "Not in",
  contains: "Contains",
  starts_with: "Starts with",
  ends_with: "Ends with",
} as const satisfies Record<FilterOperator, string>;

const placeholders = {
  id: "User ID",
  name: "Jane Doe",
  email: "jane@example.com",
  emailVerified: "true",
  image: "avatars/example.jpg",
  role: "admin",
  banned: "true",
  banReason: "Spam, abuse, chargeback...",
  banExpires: "2026-08-31",
  createdAt: "2026-08-31",
  updatedAt: "2026-08-31",
} as const satisfies Record<FilterField, string>;

const inputTypes = {
  id: "text",
  name: "text",
  email: "text",
  image: "text",
  banReason: "text",
  banExpires: "date",
  createdAt: "date",
  updatedAt: "date",
} as const satisfies Partial<Record<FilterField, "date" | "text">>;

export const ADMIN_USERS_SEARCH_FIELDS = ADMIN_USERS_SEARCH_FIELD_VALUES.map(
  (value) => ({
    label: value === "auto" ? "Auto" : fieldLabels[value],
    value,
  }),
);

export const ADMIN_USERS_SEARCH_OPERATORS =
  ADMIN_USERS_SEARCH_OPERATOR_VALUES.map((value) => ({
    label: operatorLabels[value],
    value,
  }));

export const ADMIN_USERS_FILTER_FIELDS = ADMIN_USERS_FILTER_FIELD_VALUES.map(
  (value) => ({
    label: fieldLabels[value],
    value,
  }),
);

export const ADMIN_USERS_FILTER_OPERATORS =
  ADMIN_USERS_FILTER_OPERATOR_VALUES.map((value) => ({
    label: operatorLabels[value],
    value,
  }));

export const ADMIN_USERS_ROLE_FILTER_VALUES = ROLE_FILTER_VALUES.map(
  (role) => ({
    label: role
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase()),
    value: role,
  }),
);

export const ADMIN_USERS_BOOLEAN_FILTER_VALUES = BOOLEAN_FILTER_VALUES.map(
  (value) => ({
    label: value === "true" ? "True" : "False",
    value,
  }),
);

export const ADMIN_USERS_SORT_FIELDS = ADMIN_USERS_SORT_FIELD_VALUES.map(
  (value) => ({
    label: fieldLabels[value],
    value,
  }),
);

export function getAdminUsersFilterControlConfig(
  field: FilterField,
): AdminUsersFilterControlConfig {
  const fieldConfig = getAdminUsersFilterFieldConfig(field);

  return {
    ...fieldConfig,
    emptyLabel: getEmptyLabel(field),
    inputType: getInputType(field),
    label: fieldLabels[field],
    options: getOptions(field),
    placeholder: placeholders[field],
  };
}

export function getAdminUsersFilterOperatorOptionsForControls(
  field: FilterField,
) {
  const operators = getAdminUsersFilterOperatorOptions(field);

  return ADMIN_USERS_FILTER_OPERATORS.filter((operator) =>
    operators.includes(operator.value),
  );
}

export function getAdminUsersFilterOperatorLabel(
  field: FilterField,
  operator: FilterOperator,
) {
  if (field === "role" && operator === "eq") {
    return "Has role";
  }

  return operatorLabels[operator];
}

function getEmptyLabel(field: FilterField) {
  if (field === "role") {
    return "Any role";
  }

  if (field === "banned") {
    return "Any ban state";
  }

  if (field === "emailVerified") {
    return "Any verification state";
  }
}

function getInputType(field: FilterField) {
  return field in inputTypes
    ? inputTypes[field as keyof typeof inputTypes]
    : undefined;
}

function getOptions(field: FilterField) {
  if (field === "role") {
    return ADMIN_USERS_ROLE_FILTER_VALUES;
  }

  if (field === "banned" || field === "emailVerified") {
    return ADMIN_USERS_BOOLEAN_FILTER_VALUES;
  }
}
