Proof-of-sync indicator — reassures the viewer that "everyone sees this same number." Place near the TimerDisplay, never far from it.

```jsx
<SyncBadge count={24} avatars={["A","S","J"]} live />
```

The pulsing green dot means "actively syncing" — turn `live` off once a session has ended so it doesn't falsely imply an active connection.
