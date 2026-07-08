import React from "react";

export function Tag({ children, onRemove, color }) {
  return React.createElement(
    "span",
    {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "3px 8px 3px 10px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        color: color || "var(--text-primary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--weight-medium)",
      },
    },
    children,
    onRemove &&
      React.createElement(
        "button",
        {
          onClick: onRemove,
          "aria-label": "Remove",
          style: {
            border: "none",
            background: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            fontSize: "13px",
            lineHeight: 1,
            padding: 0,
          },
        },
        "×"
      )
  );
}
