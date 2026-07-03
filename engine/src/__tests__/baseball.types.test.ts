import { toBalls, toStrikes, toOuts, toCountState } from "../domain/baseball.types";

describe("baseball count converters", () => {
  test("toBalls accepts valid values", () => {
    expect(toBalls(0)).toBe(0);
    expect(toBalls(3)).toBe(3);
  });

  test("toStrikes accepts valid values", () => {
    expect(toStrikes(0)).toBe(0);
    expect(toStrikes(2)).toBe(2);
  });

  test("toOuts accepts valid values", () => {
    expect(toOuts(1)).toBe(1);
  });

  test("toCountState returns branded tuple", () => {
    expect(toCountState(3, 2)).toEqual([3, 2]);
  });

  test("reject NaN and out-of-range values", () => {
    expect(() => toBalls(NaN)).toThrow(/balls/);
    expect(() => toStrikes(3)).toThrow(/strikes/);
    expect(() => toOuts(3)).toThrow(/outs/);
    expect(() => toCountState(4, 0)).toThrow(/balls/);
  });
});
