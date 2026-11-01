import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  readLcpBudgets,
  readReport,
  summarise,
  type Report,
} from "./lighthouse";

// A run of one page: painted at 40 ms, its simulated LCP as given, and the
// requests named, each fetched before the paint unless it says otherwise.
function run(
  path: string,
  simulatedLcp: number,
  requests: { url: string; type: string; bytes: number; startTime?: number }[]
): Report {
  return {
    path,
    simulatedLcp,
    simulatedFcp: 1050,
    observedLcp: 40,
    observedFcp: 40,
    lcpElement: "section.flex > h1.w-64 > picture > img.h-auto",
    requests: requests.map(({ startTime = 10, ...request }) => ({
      ...request,
      startTime,
      url: `http://localhost/${request.url}`,
    })),
  };
}

const budget = { lcpBudget: () => 3200 };

// The printed row for a figure, its cells split out.
function row(summary: string, figure: string): string[] {
  const line = summary
    .split("\n")
    .find((text) => text.trimStart().startsWith(figure));
  if (!line) throw new Error(`No "${figure}" row in:\n${summary}`);
  return line
    .slice(line.indexOf(figure) + figure.length)
    .trim()
    .split(/\s+/);
}

describe("summarise", () => {
  it("shows early bytes exactly, so growth under a KB shows", () => {
    const page = "/styleguide/home/simple.html";
    const summary = summarise(
      [
        {
          label: "origin/main",
          reports: [
            run(page, 2640, [
              { url: "a.css", type: "Stylesheet", bytes: 12503 },
            ]),
          ],
        },
        {
          label: "HEAD",
          reports: [
            run(page, 2640, [
              { url: "b.css", type: "Stylesheet", bytes: 12876 },
            ]),
          ],
        },
      ],
      budget
    );
    expect(row(summary, "early Stylesheet bytes")).toEqual([
      "12,503",
      "12,876",
    ]);
  });
});

describe("summarise, each page's figures", () => {
  it("shows the median run, the largest paint, and the early fonts", () => {
    const page = "/gallery.html";
    const font = {
      url: "media/gloock-s.p.433jmqvrjurwa.woff2",
      type: "Font",
      bytes: 17301,
    };
    const summary = summarise(
      [
        {
          label: "this checkout",
          reports: [
            run(page, 2901, [font]),
            run(page, 2750, [font]),
            run(page, 3010, [font]),
          ],
        },
      ],
      budget
    );
    expect(row(summary, "LCP (simulated)")).toEqual(["2901"]);
    expect(row(summary, "early Font bytes")).toEqual(["17,301"]);
    expect(summary).toContain(
      "    LCP element (this checkout): section.flex > h1.w-64 > picture > img.h-auto"
    );
    expect(summary).toContain(
      "    early fonts (this checkout): gloock-s.p.433jmqvrjurwa.woff2 17 KB"
    );
  });
});

describe("summarise, early files", () => {
  const page = "/";
  const shared = { url: "chunks/shared.js", type: "Script", bytes: 9000 };
  const columns = [
    {
      label: "origin/main",
      reports: [
        run(page, 2640, [
          { url: "chunks/44du9.css", type: "Stylesheet", bytes: 12503 },
          shared,
        ]),
      ],
    },
    {
      label: "HEAD",
      reports: [
        run(page, 2640, [
          { url: "chunks/44z83.css", type: "Stylesheet", bytes: 12876 },
          shared,
          // Fetched after the paint, so it costs the paint nothing.
          {
            url: "chunks/late.js",
            type: "Script",
            bytes: 50000,
            startTime: 900,
          },
        ]),
      ],
    },
  ];

  it("names each early file only one side fetched, with its bytes", () => {
    const summary = summarise(columns, budget);
    expect(summary).toContain(
      "    early files only in origin/main: 44du9.css 12,503"
    );
    expect(summary).toContain("    early files only in HEAD: 44z83.css 12,876");
    expect(summary).not.toMatch(/only in .*shared\.js/);
    expect(summary).not.toContain("late.js");
  });

  it("names an early file whose bytes changed under the same name", () => {
    // The page's own document keeps its name as it grows (#19).
    const document = (bytes: number) => ({
      url: "styleguide/home/simple.html",
      type: "Document",
      bytes,
    });
    const summary = summarise(
      [
        { label: "origin/main", reports: [run(page, 2640, [document(14473)])] },
        { label: "HEAD", reports: [run(page, 2640, [document(15512)])] },
      ],
      budget
    );
    expect(summary).toContain(
      "    early files changed: simple.html 14,473 → 15,512"
    );
  });

  it("names the home page's document by its path", () => {
    const summary = summarise(
      [
        { label: "origin/main", reports: [run(page, 2640, [])] },
        {
          label: "HEAD",
          reports: [
            run(page, 2640, [{ url: "", type: "Document", bytes: 12000 }]),
          ],
        },
      ],
      budget
    );
    expect(summary).toContain("    early files only in HEAD: / 12,000");
  });

  it("tells apart early files that differ only by query", () => {
    const summary = summarise(
      [
        { label: "origin/main", reports: [run(page, 2640, [])] },
        {
          label: "HEAD",
          reports: [
            run(page, 2640, [
              { url: "image?w=640", type: "Image", bytes: 32000 },
              { url: "image?w=1280", type: "Image", bytes: 90000 },
            ]),
          ],
        },
      ],
      budget
    );
    expect(summary).toContain(
      "    early files only in HEAD: image?w=640 32,000, image?w=1280 90,000"
    );
  });

  it("lists no files for a single checkout", () => {
    const [first] = columns;
    expect(summarise(first ? [first] : [], budget)).not.toContain(
      "early files only in"
    );
  });
});

describe("summarise, LCP budget", () => {
  const page = "/styleguide/home/simple.html";
  const runs = (...lcps: number[]) => [
    {
      label: "origin/main",
      reports: lcps.map((lcp) => run(page, lcp, [])),
    },
  ];

  it("warns of a page with any run within a step of the budget", () => {
    // main's own CI runs of the simple mockup in #23: a safe median, and one
    // run on the step above.
    const summary = summarise(runs(2634, 3303, 2639), budget);
    expect(summary).toContain(
      "    near the LCP budget (origin/main): runs of 2,634, 3,303, 2,639 ms against 3,200"
    );
  });

  it("counts a run just under the budget as near it", () => {
    expect(summarise(runs(2900, 3051, 2900), budget)).toContain(
      "near the LCP budget"
    );
  });

  it("leaves a page with every run clear of the budget unmarked", () => {
    expect(summarise(runs(2900, 3049, 2900), budget)).not.toContain(
      "near the LCP budget"
    );
  });

  it("judges each page against its own budget", () => {
    const perPage = {
      lcpBudget: (path: string) => (path === page ? 3600 : 3200),
    };
    expect(summarise(runs(2634, 3303, 2639), perPage)).not.toContain(
      "near the LCP budget"
    );
    expect(summarise(runs(2634, 3451, 2639), perPage)).toContain(
      "runs of 2,634, 3,451, 2,639 ms against 3,600"
    );
  });
});

describe("readReport", () => {
  it("reads the figures the summary needs from a Lighthouse report", () => {
    const json = {
      finalDisplayedUrl: "http://localhost:4173/episodes/1.html",
      audits: {
        "largest-contentful-paint": { numericValue: 2675.4 },
        "first-contentful-paint": { numericValue: 1052.1 },
        metrics: {
          details: {
            items: [
              {
                observedLargestContentfulPaint: 42,
                observedFirstContentfulPaint: 41,
              },
            ],
          },
        },
        "largest-contentful-paint-element": {
          details: {
            items: [{ items: [{ node: { selector: "div.text-lg" } }] }],
          },
        },
        "network-requests": {
          details: {
            items: [
              {
                url: "http://localhost:4173/episodes/1.html",
                resourceType: "Document",
                rendererStartTime: 0,
                transferSize: 11204,
              },
              { url: "http://localhost:4173/favicon.ico" },
            ],
          },
        },
      },
    };
    expect(readReport("lhr-1.json", json)).toEqual({
      path: "/episodes/1.html",
      simulatedLcp: 2675.4,
      simulatedFcp: 1052.1,
      observedLcp: 42,
      observedFcp: 41,
      lcpElement: "div.text-lg",
      requests: [
        {
          url: "http://localhost:4173/episodes/1.html",
          type: "Document",
          startTime: 0,
          bytes: 11204,
        },
        // A request Lighthouse reports without these fields is never early.
        {
          url: "http://localhost:4173/favicon.ico",
          type: "Other",
          startTime: Infinity,
          bytes: 0,
        },
      ],
    });
  });

  it("names the file and the figure a report lacks", () => {
    expect(() =>
      readReport("lhr-2.json", { finalDisplayedUrl: "http://localhost/" })
    ).toThrow(
      "lhr-2.json has no number at audits.largest-contentful-paint.numericValue"
    );
  });

  it("names the file whose report lists no requests", () => {
    const json = {
      finalDisplayedUrl: "http://localhost/",
      audits: {
        "largest-contentful-paint": { numericValue: 2675 },
        "first-contentful-paint": { numericValue: 1052 },
        metrics: {
          details: {
            items: [
              {
                observedLargestContentfulPaint: 42,
                observedFirstContentfulPaint: 41,
              },
            ],
          },
        },
      },
    };
    expect(() => readReport("lhr-3.json", json)).toThrow(
      "lhr-3.json has no network requests"
    );
  });

  it("names the file whose report has no page URL", () => {
    expect(() => readReport("lhr-1.json", { audits: {} })).toThrow(
      "lhr-1.json has no page URL"
    );
  });
});

describe("readLcpBudgets", () => {
  // Shaped like lighthouserc.json: assertions every page shares, then one LCP
  // budget for the image-led pages and one for every other page.
  const imageLed = "localhost(:\\d+)?/(gallery\\.html)?$";
  const lcp = (maxNumericValue: number) => ({
    "largest-contentful-paint": ["error", { maxNumericValue }],
  });
  const config = {
    ci: {
      assert: {
        assertMatrix: [
          { assertions: { "categories:performance": ["error", {}] } },
          { matchingUrlPattern: imageLed, assertions: lcp(3600) },
          { matchingUrlPattern: `^(?!.*${imageLed})`, assertions: lcp(3200) },
        ],
      },
    },
  };

  it("reads each page's LCP budget from the Lighthouse CI config", () => {
    const budgetFor = readLcpBudgets("lighthouserc.json", config);
    expect(budgetFor("/")).toBe(3600);
    expect(budgetFor("/gallery.html")).toBe(3600);
    expect(budgetFor("/404.html")).toBe(3200);
    expect(budgetFor("/styleguide/gallery.html")).toBe(3200);
  });

  it("names a page no budget matches", () => {
    const [shared, imageLedBudget] = config.ci.assert.assertMatrix;
    const budgetFor = readLcpBudgets("lighthouserc.json", {
      ci: { assert: { assertMatrix: [shared, imageLedBudget] } },
    });
    expect(() => budgetFor("/404.html")).toThrow(
      "lighthouserc.json sets no LCP budget for /404.html"
    );
  });

  it("names a page two budgets match", () => {
    const [shared, imageLedBudget] = config.ci.assert.assertMatrix;
    const everyPage = { assertions: lcp(3200) };
    const budgetFor = readLcpBudgets("lighthouserc.json", {
      ci: { assert: { assertMatrix: [shared, imageLedBudget, everyPage] } },
    });
    expect(() => budgetFor("/")).toThrow(
      "lighthouserc.json sets 2 LCP budgets for /"
    );
  });

  it("names the config with no assertion matrix", () => {
    expect(() => readLcpBudgets("lighthouserc.json", { ci: {} })).toThrow(
      "lighthouserc.json has no ci.assert.assertMatrix"
    );
  });
});

describe("lighthouserc.json", () => {
  const file = join(__dirname, "..", "..", "lighthouserc.json");
  const json: unknown = JSON.parse(readFileSync(file, "utf8"));
  const budgetFor = readLcpBudgets(file, json);
  const pages = (
    json as { ci: { collect: { url: string[] } } }
  ).ci.collect.url.map((url) => new URL(url).pathname);

  // Their LCP is an image, which paints only after its own request, and CI's
  // runs of them swing about 700 ms on unchanged bytes (#89).
  it("gives the image-led pages the budget CI can hold for them", () => {
    for (const page of [
      "/",
      "/gallery.html",
      "/styleguide/paintings.html",
      "/styleguide/home/simple.html",
    ]) {
      expect([page, budgetFor(page)]).toEqual([page, 3600]);
    }
  });

  it("holds every other page, and any page added, to 3.2 s", () => {
    for (const page of [...pages, "/a-page-not-yet-built.html"]) {
      if (page === "/" || /gallery|paintings|simple/.test(page)) continue;
      expect([page, budgetFor(page)]).toEqual([page, 3200]);
    }
  });
});
