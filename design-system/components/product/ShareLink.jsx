import React, { useState } from "react";

/**
 * A read-only share URL with a one-click copy button — the primary distribution
 * mechanism of the entire product (a synced timer is only useful once shared).
 */
export function ShareLink({ url }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "6px 6px 6px 16px",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        fontFamily: "var(--font-ui)",
      },
    },
    React.createElement(
      "span",
      {
        style: {
          flex: 1,
          fontSize: "var(--text-base)",
          fontFamily: "var(--font-display)",
          color: "var(--text-primary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        },
      },
      url
    ),
    React.createElement(
      "button",
      {
        onClick: copy,
        style: {
          height: "32px",
          padding: "0 14px",
          borderRadius: "var(--radius-sm)",
          border: "none",
          background: copied ? "var(--success-strong)" : "var(--accent)",
          color: "var(--text-on-accent)",
          fontSize: "var(--text-sm)",
          fontWeight: "var(--weight-semibold)",
          cursor: "pointer",
          transition: "background var(--duration-fast) var(--ease-standard)",
          whiteSpace: "nowrap",
        },
      },
      copied ? "Copied" : "Copy link"
    )
  );
}
