import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { shell } from "@/content/shell";
import type { NavItem } from "@/lib/content";
import { MobileMenu } from "./mobile-menu";

const nav: readonly NavItem[] = shell.nav;
const items = nav.filter((item) => !item.onlyWithEpisodes);
const focused = () => document.activeElement as HTMLElement;

function renderMenu() {
  render(
    <MobileMenu items={items} labels={shell.menu} navLabel={shell.navLabel} />
  );
  return screen.getByRole("button", { name: "Open menu" });
}

describe("MobileMenu", () => {
  it("opens from the keyboard with focus inside, listing each section", async () => {
    const user = userEvent.setup();
    const trigger = renderMenu();
    trigger.focus();
    await user.keyboard("{Enter}");

    const menu = await screen.findByRole("dialog", { name: "Menu" });
    expect(menu).toContainElement(focused());
    expect(
      within(within(menu).getByRole("navigation", { name: "Main" }))
        .getAllByRole("link")
        .map((link) => link.textContent)
    ).toEqual(["Fools' Gallery", "About", "Submit"]);
  });

  it("keeps focus inside while open", async () => {
    const user = userEvent.setup();
    await user.click(renderMenu());
    const menu = await screen.findByRole("dialog", { name: "Menu" });
    for (let step = 0; step < 6; step++) {
      await user.tab();
      expect(menu).toContainElement(focused());
    }
  });

  it("closes on Escape and returns focus to the menu button", async () => {
    const user = userEvent.setup();
    const trigger = renderMenu();
    await user.click(trigger);
    await screen.findByRole("dialog", { name: "Menu" });

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes from its close button", async () => {
    const user = userEvent.setup();
    await user.click(renderMenu());
    await user.click(await screen.findByRole("button", { name: "Close menu" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("closes when a section is chosen", async () => {
    // jsdom can't load another page, so stop the link's navigation.
    const stay = (event: Event) => event.preventDefault();
    document.addEventListener("click", stay);
    const user = userEvent.setup();
    await user.click(renderMenu());
    await user.click(await screen.findByRole("link", { name: "About" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    document.removeEventListener("click", stay);
  });

  it("has no detectable accessibility violations while open", async () => {
    const user = userEvent.setup();
    await user.click(renderMenu());
    await screen.findByRole("dialog", { name: "Menu" });
    expect(await axe(document.body)).toHaveNoViolations();
  });
});
