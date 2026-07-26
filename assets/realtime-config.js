/* Phone-control feature switch — see assets/realtime.js and docs/phone-control-setup.md.
   Empty by default: every board/setup-panel/control-page code path checks
   COUNTLINK_ABLY_KEY before doing anything, so an unconfigured site behaves
   in every observable way exactly like it did before this file existed —
   no "Enable phone control" checkbox, no Ably script ever loaded, nothing
   to review differently on any other page.

   To turn it on: create a free Ably account (no card required) at
   ably.com, add an API key scoped ONLY to "Publish, Subscribe, Presence"
   capability on channels matching "countlink:*", and paste the key below.
   That scoping matters because this key ships in public page source (there
   is no server to hide it behind) — restrict it so a copy of the key is
   only ever good for countdown pub/sub, never account admin. */
window.COUNTLINK_ABLY_KEY = "";
