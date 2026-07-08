Custom dropdown for short option lists: timer type, timezone, sound, visibility.

```jsx
<Select label="When it hits zero" options={[
  { value: "stop", label: "Stop at zero" },
  { value: "countup", label: "Count up past zero" },
]} value={mode} onChange={setMode} />
```
