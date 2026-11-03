import { ImageResponse } from "next/og";
import { content } from "@/content";
import type { Episode } from "@/lib/feed";
import { episodeLabel } from "@/lib/format-episode";
import { CARD_SIZE } from "@/lib/seo";
import { cardColors, cardFaces, cardFonts, picture } from "./assets";

// Each Episode's link preview: a parchment card with "Episode N" large in
// Gloock, the title, the logo mark, and a teal band.

const LOGO_HEIGHT = 230;
// The logo mark's shape (public/brand/icon.png is 2342 × 2722).
const LOGO_WIDTH = Math.round((LOGO_HEIGHT * 2342) / 2722);

export async function episodeCard(episode: Episode): Promise<ImageResponse> {
  const label = episodeLabel(episode, content.episodePage).text;
  const [fonts, colors, logo] = await Promise.all([
    cardFonts(),
    cardColors(),
    picture("/brand/icon.png", LOGO_WIDTH * 2),
  ]);
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        backgroundColor: colors.parchment,
        color: colors.ink,
        ...cardFaces.display,
      }}
    >
      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          gap: 56,
          padding: "56px 72px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 150,
              lineHeight: 1,
              color: colors.display,
            }}
          >
            {label}
          </div>
          <div
            style={{
              display: "block",
              fontSize: 64,
              lineHeight: 1.15,
              lineClamp: 3,
            }}
          >
            {episode.title}
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- drawn into a PNG, not a page */}
        <img src={logo} width={LOGO_WIDTH} height={LOGO_HEIGHT} alt="" />
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: 88,
          padding: "0 72px",
          backgroundColor: colors.teal,
          color: colors.parchment,
          ...cardFaces.ui,
          fontSize: 30,
          letterSpacing: 4,
          textTransform: "uppercase",
        }}
      >
        {content.site.name}
      </div>
    </div>,
    { ...CARD_SIZE, fonts: [...fonts] }
  );
}
