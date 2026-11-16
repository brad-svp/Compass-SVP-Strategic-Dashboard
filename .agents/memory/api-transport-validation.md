---
name: API transport validation
description: Generated timestamp coercion can make real HTTP requests differ from direct service calls
---

Normalize transport-coerced timestamps before strict business validation; generated date-time body validators can produce a JavaScript Date even when the client contract sends an ISO string.

**Why:** Direct scorecard service tests passed while actual browser edits failed: the generated validator converted the optimistic timestamp to a Date, and a second validator accepted strings only.

**How to apply:** Test the generated request-body validator followed by the service, or run a real HTTP/browser round trip. Do not disable date coercion globally to fix one endpoint, because that can change unrelated contracts.
