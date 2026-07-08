import React from "react";

export function Card({ children, padding = "24px", elevated = false, style, ...rest }) {
  return React.createElement(
    "div",
    {
      style: {
        background: elevated ? "var(--surface-elevated)" : "var(--surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        padding,
        boxShadow: elevated ? "var(--shadow-md)" : "var(--shadow-xs)",
        fontFamily: "var(--font-ui)",
        color: "var(--text-primary)",
        ...style,
      },
      ...rest,
    },
    children
  );
}
