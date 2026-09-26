import { vi } from "vitest";

import { type CacheStore, cacheStore } from "@/adapters/cache";

function keyFor({ parts = [], policy }: { parts?: string[]; policy: string }) {
  return JSON.stringify([policy, parts]);
}

export function installMemoryCacheStore() {
  const entries = new Map<string, unknown>();
  const generations = new Map<string, number>();
  const spies = [
    vi.spyOn(cacheStore, "delete").mockImplementation(async (input) => {
      entries.delete(keyFor(input));
    }),
    vi.spyOn(cacheStore, "get").mockImplementation(async (input) => {
      const value = entries.get(keyFor(input));

      if (value === undefined) {
        return null;
      }

      return input.validator ? input.validator(value) : value;
    }) as unknown as { mockRestore(): void },
    vi.spyOn(cacheStore, "getGeneration").mockImplementation(async (input) => {
      return generations.get(keyFor(input)) ?? null;
    }),
    vi
      .spyOn(cacheStore, "incrementGeneration")
      .mockImplementation(async (input) => {
        const key = keyFor(input);
        const nextValue = (generations.get(key) ?? 0) + 1;
        generations.set(key, nextValue);

        return nextValue;
      }),
    vi.spyOn(cacheStore, "set").mockImplementation(async (input) => {
      entries.set(keyFor(input), input.value);
    }) as unknown as { mockRestore(): void },
  ];

  return {
    entries,
    generations,
    restore() {
      for (const spy of spies) {
        spy.mockRestore();
      }
    },
    store: cacheStore as CacheStore,
  };
}
