import React from "react";

function pad(n) {
  return String(n).padStart(2, "0");
}

/**
 * Splits a total-seconds value into segments, dropping the hours/days
 * segment when it's zero so short timers don't show "00:" prefixes.
 */
function segments(totalSeconds) {
  const sign = totalSeconds < 0 ? "-" : "";
  const abs = Math.abs(Math.floor(totalSeconds));
  const days = Math.floor(abs / 86400);
  const hours = Math.floor((abs % 86400) / 3600);
  const mins = Math.floor((abs % 3600) / 60);
  const secs = abs % 60;
  const parts = [];
  if (days > 0) parts.push(pad(days));
  if (days > 0 || hours > 0) parts.push(pad(hours));
  parts.push(pad(mins));
  parts.push(pad(secs));
  return { sign, parts };
}

export function TimerDisplay({ totalSeconds = 0, size = "lg", direction = "down", label }) {
  const { sign, parts } = segments(totalSeconds);
  const fontSize = { sm: "var(--timer-sm)", md: "var(--timer-md)", lg: "var(--timer-lg)", xl: "var(--timer-xl)" }[size] || "var(--timer-lg)";
  const color = direction === "up" ? "var(--success)" : totalSeconds <= 0 ? "var(--danger)" : "var(--text-primary)";

  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" } },
    React.createElement(
      "div",
      {
        style: {
          fontFamily: "var(--font-display)",
          fontSize,
          fontWeight: "var(--weight-medium)",
          letterSpacing: "var(--tracking-tight)",
          color,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
          whiteSpace: "nowrap",
        },
      },
      sign,
      parts.join(":")
    ),
    label &&
      React.createElement(
        "div",
        {
          style: {
            fontFamily: "var(--font-ui)",
            fontSize: "var(--text-sm)",
            fontWeight: "var(--weight-medium)",
            color: "var(--text-tertiary)",
            textTransform: "uppercase",
            letterSpacing: "var(--tracking-wide)",
          },
        },
        label
      )
  );
}
