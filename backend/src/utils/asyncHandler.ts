import type { NextFunction, Request, Response, RequestHandler } from "express";

/**
 * Wraps async route handlers so rejections reach Express error middleware
 * instead of becoming unhandled promise rejections (which can crash the process).
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}
