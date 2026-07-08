import React, { useState } from "react";

export function Tooltip({ children, label, side = "top" }) {
  const [show, setShow] = useState(false);
  const pos = {
    top: { bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" },
    bottom: { top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" },
    left: { right: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" },
    right: { left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" },
  }[side];

  return React.createElement(
    "span",
    {
      style: { position: "relative", display: "inline-flex" },
      onMouseEnter: () => setShow(true),
      onMouseLeave: () => setShow(false),
    },
    children,
    show &&
      React.createElement(
        "span",
        {
          style: {
            position: "absolute",
            ...pos,
            background: "var(--n-9)",
            color: "var(--n-0)",
            fontFamily: "var(--font-ui)",
            fontSize: "var(--text-xs)",
            fontWeight: "var(--weight-medium)",
            padding: "5px 9px",
            borderRadius: "var(--radius-sm)",
            whiteSpace: "nowrap",
            boxShadow: "var(--shadow-sm)",
            zIndex: 30,
            pointerEvents: "none",
            animation: "cl-fade-in var(--duration-fast) var(--ease-out)",
          },
        },
        label
      )
  );
}
