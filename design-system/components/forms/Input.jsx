import React from "react";

export function Input({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  helperText,
  error,
  disabled = false,
  size = "md",
  prefix,
  suffix,
  style,
  ...rest
}) {
  const h = size === "sm" ? "var(--control-height-sm)" : size === "lg" ? "var(--control-height-lg)" : "var(--control-height-md)";
  return React.createElement(
    "label",
    { style: { display: "flex", flexDirection: "column", gap: "6px", fontFamily: "var(--font-ui)", width: "100%" } },
    label &&
      React.createElement(
        "span",
        { style: { fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)", color: "var(--text-secondary)" } },
        label
      ),
    React.createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "8px",
          height: h,
          padding: "0 14px",
          borderRadius: "var(--radius-md)",
          border: `1px solid ${error ? "var(--danger-strong)" : "var(--border)"}`,
          background: "var(--surface)",
          opacity: disabled ? 0.5 : 1,
          transition: "border-color var(--duration-fast) var(--ease-standard)",
        },
      },
      prefix,
      React.createElement("input", {
        type,
        placeholder,
        value,
        onChange,
        disabled,
        style: {
          flex: 1,
          border: "none",
          outline: "none",
          background: "transparent",
          color: "var(--text-primary)",
          fontFamily: "var(--font-ui)",
          fontSize: "var(--text-base)",
          minWidth: 0,
          ...style,
        },
        ...rest,
      }),
      suffix
    ),
    helperText &&
      React.createElement(
        "span",
        {
          style: {
            fontSize: "var(--text-xs)",
            color: error ? "var(--danger-strong)" : "var(--text-tertiary)",
          },
        },
        helperText
      )
  );
}
