/**
 * @jest-environment node
 */

// Array.isArray narrows unknown to unknown[], not any[] (src/array-is-array.d.ts):
// an any[] lets each element reach typed code unchecked, which no-unsafe-*
// lint misses when it flows into an unknown parameter (#262's comments read).
// tsc is this test's runner: the @ts-expect-error below fails typecheck if an
// element ever comes out as any again.
describe("Array.isArray", () => {
  it("gives unknown elements, which need narrowing before use", () => {
    const value: unknown = ["Celebrity Pastors"];
    if (!Array.isArray(value)) throw new Error("not a list");

    // @ts-expect-error an unknown element isn't a string until narrowed
    const title: string = value[0];

    expect(title).toBe("Celebrity Pastors");
  });

  it("keeps the array type of a value already typed", () => {
    // A parameter, so the union isn't narrowed by an assignment first.
    const titles = (value: string | readonly string[]): readonly string[] => {
      if (!Array.isArray(value)) return [value];
      // Typechecks only as readonly string[], not unknown[].
      const list: readonly string[] = value;
      return list;
    };

    expect(titles(["Celebrity Pastors"])).toEqual(["Celebrity Pastors"]);
  });
});
