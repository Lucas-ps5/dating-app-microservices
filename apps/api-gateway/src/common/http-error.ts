import { HttpException, HttpStatus } from "@nestjs/common";
import { isAxiosError } from "axios";

/**
 * Converts a failed downstream call into an `HttpException`, preserving the
 * upstream status code so clients see the real reason for the failure
 * (400/404/409/...) instead of a blanket 500.
 *
 * Always throws, so callers can simply `catch (e) { rethrowUpstreamError(e); }`.
 */
export function rethrowUpstreamError(error: unknown): never {
  if (isAxiosError(error) && error.response) {
    const body: unknown = error.response.data;
    const description =
      body === undefined || body === null || body === ""
        ? error.response.statusText || "Upstream request failed"
        : body;

    throw new HttpException(
      typeof description === "string"
        ? description
        : (description as Record<string, unknown>),
      error.response.status,
    );
  }

  if (isAxiosError(error)) {
    if (error.code === "ECONNABORTED") {
      throw new HttpException(
        "Upstream service did not respond in time",
        HttpStatus.GATEWAY_TIMEOUT,
      );
    }
    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      throw new HttpException(
        "Upstream service is unavailable",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  throw error;
}
