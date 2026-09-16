import { ImageResponse } from "next/og";

import { siteConfig } from "@/shared/metadata";

type ContentOgImageOptions = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export const contentOgImageSize = {
  width: 1200,
  height: 630,
};

export const contentOgImageContentType = "image/png";

export function getContentOgImage({
  description,
  eyebrow,
  title,
}: ContentOgImageOptions) {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#101010",
        color: "#fafafa",
        padding: 72,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 28,
          color: "#d4d4d4",
        }}
      >
        <span>{siteConfig.name}</span>
        {eyebrow ? <span>{eyebrow}</span> : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <h1
          style={{
            margin: 0,
            maxWidth: 980,
            fontSize: 76,
            lineHeight: 1,
            letterSpacing: 0,
          }}
        >
          {title}
        </h1>
        {description ? (
          <p
            style={{
              margin: 0,
              maxWidth: 920,
              color: "#d4d4d4",
              fontSize: 34,
              lineHeight: 1.3,
            }}
          >
            {description}
          </p>
        ) : null}
      </div>
    </div>,
    contentOgImageSize,
  );
}
