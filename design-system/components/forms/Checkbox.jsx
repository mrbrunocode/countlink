import React from "react";

export function Checkbox({ label, checked, onChange, disabled = false }) {
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
    React.createElement("input", {
      type: "checkbox",
      checked,
      disabled,
      onChange,
      style: { display: "none" },
    }),
    React.createElement(
      "span",
      {
        style: {
          width: "18px",
          height: "18px",
          borderRadius: "5px",
          border: `1px solid ${checked ? "var(--accent)" : "var(--border)"}`,
          background: checked ? "var(--accent)" : "var(--surface)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)",
          flexShrink: 0,
        },
      },
      checked &&
        React.createElement(
          "svg",
          { width: 11, height: 9, viewBox: "0 0 11 9", fill: "none" },
          React.createElement("path", {
            d: "M1 4.5L4 7.5L10 1",
            stroke: "var(--text-on-accent)",
            strokeWidth: 1.6,
            strokeLinecap: "round",
            strokeLinejoin: "round",
          })
        )
    ),
    label && React.createElement("span", { style: { fontSize: "var(--text-base)", color: "var(--text-primary)" } }, label)
  );
}
