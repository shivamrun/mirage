import { Elysia, ElysiaStatus } from "elysia";

export const apiErrors = new Elysia({ name: "api-errors" }).onError(
  { as: "global" },
  ({ code, error, request, route, status }) => {
    if (error instanceof ElysiaStatus) {
      return error;
    }

    if (code === "PARSE") {
      return status(400, { message: "Invalid request body." });
    }

    if (code === "VALIDATION" && error.type !== "response") {
      return status(400, {
        message:
          (typeof error.customError === "string" && error.customError) ||
          error.all[0]?.message ||
          "Invalid request.",
      });
    }

    if (code === "NOT_FOUND") {
      return status(404, { message: "Not Found" });
    }

    console.error("Unhandled Elysia API error", {
      method: request.method,
      path: route,
      type:
        code === "VALIDATION"
          ? "RESPONSE_VALIDATION"
          : code === "INTERNAL_SERVER_ERROR"
            ? "INTERNAL_SERVER_ERROR"
            : "UNKNOWN",
    });

    return status(500, { message: "Internal server error." });
  },
);
