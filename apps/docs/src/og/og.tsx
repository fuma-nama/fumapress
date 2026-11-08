import { googleFonts } from "fumapress/plugins/takumi";
import base from "./base.jpg?inline";
import banner from "./banner.jpg?inline";

/** Newsreader of the landing, fetched once for every image */
export const ogFonts = googleFonts([
  { name: "Newsreader", weight: [300, 400], style: ["normal", "italic"] },
]);

const colors = { ink: "#2b4249", text: "#36474a", muted: "#6b7b7c" };

/** the image of the landing: the README banner */
export function bannerImage() {
  return <img src={banner} width={1200} height={630} style={{ width: "100%", height: "100%" }} />;
}

/** the image of a page: its title and description on the painted press of the landing */
export function pageImage({
  label,
  title,
  description,
}: {
  label?: string;
  title?: string;
  description?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        backgroundImage: `url(${base})`,
        backgroundSize: "100% 100%",
        fontFamily: "Newsreader",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: 640,
          height: "100%",
          paddingLeft: 80,
          paddingTop: 40,
        }}
      >
        {label && (
          <p style={{ margin: 0, fontSize: 26, fontStyle: "italic", color: colors.muted }}>
            {label}
          </p>
        )}
        <p
          style={{
            margin: 0,
            marginTop: 14,
            fontSize: 60,
            fontWeight: 300,
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            color: colors.ink,
            lineClamp: 3,
            textWrap: "balance",
          }}
        >
          {title}
        </p>
        {description && (
          <p
            style={{
              margin: 0,
              marginTop: 24,
              fontSize: 26,
              lineHeight: 1.45,
              color: colors.text,
              lineClamp: 3,
            }}
          >
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
