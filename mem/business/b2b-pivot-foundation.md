---
name: B2B pivot foundation
description: App is repositioned for marketing & ad-creative teams. Workspaces, brand kits, and team onboarding form the core.
type: feature
---
- **Wedge:** Marketing & ad creative for B2B teams (not consumers).
- **Landing:** Pure B2B (B2BHero, B2BUseCases, B2BPlatformPillars, B2BROISection, B2BFinalCTA). NO consumer immersive video, gallery, or "creators" social CTAs.
- **Onboarding:** 5-step flow — Profile → Workspace → Brand basics → Use case → Invite team. Workspace + brand colors + invites are created inside Onboarding.tsx (not just the personal workspace from the signup trigger).
- **Pricing:** Keep credit-based ($0.10/credit) for now, no seats.
- **Sunset routes (do not re-add):** /creators, /user/:userId, /social, /gallery, /discover all redirect to /projects.