import React, { useState, useRef, useEffect } from "react";

export function Select({ label, options = [], value, onChange, placeholder = "Select…", size = "md" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const h = size === "sm" ? "var(--control-height-sm)" : size === "lg" ? "var(--control-height-lg)" : "var(--control-height-md)";

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const current = options.find((o) => o.value === value);

  return React.createElement(
    "div",
    { ref, style: { position: "relative", display: "flex", flexDirection: "column", gap: "6px", fontFamily: "var(--font-ui)", width: "100%" } },
    label &&
      React.createElement(
        "span",
        { style: { fontSize: "var(--text-sm)", fontWeight: "var(--weight-medium)", color: "var(--text-secondary)" } },
        label
      ),
    React.createElement(
      "button",
      {
        type: "button",
        onClick: () => setOpen((o) => !o),
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: h,
          padding: "0 14px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border)",
          background: "var(--surface)",
          color: current ? "var(--text-primary)" : "var(--text-tertiary)",
          fontSize: "var(--text-base)",
          cursor: "pointer",
        },
      },
      current ? current.label : placeholder,
      React.createElement(
        "span",
        { style: { fontSize: "10px", color: "var(--text-tertiary)", transform: open ? "rotate(180deg)" : "none", transition: "transform var(--duration-fast) var(--ease-standard)" } },
        "▾"
      )
    ),
    open &&
      React.createElement(
        "div",
        {
          style: {
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 20,
            background: "var(--surface-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-md)",
            padding: "4px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          },
        },
        options.map((o) =>
          React.createElement(
            "div",
            {
              key: o.value,
              onClick: () => {
                onChange && onChange(o.value);
                setOpen(false);
              },
              style: {
                padding: "8px 10px",
                borderRadius: "var(--radius-sm)",
                fontSize: "var(--text-base)",
                color: "var(--text-primary)",
                background: o.value === value ? "var(--surface-hover)" : "transparent",
                cursor: "pointer",
              },
            },
            o.label
          )
        )
      )
  );
}
