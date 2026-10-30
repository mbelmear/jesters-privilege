import { buttonVariants } from "./button";

describe("buttonVariants", () => {
  // Used on a link (<a className={buttonVariants(…)}>), the variant's border
  // must replace the base's transparent one, as it does inside <Button>.
  it("gives an outline link a visible border", () => {
    const classes = buttonVariants({ variant: "outline" }).split(" ");
    expect(classes).toContain("border-primary");
    expect(classes).not.toContain("border-transparent");
  });
});
