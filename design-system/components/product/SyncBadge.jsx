import React from "react";

/**
 * Small cluster of overlapping avatar dots + a live count — shows who else
 * is synced to this same timer right now.
 */
export function SyncBadge({ count = 0, avatars = [], live = true }) {
  const shown = avatars.slice(0, 4);
  return React.createElement(
    "div",
    { style: { display: "inline-flex", alignItems: "center", gap: "8px", fontFamily: "var(--font-ui)" } },
    React.createElement(
      "div",
      { style: { display: "flex" } },
      shown.map((a, i) =>
        React.createElement(
          "div",
          {
            key: i,
            style: {
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              background: `oklch(0.6 0.14 ${(i * 47 + 200) % 360})`,
              border: "2px solid var(--surface)",
              marginLeft: i === 0 ? 0 : "-8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "10px",
              fontWeight: 700,
              color: "var(--n-9)",
            },
          },
          (a || "?").slice(0, 1).toUpperCase()
        )
      )
    ),
    React.createElement(
      "span",
      { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "var(--text-sm)", color: "var(--text-secondary)" } },
      live &&
        React.createElement("span", {
          style: {
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: "var(--success)",
            animation: "cl-pulse-live 1.6s ease-in-out infinite",
          },
        }),
      `${count} synced now`
    )
  );
}
