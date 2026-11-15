---
name: 6x6 period picker
description: Why the period picker uses a native browser dropdown instead of the shared custom popup.
---

Keep the 6x6 period picker as a native browser select.

**Why:** The user repeatedly reported that the custom dropdown immediately closed in the actual embedded preview, even though standalone and simulated iframe browser checks passed. Those checks did not establish that the user's issue was resolved.

**How to apply:** Preserve native period selection during future 6x6 work. Do not restore the custom popup based solely on standalone browser checks or claim the exact preview issue is verified without matching evidence.
