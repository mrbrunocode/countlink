(function(){
const { useState, useEffect, useRef, Fragment } = React;
const __Countlink = {};
// --- components/data-display/Card.jsx ---
{

function Card({ children, padding = "24px", elevated = false, style, ...rest }) {
  return React.createElement(
    "div",
    {
      style: {
        background: elevated ? "var(--surface-elevated)" : "var(--surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        padding,
        boxShadow: elevated ? "var(--shadow-md)" : "var(--shadow-xs)",
        fontFamily: "var(--font-ui)",
        color: "var(--text-primary)",
        ...style,
      },
      ...rest,
    },
    children
  );
}

__Countlink.Card = Card;
}
// --- components/feedback/Badge.jsx ---
{

const TONES = {
  neutral: { bg: "var(--surface-hover)", fg: "var(--text-secondary)" },
  accent: { bg: "var(--accent-soft)", fg: "var(--accent)" },
  success: { bg: "var(--success-soft)", fg: "var(--success)" },
  warning: { bg: "var(--warning-soft)", fg: "var(--warning)" },
  danger: { bg: "var(--danger-soft)", fg: "var(--danger)" },
};

function Badge({ children, tone = "neutral", dot = false }) {
  const t = TONES[tone] || TONES.neutral;
  return React.createElement(
    "span",
    {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "4px 10px",
        borderRadius: "var(--radius-full)",
        background: t.bg,
        color: t.fg,
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--weight-semibold)",
        letterSpacing: "var(--tracking-wide)",
        textTransform: "uppercase",
      },
    },
    dot &&
      React.createElement("span", {
        style: {
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: "currentColor",
          animation: tone === "success" ? "cl-pulse-live 1.6s ease-in-out infinite" : "none",
        },
      }),
    children
  );
}

__Countlink.Badge = Badge;
}
// --- components/feedback/Dialog.jsx ---
{

function Dialog({ open, onClose, title, children, footer }) {
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

__Countlink.Dialog = Dialog;
}
// --- components/feedback/Tag.jsx ---
{

function Tag({ children, onRemove, color }) {
  return React.createElement(
    "span",
    {
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "3px 8px 3px 10px",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        color: color || "var(--text-primary)",
        fontFamily: "var(--font-ui)",
        fontSize: "var(--text-xs)",
        fontWeight: "var(--weight-medium)",
      },
    },
    children,
    onRemove &&
      React.createElement(
        "button",
        {
          onClick: onRemove,
          "aria-label": "Remove",
          style: {
            border: "none",
            background: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            fontSize: "13px",
            lineHeight: 1,
            padding: 0,
          },
        },
        "×"
      )
  );
}

__Countlink.Tag = Tag;
}
// --- components/feedback/Toast.jsx ---
{

const TONES = {
  neutral: "var(--n-4)",
  success: "var(--success)",
  danger: "var(--danger)",
};

function Toast({ open, onDismiss, tone = "neutral", children, duration = 4000 }) {
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

__Countlink.Toast = Toast;
}
// --- components/feedback/Tooltip.jsx ---
{

function Tooltip({ children, label, side = "top" }) {
  const [show, setShow] = useState(false);
  const pos = {
    top: { bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" },
    bottom: { top: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)" },
    left: { right: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" },
    right: { left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)" },
  }[side];

  return React.createElement(
    "span",
    {
      style: { position: "relative", display: "inline-flex" },
      onMouseEnter: () => setShow(true),
      onMouseLeave: () => setShow(false),
    },
    children,
    show &&
      React.createElement(
        "span",
        {
          style: {
            position: "absolute",
            ...pos,
            background: "var(--n-9)",
            color: "var(--n-0)",
            fontFamily: "var(--font-ui)",
            fontSize: "var(--text-xs)",
            fontWeight: "var(--weight-medium)",
            padding: "5px 9px",
            borderRadius: "var(--radius-sm)",
            whiteSpace: "nowrap",
            boxShadow: "var(--shadow-sm)",
            zIndex: 30,
            pointerEvents: "none",
            animation: "cl-fade-in var(--duration-fast) var(--ease-out)",
          },
        },
        label
      )
  );
}

__Countlink.Tooltip = Tooltip;
}
// --- components/forms/Button.jsx ---
{

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

function Button({
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

__Countlink.Button = Button;
}
// --- components/forms/Checkbox.jsx ---
{

function Checkbox({ label, checked, onChange, disabled = false }) {
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

__Countlink.Checkbox = Checkbox;
}
// --- components/forms/IconButton.jsx ---
{

function IconButton({
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

__Countlink.IconButton = IconButton;
}
// --- components/forms/Input.jsx ---
{

function Input({
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

__Countlink.Input = Input;
}
// --- components/forms/Select.jsx ---
{

function Select({ label, options = [], value, onChange, placeholder = "Select…", size = "md" }) {
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

__Countlink.Select = Select;
}
// --- components/forms/Switch.jsx ---
{

function Switch({ label, checked, onChange, disabled = false }) {
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

__Countlink.Switch = Switch;
}
// --- components/product/ShareLink.jsx ---
{

/**
 * A read-only share URL with a one-click copy button — the primary distribution
 * mechanism of the entire product (a synced timer is only useful once shared).
 */
function ShareLink({ url }) {
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

__Countlink.ShareLink = ShareLink;
}
// --- components/product/SyncBadge.jsx ---
{

/**
 * Small cluster of overlapping avatar dots + a live count — shows who else
 * is synced to this same timer right now.
 */
function SyncBadge({ count = 0, avatars = [], live = true }) {
  const shown = avatars.slice(0, 4);
  return React.createElement(
    "div",
    { style: { display: "inline-flex", alignItems: "center", gap: "8px", fontFamily: "var(--font-ui)" } },
    React.createElement(
      "div",
      { style: { display: "flex" } },
      shown.map((a, i) =>
        React.createElement(
          "div",
          {
            key: i,
            style: {
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              background: `oklch(0.6 0.14 ${(i * 47 + 200) % 360})`,
              border: "2px solid var(--surface)",
              marginLeft: i === 0 ? 0 : "-8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "10px",
              fontWeight: 700,
              color: "var(--n-9)",
            },
          },
          (a || "?").slice(0, 1).toUpperCase()
        )
      )
    ),
    React.createElement(
      "span",
      { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "var(--text-sm)", color: "var(--text-secondary)" } },
      live &&
        React.createElement("span", {
          style: {
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: "var(--success)",
            animation: "cl-pulse-live 1.6s ease-in-out infinite",
          },
        }),
      `${count} synced now`
    )
  );
}

__Countlink.SyncBadge = SyncBadge;
}
// --- components/product/TimerDisplay.jsx ---
{

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

function TimerDisplay({ totalSeconds = 0, size = "lg", direction = "down", label }) {
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

__Countlink.TimerDisplay = TimerDisplay;
}
window.Countlink = __Countlink;
})();
