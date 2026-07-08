Square icon-only button for toolbars, headers, and compact controls (mute, share, settings, close).

```jsx
<IconButton icon={<ShareIcon />} label="Share link" variant="outline" />
```

Always pass `label` — it's used as `aria-label` and native tooltip since there's no visible text. `active` shows a pressed/selected background (e.g. a toggled mute button).
