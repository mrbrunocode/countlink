import React from "react";

export function IconButton({
  icon,
  label,
  size = "md",
  variant = "ghost",
  active = false,
  onClick,
  style,
  ...rest
}) {
  const dim = size === "sm" ? "32px" : size === "lg" ? "48px" : "40px";
  const bg =
    variant === "solid"
      ? "var(--accent)"
      : active
      ? "var(--surface-hover)"
      : "transparent";
  const color = variant === "solid" ? "var(--text-on-accent)" : "var(--text-primary)";
  return React.createElement(
    "button",
    {
      "aria-label": label,
      title: label,
      onClick,
      style: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: dim,
        height: dim,
        borderRadius: "var(--radius-md)",
        border: variant === "outline" ? "1px solid var(--border)" : "1px solid transparent",
        background: bg,
        color,
        cursor: "pointer",
        transition: "background var(--duration-fast) var(--ease-standard)",
        ...style,
      },
      ...rest,
    },
    icon
  );
}
