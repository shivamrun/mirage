export type CacheValidator<T> = (value: unknown) => T;

export function serializeCacheValue(value: unknown) {
  return JSON.stringify(value);
}

export function deserializeCacheValue<T>(
  value: string,
  validator?: CacheValidator<T>,
): T {
  const parsed = JSON.parse(value) as unknown;

  return validator ? validator(parsed) : (parsed as T);
}
