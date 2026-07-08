import React from "react";

const SIZES = {
  sm: { h: "var(--control-height-sm)", px: "12px", font: "var(--text-sm)" },
  md: { h: "var(--control-height-md)", px: "16px", font: "var(--text-base)" },
  lg: { h: "var(--control-height-lg)", px: "20px", font: "var(--text-md)" },
};

function variantStyle(variant) {
  switch (variant) {
    case "primary":
      return {
        background: "var(--accent)",
        color: "var(--text-on-accent)",
        border: "1px solid transparent",
      };
    case "secondary":
      return {
        background: "var(--surface-elevated)",
        color: "var(--text-primary)",
        border: "1px solid var(--border)",
      };
    case "ghost":
      return {
        background: "transparent",
        color: "var(--text-primary)",
        border: "1px solid transparent",
      };
    case "danger":
      return {
        background: "var(--danger-strong)",
        color: "var(--n-9)",
        border: "1px solid transparent",
      };
    default:
      return {};
  }
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  icon = null,
  fullWidth = false,
  onClick,
  type = "button",
  style,
  ...rest
}) {
  const s = SIZES[size] || SIZES.md;
  const v = variantStyle(variant);
  return React.createElement(
    "button",
    {
      type,
      disabled,
      onClick,
      style: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        height: s.h,
        padding: `0 ${s.px}`,
        width: fullWidth ? "100%" : undefined,
        fontFamily: "var(--font-ui)",
        fontSize: s.font,
        fontWeight: "var(--weight-semibold)",
        letterSpacing: "var(--tracking-tight)",
        borderRadius: "var(--radius-md)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background var(--duration-fast) var(--ease-standard), transform var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard)",
        ...v,
        ...style,
      },
      onMouseDown: (e) => {
        if (!disabled) e.currentTarget.style.transform = "scale(0.97)";
      },
      onMouseUp: (e) => {
        e.currentTarget.style.transform = "scale(1)";
      },
      onMouseLeave: (e) => {
        e.currentTarget.style.transform = "scale(1)";
      },
      ...rest,
    },
    icon,
    children
  );
}
