import { act, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { content } from "@/content";
import { Hero, HeroStory } from "./hero";
import { HeroReveal } from "./hero-reveal";

const { hero, site } = content;

const stories = [
  ["simple", <HeroStory key="simple" paragraphs={hero.paragraphs} />],
  ["reveal", <HeroReveal key="reveal" paragraphs={hero.paragraphs} />],
] as const;

// The reveal's MotionProvider loads Motion's features in the background and
// then updates LazyMotion; let that land inside act.
async function renderHero(story: React.ReactNode) {
  const view = render(
    <Hero logo={hero.logo} name={site.name}>
      {story}
    </Hero>
  );
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
  return view;
}

describe.each(stories)("Hero (%s)", (_, story) => {
  it("names the show with the stacked logo as its top-level heading", async () => {
    await renderHero(story);
    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Jester's Privilege",
    });
    expect(heading.querySelector("img")?.getAttribute("src")).toMatch(
      /^\/images\/brand\/stacked-tagline\/\d+\.webp$/
    );
  });

  it("tells the jester story, word for word, in order", async () => {
    const { container } = await renderHero(story);
    expect(container).toHaveTextContent(hero.paragraphs.join(""));
  });

  it("has no detectable accessibility violations", async () => {
    const { container } = await renderHero(story);
    expect(await axe(container)).toHaveNoViolations();
  });
});
