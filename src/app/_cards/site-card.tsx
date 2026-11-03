import { ImageResponse } from "next/og";
import { content } from "@/content";
import { CARD_SIZE } from "@/lib/seo";
import { cardColors, paintingDetail, picture } from "./assets";

// The site-wide link preview, for every page without its own: Matejko's
// Stańczyk cut around his face, beside the logo and tagline.

const PAINTING_WIDTH = 480;

export async function siteCard(): Promise<ImageResponse> {
  const [colors, painting, logo] = await Promise.all([
    cardColors(),
    paintingDetail(content.paintings.stanczyk, {
      width: PAINTING_WIDTH,
      height: CARD_SIZE.height,
    }),
    picture("/brand/horizontal-tagline.png", 1200),
  ]);
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        backgroundColor: colors.parchment,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- drawn into a PNG, not a page */}
      <img
        src={painting}
        width={PAINTING_WIDTH}
        height={CARD_SIZE.height}
        alt=""
      />
      <div
        style={{
          display: "flex",
          width: 12,
          height: "100%",
          backgroundColor: colors.teal,
        }}
      />
      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: 56,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- drawn into a PNG, not a page */}
        <img src={logo} width={596} height={236} alt="" />
      </div>
    </div>,
    CARD_SIZE
  );
}
