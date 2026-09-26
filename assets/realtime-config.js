/* Phone-control feature switch — see assets/realtime.js and docs/phone-control-setup.md.

   This file used to hold the Ably API key itself, which made it public and
   let anyone holding a share link control the room's screen. Since
   2026-09-26 the key lives only in the Cloudflare Pages secret ABLY_API_KEY,
   read by functions/api/realtime-token.js, and this file is just the on/off
   switch for the UI.

   false -> no "control from my phone" checkbox, no control link, no Ably
            script ever loaded; every realtime code path is inert.
   true  -> the feature appears. It also needs ABLY_API_KEY set on the Pages
            project, or /api/realtime-token answers 503 and the feature fails
            quietly (the countdown itself is unaffected either way). */
window.COUNTLINK_PHONE_CONTROL = true;
