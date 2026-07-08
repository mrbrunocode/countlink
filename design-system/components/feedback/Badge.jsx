import React from "react";

const TONES = {
  neutral: { bg: "var(--surface-hover)", fg: "var(--text-secondary)" },
  accent: { bg: "var(--accent-soft)", fg: "var(--accent)" },
  success: { bg: "var(--success-soft)", fg: "var(--success)" },
  warning: { bg: "var(--warning-soft)", fg: "var(--warning)" },
  danger: { bg: "var(--danger-soft)", fg: "var(--danger)" },
};

export function Badge({ children, tone = "neutral", dot = false }) {
  const t = TONES[tone] || TONES.neutral;
  return React.createElement(
    "span",
    {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        borderRadius: "var(--radius-full)",
        background: t.bg,
        color: t.fg,
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--weight-semibold)",
        letterSpacing: "var(--tracking-wide)",
        textTransform: "uppercase",
      },
    },
    dot &&
      React.createElement("span", {
        style: {
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: "currentColor",
          animation: tone === "success" ? "cl-pulse-live 1.6s ease-in-out infinite" : "none",
        },
      }),
    children
  );
}
