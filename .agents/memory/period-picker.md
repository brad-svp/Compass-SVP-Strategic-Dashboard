---
name: Embedded preview control verification
description: Repeated embedded-preview failures contradicted successful standalone checks, including after native controls replaced custom popups.
---

Treat the user's embedded-preview failure reports as unresolved by a successful standalone browser check.

**Why:** Custom popup choices and their native-select replacements both immediately closed for the user in the actual Replit preview. Standalone and simulated same-origin iframe checks had passed, so those checks did not establish that the user's environment was fixed.

**How to apply:** Report the exact verification context and do not claim cross-origin embedded-preview behavior was tested without matching evidence. Follow the current interaction rules in replit.md rather than restoring a popup on the strength of a standalone pass.
