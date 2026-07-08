import React, { useEffect } from "react";

export function Dialog({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose && onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return React.createElement(
    "div",
    {
      onClick: onClose,
      style: {
        position: "fixed",
        inset: 0,
        background: "oklch(0.1 0.01 260 / 0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        animation: "cl-fade-in var(--duration-base) var(--ease-out)",
      },
    },
    React.createElement(
      "div",
      {
        onClick: (e) => e.stopPropagation(),
        style: {
          width: "min(420px, 92vw)",
          background: "var(--surface-elevated)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg)",
          padding: "24px",
          fontFamily: "var(--font-ui)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        },
      },
      title &&
        React.createElement(
          "h2",
          { style: { margin: 0, fontSize: "var(--text-lg)", fontWeight: "var(--weight-semibold)", color: "var(--text-primary)" } },
          title
        ),
      React.createElement("div", { style: { fontSize: "var(--text-base)", color: "var(--text-secondary)", lineHeight: "var(--leading-normal)" } }, children),
      footer &&
        React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" } }, footer)
    )
  );
}
