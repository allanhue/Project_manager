import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#22d3ee",
          borderRadius: 14,
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            background: "#0f172a",
            borderRadius: 10,
            display: "flex",
            flexDirection: "column",
            height: 42,
            padding: "7px 6px",
            width: 42,
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 3,
              height: 4,
              marginBottom: 5,
            }}
          >
            <div style={{ background: "#67e8f9", borderRadius: 3, flex: 1 }} />
            <div style={{ background: "#a5f3fc", borderRadius: 3, flex: 1 }} />
            <div style={{ background: "#67e8f9", borderRadius: 3, flex: 1 }} />
          </div>
          <div style={{ display: "flex", gap: 3, flex: 1 }}>
            <div style={{ background: "#334155", borderRadius: 3, flex: 1 }} />
            <div style={{ background: "#334155", borderRadius: 3, flex: 1 }} />
            <div style={{ background: "#334155", borderRadius: 3, flex: 1 }} />
          </div>
          <div
            style={{
              alignItems: "center",
              background: "#22d3ee",
              borderRadius: 5,
              display: "flex",
              height: 15,
              justifyContent: "center",
              marginTop: 4,
              width: 15,
            }}
          >
            <div
              style={{
                borderBottom: "2px solid #0f172a",
                borderRight: "2px solid #0f172a",
                height: 7,
                transform: "rotate(45deg)",
                width: 4,
              }}
            />
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}