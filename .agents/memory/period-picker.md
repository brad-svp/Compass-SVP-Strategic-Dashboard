---
name: Embedded preview control verification
description: Repeated embedded-preview failures contradicted successful standalone checks, including after native controls replaced custom popups.
---

Treat the user's embedded-preview failure reports as unresolved by a successful standalone browser check.

**Why:** Custom popup choices and their native-select replacements both immediately closed for the user in the actual Replit preview. Standalone and simulated same-origin iframe checks had passed, so those checks did not establish that the user's environment was fixed.

**How to apply:** Report the exact verification context and do not claim cross-origin embedded-preview behavior was tested without matching evidence. Follow the current interaction rules in replit.md rather than restoring a popup on the strength of a standalone pass.

Mobile option lists can contain all expected records but render at zero height. Check the visible list's bounding box, not just its option count. A soft keyboard changes `visualViewport` independently of `innerHeight`; reserve actual space for the list beside its search and close controls.

**Why:** The user's iPad screenshot showed a populated program selector with no visible choices. Browser checks must cover rendering and actual selection, not just correct data.

**How to apply:** Include a reduced-height viewport and real selection interaction in regression checks. A Chromium check remains distinct from the user's actual iPad embedded Safari environment.

Dropdowns must close on an outside pointer click, retain interaction within the list, and have no "Close choices" button. Outside dismissal must not prevent the clicked form field from receiving focus.

**Why:** The user explicitly requested normal outside-click dismissal after seeing a persistent manual dropdown over the Brain form.

**How to apply:** Register outside-pointer handling after the opening click and exclude the trigger/list from dismissal; do not bring back blur-driven automatic dismissal.

Native modal dialogs also failed to accept typing for this user in the embedded preview, despite a standalone pass. Use the shared controlled modal overlay rather than restoring native `showModal()` based on a standalone success.

**Why:** Repeated QBO, Systems and narrative-form reports persisted after changing controls and modal implementations. A development banner also intercepted mobile modal headers during browser regression checks.

**How to apply:** Keep forms isolated from page stacking contexts and development overlays, and verify real pointer/keyboard interaction in an embedded frame and reduced-height viewport. Chromium embedded checks are not proof of actual iPad Safari behavior.

Keep the modal/popup workflow. The user explicitly rejected full-page editors as a workaround for the persistent focus issue.

**Why:** After requesting another form-formatting option, the user clarified that they really liked popups and wanted the focus problem fixed without changing that workflow.

**How to apply:** Diagnose click cancellation, competing focus scopes and preview instrumentation while preserving modals. Test a text control after cancelling its native mouse-down focus, not only ordinary clicks. Do not treat successful simulated embedded tests as user confirmation.
