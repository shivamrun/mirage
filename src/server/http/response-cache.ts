import { Elysia, ElysiaCustomStatusResponse } from "elysia";

import {
  type CachePolicyName,
  type CacheValidator,
  cacheStore,
  getCachePolicy,
} from "@/adapters/cache";

type RouteCacheContext = {
  path: string;
  request: Request;
  route: string;
  set: {
    headers: Record<string, string>;
    status?: number | string;
  };
  status: unknown;
  authUser?: {
    id?: string;
    roles?: string[];
  };
  user?: {
    id?: string;
  };
};

type RouteCacheParts =
  | string[]
  | ((context: RouteCacheContext) => Promise<string[]> | string[]);

export type RouteCacheOption<T = unknown> = {
  generationParts?: RouteCacheParts;
  parts?: RouteCacheParts;
  policy: CachePolicyName;
  validator?: CacheValidator<T>;
};

type RouteCacheState = {
  hit: boolean;
  keyParts?: string[];
};

const routeCacheState = new WeakMap<Request, RouteCacheState>();

function isCacheableMethod(method: string) {
  return method === "GET" || method === "HEAD";
}

function normalizedQueryParts(request: Request) {
  const params = [...new URL(request.url).searchParams.entries()].sort(
    ([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue),
  );

  return params.map(([key, value]) => `query:${key}=${value}`);
}

async function resolveParts(
  parts: RouteCacheParts | undefined,
  context: RouteCacheContext,
) {
  if (!parts) {
    return [];
  }

  return typeof parts === "function" ? await parts(context) : parts;
}

function authenticatedUserId(context: RouteCacheContext) {
  return typeof context.user?.id === "string" && context.user.id.length > 0
    ? context.user.id
    : null;
}

function authenticatedAdminId(context: RouteCacheContext) {
  const adminUserId =
    typeof context.authUser?.id === "string" && context.authUser.id.length > 0
      ? context.authUser.id
      : null;
  const isAdmin = context.authUser?.roles?.includes("admin") ?? false;

  return adminUserId && isAdmin ? adminUserId : null;
}

async function cacheKeyParts<T>(
  option: RouteCacheOption<T>,
  context: RouteCacheContext,
) {
  const policy = getCachePolicy(option.policy);
  const userId = authenticatedUserId(context);
  const adminId = authenticatedAdminId(context);

  if (policy.privacy === "private" && !userId) {
    return null;
  }

  if (policy.privacy === "admin" && !adminId) {
    return null;
  }

  const privateParts = userId ? ["private-user", userId] : [];
  const adminParts = adminId ? ["admin-user", adminId] : [];
  const generationParts = await resolveParts(option.generationParts, context);
  const generation =
    generationParts.length > 0
      ? await cacheStore.getGeneration({
          parts: generationParts,
          policy: option.policy,
        })
      : 0;

  return [
    `method:${context.request.method}`,
    `route:${context.route}`,
    ...normalizedQueryParts(context.request),
    ...privateParts,
    ...adminParts,
    ...(await resolveParts(option.parts, context)),
    ...(generationParts.length > 0
      ? ["generation", ...generationParts, `value:${generation ?? 0}`]
      : []),
  ];
}

function statusCode(context: RouteCacheContext, responseValue: unknown) {
  if (responseValue instanceof ElysiaCustomStatusResponse) {
    return responseValue.code;
  }

  return typeof context.set.status === "number" ? context.set.status : 200;
}

function isJsonStyleResponse(value: unknown) {
  if (value instanceof Response) {
    return false;
  }

  if (typeof value === "undefined") {
    return false;
  }

  try {
    return JSON.stringify(value) !== undefined;
  } catch {
    return false;
  }
}

export const responseCache = new Elysia({ name: "response-cache" }).macro({
  routeCache<T>(option: RouteCacheOption<T>) {
    return {
      beforeHandle: (async (context: unknown) => {
        const routeContext = context as RouteCacheContext;

        if (!isCacheableMethod(routeContext.request.method)) {
          routeCacheState.set(routeContext.request, { hit: false });
          routeContext.set.headers["X-Cache"] = "BYPASS";
          return;
        }

        const keyParts = await cacheKeyParts(option, routeContext);

        if (!keyParts) {
          routeContext.set.headers["X-Cache"] = "BYPASS";
          return (
            routeContext.status as (
              code: 401,
              body: { message: string },
            ) => unknown
          )(401, { message: "Unauthorized" });
        }

        const cached = await cacheStore.get({
          parts: keyParts,
          policy: option.policy,
          validator: option.validator,
        });

        if (cached != null) {
          routeCacheState.set(routeContext.request, { hit: true });
          routeContext.set.headers["X-Cache"] = "HIT";
          return cached;
        }

        routeCacheState.set(routeContext.request, { hit: false, keyParts });
        routeContext.set.headers["X-Cache"] = "MISS";
      }) as never,
      afterHandle: (async (context: unknown) => {
        const routeContext = context as RouteCacheContext & {
          responseValue: unknown;
        };
        const state = routeCacheState.get(routeContext.request);

        if (
          state?.hit ||
          !state?.keyParts ||
          !isCacheableMethod(routeContext.request.method) ||
          statusCode(routeContext, routeContext.responseValue) !== 200 ||
          !isJsonStyleResponse(routeContext.responseValue)
        ) {
          return;
        }

        const value = option.validator
          ? option.validator(routeContext.responseValue)
          : routeContext.responseValue;

        await cacheStore.set({
          parts: state.keyParts,
          policy: option.policy,
          value,
        });
      }) as never,
    };
  },
});
