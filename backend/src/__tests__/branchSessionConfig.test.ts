import { assertBranchSecurityConfig, getBranchSessionSecret } from "../branch/branchSessionConfig";

describe("branchSessionConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("uses dev secret when unset", () => {
    delete process.env.BRANCH_SESSION_SECRET;
    expect(getBranchSessionSecret()).toBe("dev-branch-session-secret");
  });

  it("throws in production without a configured secret", () => {
    process.env.NODE_ENV = "production";
    delete process.env.BRANCH_SESSION_SECRET;
    delete process.env.CORS_ORIGIN;
    delete process.env.FRONTEND_ORIGIN;
    expect(() => assertBranchSecurityConfig()).toThrow(/BRANCH_SESSION_SECRET/);
  });

  it("throws in production when secret is too short", () => {
    process.env.NODE_ENV = "production";
    process.env.BRANCH_SESSION_SECRET = "short";
    process.env.CORS_ORIGIN = "https://app.example.com";
    expect(() => assertBranchSecurityConfig()).toThrow(/at least 32/);
  });

  it("throws in production without CORS origin", () => {
    process.env.NODE_ENV = "production";
    process.env.BRANCH_SESSION_SECRET = "a".repeat(32);
    delete process.env.CORS_ORIGIN;
    delete process.env.FRONTEND_ORIGIN;
    expect(() => assertBranchSecurityConfig()).toThrow(/CORS_ORIGIN/);
  });

  it("passes in production with proper env", () => {
    process.env.NODE_ENV = "production";
    process.env.BRANCH_SESSION_SECRET = "a".repeat(32);
    process.env.CORS_ORIGIN = "https://app.example.com";
    expect(() => assertBranchSecurityConfig()).not.toThrow();
  });
});
