import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { content } from "@/content";
import { ShareButton } from "./share-button";

const copy = content.episodePage.share;
const title = "Episode 1: Celebrity Pastors";

// Gives navigator the share sheet and clipboard a test asks for.
function stubNavigator(stubs: {
  share?: (data: ShareData) => Promise<void>;
  writeText?: (text: string) => Promise<void>;
}) {
  Object.defineProperty(navigator, "share", {
    value: stubs.share,
    configurable: true,
  });
  Object.defineProperty(navigator, "clipboard", {
    value: stubs.writeText && { writeText: stubs.writeText },
    configurable: true,
  });
}

const renderShare = () =>
  render(<ShareButton title={title} path="/episodes/1" copy={copy} />);

describe("ShareButton", () => {
  // userEvent.setup() puts its own clipboard on navigator; each test sets
  // the one it wants after it.
  const user = () => userEvent.setup();

  it("copies the page's link and says so where there's no share sheet", async () => {
    const u = user();
    const writeText = jest.fn<Promise<void>, [string]>(async () => {});
    stubNavigator({ writeText });
    renderShare();
    await u.click(screen.getByRole("button", { name: "Share" }));
    expect(writeText).toHaveBeenCalledWith("http://localhost/episodes/1");
    expect(screen.getByRole("status")).toHaveTextContent(copy.copied);
  });

  it("opens the native share sheet where the browser has one", async () => {
    const u = user();
    const share = jest.fn<Promise<void>, [ShareData]>(async () => {});
    const writeText = jest.fn<Promise<void>, [string]>(async () => {});
    stubNavigator({ share, writeText });
    renderShare();
    await u.click(screen.getByRole("button", { name: "Share" }));
    expect(share).toHaveBeenCalledWith({
      title,
      url: "http://localhost/episodes/1",
    });
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("says so when the link can't be copied", async () => {
    const u = user();
    stubNavigator({});
    renderShare();
    await u.click(screen.getByRole("button", { name: "Share" }));
    expect(screen.getByRole("status")).toHaveTextContent(copy.failed);
  });

  it("has no detectable accessibility violations once it has copied", async () => {
    const u = user();
    stubNavigator({ writeText: async () => {} });
    const { container } = renderShare();
    await u.click(screen.getByRole("button", { name: "Share" }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
