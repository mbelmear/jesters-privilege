import { renderToStaticMarkup } from "react-dom/server";
import { WebAnalytics } from "./web-analytics";

// Rendered as the build renders it: React only ever puts this script in the
// built HTML, never creates it in the browser.
function built(token: string | null): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(<WebAnalytics token={token} />);
  return container;
}

describe("WebAnalytics", () => {
  it("loads Cloudflare's beacon with the site's token", () => {
    const script = built("abc123").querySelector("script");
    expect(script).toHaveAttribute(
      "src",
      "https://static.cloudflareinsights.com/beacon.min.js"
    );
    expect(script).toHaveAttribute("defer");
    expect(JSON.parse(script?.dataset.cfBeacon ?? "")).toEqual({
      token: "abc123",
    });
  });

  it("loads nothing when the build doesn't count visits", () => {
    expect(built(null)).toBeEmptyDOMElement();
  });
});
