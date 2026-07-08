Modal for focused decisions: confirm "End for everyone", edit timer settings, join a synced session.

```jsx
<Dialog open={open} onClose={close} title="End this countdown?"
  footer={<>
    <Button variant="ghost" onClick={close}>Cancel</Button>
    <Button variant="danger" onClick={confirmEnd}>End for everyone</Button>
  </>}>
  Everyone watching will see it stop immediately.
</Dialog>
```
