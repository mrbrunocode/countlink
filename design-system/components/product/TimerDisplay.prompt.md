The hero component of the entire product — a large, monospaced, tabular-figure countdown/count-up. This is what every synced viewer stares at.

```jsx
<TimerDisplay totalSeconds={3725} size="xl" direction="down" label="Until launch" />
```

Auto-hides the hours/days segment when zero so a 5-minute timer doesn't show `00:00:04:32`. Color shifts to `--success` once counting up past zero, `--danger` in the final moment at zero. Always use `--font-display` (JetBrains Mono) with `fontVariantNumeric: tabular-nums` — never the UI sans — so digits don't shift width as they tick.
