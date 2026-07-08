import React from "react";

export function Switch({ label, checked, onChange, disabled = false }) {
  return React.createElement(
    "label",
    {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontFamily: "var(--font-ui)",
        userSelect: "none",
      },
    },
    React.createElement("input", { type: "checkbox", checked, disabled, onChange, style: { display: "none" } }),
    React.createElement(
      "span",
      {
        style: {
          width: "36px",
          height: "22px",
          borderRadius: "var(--radius-full)",
          background: checked ? "var(--accent)" : "var(--n-4)",
          position: "relative",
          transition: "background var(--duration-fast) var(--ease-standard)",
          flexShrink: 0,
        },
      },
      React.createElement("span", {
        style: {
          position: "absolute",
          top: "2px",
          left: checked ? "16px" : "2px",
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          background: "var(--n-9)",
          boxShadow: "var(--shadow-xs)",
          transition: "left var(--duration-fast) var(--ease-standard)",
        },
      })
    ),
    label && React.createElement("span", { style: { fontSize: "var(--text-base)", color: "var(--text-primary)" } }, label)
  );
}
