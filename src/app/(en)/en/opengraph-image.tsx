import { ImageResponse } from "next/og";
import { getDictionary } from "@/i18n";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Bocha Barrena — Tattoo Artist";

export default async function OG() {
  const dict = getDictionary("en");

  const logoData = await readFile(
    path.join(process.cwd(), "public/logo/logo-white.png"),
  );
  const logoSrc = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "radial-gradient(ellipse at 20% 20%, #2a221a 0%, transparent 50%), radial-gradient(ellipse at 80% 75%, #1a1f28 0%, transparent 50%), #0a0a0a",
          color: "#ededed",
          padding: 72,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          fontFamily: "Georgia, serif",
        }}
      >
        {/* Top bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={56} height={56} alt="" />
          <span
            style={{
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: 16,
              color: "#6b6b6b",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
            }}
          >
            {dict.hero.location}
          </span>
        </div>

        {/* Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontStyle: "italic",
              fontSize: 168,
              lineHeight: 0.88,
              letterSpacing: "-0.03em",
            }}
          >
            <span>Bocha</span>
            <span>Barrena</span>
          </div>

          {/* Bottom row */}
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
                fontSize: 22,
                color: "#a0a0a0",
                maxWidth: 680,
                lineHeight: 1.3,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Tattoo · Fineline · Microrealism · Illustrative
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 22px",
                border: "1px solid #ededed",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: 16,
                textTransform: "uppercase",
                letterSpacing: "0.18em",
                whiteSpace: "nowrap",
                color: "#ededed",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: "#ededed",
                }}
              />
              <span>{dict.hero.booking}</span>
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
