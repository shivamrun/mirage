"use client";

import { useEffect, useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type {
  AdminUsersQueryState,
  FilterField,
  FilterOperator,
} from "./query";
import {
  ADMIN_USERS_FILTER_FIELDS,
  getAdminUsersFilterFieldConfig,
  getAdminUsersFilterOperatorLabel,
  getAdminUsersFilterOperatorOptions,
  getDefaultAdminUsersFilterOperator,
} from "./query";

type AdminUsersFilterControlsProps = {
  state: AdminUsersQueryState;
};

const noFilterValue = "__any";

function getControlValue(value: string) {
  return value || noFilterValue;
}

function getFilterValue(value: string) {
  return value === noFilterValue ? "" : value;
}

export function AdminUsersFilterControls({
  state,
}: AdminUsersFilterControlsProps) {
  const [field, setField] = useState<FilterField>(state.filterField);
  const [operator, setOperator] = useState<FilterOperator>(
    state.filterOperator,
  );
  const [filterValue, setFilterValue] = useState(state.filterValue);

  useEffect(() => {
    setField(state.filterField);
    setOperator(state.filterOperator);
    setFilterValue(state.filterValue);
  }, [state.filterField, state.filterOperator, state.filterValue]);

  const fieldConfig = getAdminUsersFilterFieldConfig(field);
  const operatorOptions = useMemo(
    () => getAdminUsersFilterOperatorOptions(field),
    [field],
  );
  const hasSingleOperator = operatorOptions.length === 1;

  function handleFieldChange(value: string) {
    const nextField = value as FilterField;

    setField(nextField);
    setOperator(getDefaultAdminUsersFilterOperator(nextField));
    setFilterValue("");
  }

  function handleOperatorChange(value: string) {
    setOperator(value as FilterOperator);
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="filter-field"
            className="text-xs font-medium text-muted-foreground"
          >
            Field
          </label>

          <Select
            name="filterField"
            value={field}
            onValueChange={handleFieldChange}
          >
            <SelectTrigger id="filter-field" className="w-full">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              {ADMIN_USERS_FILTER_FIELDS.map((filterField) => (
                <SelectItem key={filterField.value} value={filterField.value}>
                  {filterField.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="filter-operator"
            className="text-xs font-medium text-muted-foreground"
          >
            Operator
          </label>

          <Select
            disabled={hasSingleOperator}
            name="filterOperator"
            value={operator}
            onValueChange={handleOperatorChange}
          >
            <SelectTrigger id="filter-operator" className="w-full">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              {operatorOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {getAdminUsersFilterOperatorLabel(field, option.value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="filter-value"
          className="text-xs font-medium text-muted-foreground"
        >
          Value
        </label>

        {fieldConfig.options ? (
          <Select
            name="filterValue"
            value={getControlValue(filterValue)}
            onValueChange={(value) => setFilterValue(getFilterValue(value))}
          >
            <SelectTrigger id="filter-value" className="w-full">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value={noFilterValue}>
                {fieldConfig.emptyLabel ?? "Any value"}
              </SelectItem>

              {fieldConfig.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            id="filter-value"
            name="filterValue"
            onChange={(event) => setFilterValue(event.target.value)}
            placeholder={fieldConfig.placeholder}
            type={fieldConfig.inputType ?? "text"}
            value={filterValue}
          />
        )}

        {operator === "in" || operator === "not_in" ? (
          <p className="text-xs text-muted-foreground">
            Separate multiple values with commas.
          </p>
        ) : null}
      </div>
    </>
  );
}
