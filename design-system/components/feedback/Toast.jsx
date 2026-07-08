import React, { useEffect } from "react";

const TONES = {
  neutral: "var(--n-4)",
  success: "var(--success)",
  danger: "var(--danger)",
};

export function Toast({ open, onDismiss, tone = "neutral", children, duration = 4000 }) {
  useEffect(() => {
    if (!open || !duration) return;
    const t = setTimeout(() => onDismiss && onDismiss(), duration);
    return () => clearTimeout(t);
  }, [open, duration, onDismiss]);

  if (!open) return null;

  return React.createElement(
    "div",
    {
      style: {
        position: "fixed",
        left: "50%",
        bottom: "28px",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "12px 16px",
        borderRadius: "var(--radius-md)",
        background: "var(--n-9)",
        color: "var(--n-0)",
        borderLeft: `3px solid ${TONES[tone] || TONES.neutral}`,
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-sm)",
        fontWeight: "var(--weight-medium)",
        boxShadow: "var(--shadow-lg)",
        zIndex: 200,
        animation: "cl-fade-in var(--duration-base) var(--ease-out)",
      },
    },
    children
  );
}
