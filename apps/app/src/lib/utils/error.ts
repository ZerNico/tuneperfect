import { ORPCError } from "@orpc/client";
import { t } from "../i18n";
import { notify } from "../toast";

type RateLimitError = ORPCError<
  "RATE_LIMIT",
  {
    retryAfter: number;
  }
>;

function isRateLimitError(error: unknown): error is RateLimitError {
  return (
    error instanceof ORPCError &&
    error.code === "RATE_LIMIT" &&
    "retryAfter" in error.data &&
    typeof error.data.retryAfter === "number"
  );
}

export function handleError(error: Error | ORPCError<string, unknown> | RateLimitError) {
  if (isRateLimitError(error)) {
    notify({
      message: t("error.rate_limit", { retryAfter: error.data.retryAfter }),
      intent: "error",
    });
    return;
  }

  notify({
    message: t("error.unknown"),
    intent: "error",
  });
}
