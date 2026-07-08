Primary interactive control for actions like "Start timer", "Create link", "Join".

```jsx
<Button variant="primary" size="md" onClick={handleCreate}>
  Create countdown
</Button>
```

Variants: `primary` (solid accent, main CTA — one per screen), `secondary` (bordered, elevated surface), `ghost` (text-only, low emphasis), `danger` (destructive actions like "End for everyone").

Sizes: `sm` (32px, inline/toolbar), `md` (40px, default), `lg` (48px, hero CTAs).

Pass `icon` for a leading icon element. `fullWidth` stretches to container — common in mobile sheets and forms.
