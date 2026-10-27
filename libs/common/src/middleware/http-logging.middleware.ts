import { Logger } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

const logger = new Logger("HTTP");

export function httpLoggingMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const startedAt = Date.now();
  const { method, path, ip } = request;
  const userAgent = (request.get("user-agent") ?? "unknown").replace(
    /[\r\n]/g,
    " ",
  );

  logger.log(
    `Incoming request: ${method} ${path} ip=${ip} user-agent="${userAgent}"`,
  );

  response.once("finish", () => {
    logger.log(
      `Completed request: ${method} ${path} status=${response.statusCode} duration=${Date.now() - startedAt}ms`,
    );
  });

  next();
}
