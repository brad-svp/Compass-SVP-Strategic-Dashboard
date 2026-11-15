---
name: Object Storage client compatibility
description: Compatibility of the supplied Replit sidecar client with Google Storage SDK majors.
---

Keep the supplied sidecar client configuration intact and verify its SDK compatibility before major upgrades.

**Why:** With the supplied empty-project-ID client, Google Storage SDK 9 and Google Auth 11 failed actual object reads with “Unable to detect a Project Id.” The compatible Storage 7 / Auth 9 combination passed real upload, decoding, private image serving and deletion, without changing the sidecar credential setup. Unit tests alone did not catch this.

**How to apply:** When upgrading either SDK or changing upload infrastructure, exercise a real direct upload, finalization and authorized image read—not just signing a URL. Keep test assets isolated and remove their storage objects and database records afterward.
