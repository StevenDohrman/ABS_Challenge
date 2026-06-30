import { Prisma } from "@prisma/client";
import { httpStatusForError, publicErrorMessage } from "../utils/httpErrors";

describe("httpStatusForError", () => {
  it("maps Prisma connection errors to 503", () => {
    const err = new Prisma.PrismaClientKnownRequestError("can't reach database", {
      code: "P1001",
      clientVersion: "6.19.3",
    });
    expect(httpStatusForError(err)).toBe(503);
    expect(publicErrorMessage(err, 503)).toBe("Database temporarily unavailable");
  });

  it("maps unknown errors to 500", () => {
    expect(httpStatusForError(new Error("boom"))).toBe(500);
  });
});
