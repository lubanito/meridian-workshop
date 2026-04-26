# Technical Approach

**RFP #MC-2026-0417 — Inventory Dashboard Modernization**

---

## Overview

Our approach is sequenced to unblock Meridian's team as quickly as possible while managing the risk of inheriting an incompletely documented codebase. We begin with an independent architecture review — not because it is the highest priority requirement, but because it is the prerequisite to scoping everything else accurately. The previous vendor's handoff documentation is minimal; we will not commit to fixed estimates on R1 or R2 until we have verified current state ourselves.

From there we work in Meridian's stated priority order: Reports remediation (R1), automated testing (R3), and Restocking (R2). We sequence R3 before R2 deliberately — Meridian IT's requirement for test coverage is a gatekeeper, and establishing that foundation before adding new features means the Restocking view ships with coverage from day one.

The desired items (D1–D3) are treated as a separate phase, scoped and priced after R1–R4 are complete.

---

## R4 — Architecture Review

We will conduct an independent audit of the codebase rather than relying on the previous vendor's notes. Our review will cover:

- **Frontend:** Vue 3 component structure, routing, state management, API client patterns, i18n setup
- **Backend:** FastAPI route organization, data loading and filtering logic, Pydantic models
- **Data layer:** JSON file structure in `server/data/`, mock data patterns, filter behavior across endpoints
- **Gaps and risks:** Incomplete migrations (Options API → Composition API), undocumented behavior, anything that affects scope estimates for R1–R2

**Deliverable:** A current-state architecture overview — HTML diagram plus written narrative — suitable for handoff to Meridian IT. Produced during the onboarding phase; available before R1 work begins.

---

## R1 — Reports Module Remediation

The previous vendor confirmed the Reports module was unfinished at handoff ("not all filters wired up"). We treat this as remediation of incomplete work, not routine bug fixing.

**Approach:**
1. Systematic audit of the Reports page against all four filter dimensions (Time Period, Warehouse, Category, Order Status) and their interaction with the backend API
2. Document every defect found before any fixes are applied — Meridian will see the full list, not a subset
3. Resolve defects in order of user impact: filter wiring first, then i18n gaps, then API pattern inconsistencies and console noise
4. Verify fixes against the backend data layer, not just the UI

**Assumption:** No existing bug log will be provided; the audit is treated as in-scope. If Meridian shares a bug log prior to kickoff, we will reconcile it against our findings and adjust.

---

## R3 — Automated Browser Testing

We sequence R3 immediately after R1 for two reasons: IT's testing requirement effectively gates approval of all subsequent changes, and establishing coverage after Reports remediation but before Restocking means new features are covered from the start.

**Approach:**
- End-to-end tests using Playwright against the running application
- Coverage targets: inventory browsing and filtering, order views, Reports page (post-remediation), Restocking view (once built in R2)
- Tests will run against localhost in development and are structured for CI integration

**Assumption:** "Critical flows" are defined as the four primary views plus any filter interactions Meridian IT identifies at kickoff. We will confirm the list before writing tests.

---

## R2 — Restocking Recommendations

New capability: a Restocking view that recommends purchase orders given current stock levels, demand forecast, and an operator-supplied budget ceiling.

**Approach:**
- **Frontend:** New Vue 3 view integrated into the existing navigation. Operator inputs a budget ceiling; the view displays ranked purchase order recommendations with stock shortfall, demand signal, and estimated cost per item.
- **Backend:** New FastAPI endpoint that aggregates data from the existing inventory and demand APIs, applies a prioritization algorithm (shortfall severity × demand urgency), and filters to fit within the budget ceiling.
- **Data:** No external procurement system integration in this phase. Output is display-only within the dashboard.

**Assumption:** The Restocking view is self-contained within the dashboard; no integration with external purchasing or ERP systems is required.

---

## D1–D3 — Desired Items (Phase 2)

These items will be scoped and priced as a separate phase once R1–R4 are complete.

- **D1 (UI modernization):** Visual design refresh. "Current standards" will be defined collaboratively at phase 2 kickoff — we will present options if Meridian does not have an existing brand guide.
- **D2 (Internationalization):** Extend i18n support to remaining modules. The Tokyo team is the primary beneficiary; Japanese localization is the first target language.
- **D3 (Dark mode):** Operator-selectable theme, implemented as a CSS design token layer over the existing component structure. Intended for low-light warehouse floor stations.

---

## Technology Stack

We will work within the existing stack and introduce no new frameworks without discussion:

| Layer | Technology |
|---|---|
| Frontend | Vue 3, Composition API, Vite |
| Backend | Python, FastAPI, Pydantic |
| Testing | Playwright (end-to-end) |
| Data | JSON files via existing mock data layer |
