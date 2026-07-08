Toggle for binary settings that take effect immediately: "Public link", "Allow join requests".

```jsx
<Switch label="Anyone with the link can join" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
```
