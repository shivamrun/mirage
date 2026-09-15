export type SearchParamValue = string | string[] | undefined;
export type SearchParamsRecord = Record<string, SearchParamValue>;

export function firstParamValue(value?: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

export function allParamValues(value?: SearchParamValue) {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export function formString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : undefined;
}

export function rawHrefFromSearchParams(
  path: string,
  params: SearchParamsRecord,
) {
  const searchParams = new URLSearchParams();

  for (const [key, paramValue] of Object.entries(params)) {
    for (const value of allParamValues(paramValue)) {
      searchParams.append(key, value);
    }
  }

  const search = searchParams.toString();

  return search ? `${path}?${search}` : path;
}

export function optionValueSet<const T extends readonly string[]>(options: T) {
  return new Set<string>(options);
}
