const DEV_BRANCH_SESSION_SECRET = "dev-branch-session-secret";

/** Minimum secret length when NODE_ENV=production. */
const MIN_PRODUCTION_SECRET_LENGTH = 32;

export function getBranchSessionSecret(): string {
  return process.env.BRANCH_SESSION_SECRET ?? DEV_BRANCH_SESSION_SECRET;
}

export function isBranchCookieSecure(): boolean {
  if (process.env.BRANCH_COOKIE_SECURE === "true") return true;
  if (process.env.BRANCH_COOKIE_SECURE === "false") return false;
  return process.env.NODE_ENV === "production";
}

export function getCorsOrigin(): string | undefined {
  return process.env.CORS_ORIGIN ?? process.env.FRONTEND_ORIGIN;
}

/**
 * Fail fast in production when branch security env is misconfigured.
 * Called once at server startup.
 */
export function assertBranchSecurityConfig(): void {
  const isProd = process.env.NODE_ENV === "production";
  const secret = getBranchSessionSecret();

  if (isProd && secret === DEV_BRANCH_SESSION_SECRET) {
    throw new Error(
      "BRANCH_SESSION_SECRET must be set to a strong random value in production"
    );
  }

  if (isProd && secret.length < MIN_PRODUCTION_SECRET_LENGTH) {
    throw new Error(
      `BRANCH_SESSION_SECRET must be at least ${MIN_PRODUCTION_SECRET_LENGTH} characters in production`
    );
  }

  if (isProd && !getCorsOrigin()) {
    throw new Error(
      "CORS_ORIGIN (or FRONTEND_ORIGIN) must be set in production to restrict browser access"
    );
  }
}
