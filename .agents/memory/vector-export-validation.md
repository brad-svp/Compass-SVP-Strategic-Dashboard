---
name: Vector export validation
description: Why logo exports require numeric SVG checks as well as visual inspection.
---

Validate generated SVG coordinates for non-finite values before accepting a logo package.

**Why:** A font outline serializer converted a near-integer floating-point value into an invalid coordinate. Rasterization still succeeded and silently distorted a letter, so a successful PNG export was not proof that the vector was valid.

**How to apply:** Pair numeric-path validation with inspecting the actual exported wordmark, not only a browser-rendered live-text approximation in the brand guide.
