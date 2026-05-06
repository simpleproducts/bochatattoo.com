import { ImageResponse } from "next/og";
import { getDictionary } from "@/i18n";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Bocha — Tatuador";

export default function OG() {
  const dict = getDictionary("es");
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "radial-gradient(ellipse at 25% 25%, #2a221a 0%, transparent 55%), radial-gradient(ellipse at 75% 70%, #1a1f28 0%, transparent 55%), #0a0a0a",
          color: "#ededed",
          padding: 80,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: 18,
            color: "#a0a0a0",
            textTransform: "uppercase",
            letterSpacing: "0.2em",
          }}
        >
          <span>Bocha · Tattoo</span>
          <span>· {dict.hero.booking}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontStyle: "italic",
              fontSize: 220,
              lineHeight: 0.86,
              letterSpacing: "-0.04em",
            }}
          >
            <span>bocha</span>
            <span style={{ color: "#7a7a7a" }}>tattoo</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "space-between",
              gap: 32,
            }}
          >
            <div
              style={{
                fontSize: 26,
                color: "#cfcfcf",
                maxWidth: 760,
                lineHeight: 1.2,
              }}
            >
              {dict.meta.description}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "16px 24px",
                background: "#ededed",
                color: "#0a0a0a",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 18,
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                whiteSpace: "nowrap",
              }}
            >
              <span>Reservá un turno</span>
              <span>→</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
