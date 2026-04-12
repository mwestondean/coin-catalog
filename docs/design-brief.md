# Coin Submission & Cataloguing App -- Design Brief

For: Claude Code build session
Author: Design conversation between Weston and Claude (Opus 4.6), April 11, 2026
Status: Ready to build. All architectural decisions locked.

## 1. Project Summary

A web application for cataloguing raw coins, photographing them, predicting grades (the "wager"), generating professional grading service submission packets, and reconciling predictions against actual results when coins return graded.

Initial scope: Mexican 20 Centavos, 1905-1943 series. Architecture must generalize to other denominations and other series.

Primary user: Tish (Weston's wife). She is doing this as a 40th birthday gift for Weston. UX must be approachable for a non-technical user. No CLI. No Python install on her machine. Browser-only access.

Secondary user: Weston. Backend admin, occasional power user.

## 2. Verified NGC Submission Reality (April 2026)

These facts were verified via NGC's official sources during the design conversation. Do not re-research; use as ground truth.

### 2.1 Submission method

There is no fully online submission API. NGC's "online" form is a PDF generated from the member homepage that auto-calculates fees, then is printed and mailed with the coins.

Source: https://www.ngccoin.com/news/article/1427/NGC-Introduces-PDF-Submission-Form-Online/

Implication: the app generates a CSV/printout mapped to NGC form line order that Tish/Weston transcribe into NGC's PDF. The app does NOT generate NGC's actual PDF; that is issued from the member account with a unique invoice number.

### 2.2 Membership requirement

Direct submission requires NGC Collector membership (Associate, Full, or Premium).

Source: https://www.ngccoin.com/about/help-center-faqs/submitting-to-ngc/general-submission-faqs/

### 2.3 Tier for Mexican 20C 1905-1943

Economy tier, $25/coin. Non-gold world coins struck before 1990 qualify.

Source: NGC Collector Pricing PDF, March 17, 2026 revision.

### 2.4 Current fees (verified March 17, 2026)

| Tier | Price | Max Value |
|------|-------|-----------|
| Modern | $20 | $3,000 |
| Economy | $25 | - |
| Standard | $45 | $3,000 |
| Gold | $45 | $5,000 |
| Express | $80 | $10,000 |
| WalkThrough | $175 | $25,000 |
| Unlimited WalkThrough | $350 + 1% FMV | - |

Additional fees:
- Handling fee: $10 per invoice (not per coin)
- Fast Track add-on: +$15/coin (Standard/Economy/Modern only)
- VarietyPlus: +$20/coin
- Mint Error: +$20/coin
- Internet Imaging: $5/coin
- PhotoVision Plus: $8/coin
- Pedigree: +$5/coin
- Special Label: +$8/coin

### 2.5 Form rules

- Max 50 coins per non-bulk submission form
- Required per-coin description: denomination, year (or date range), geographic location, ruler name (as applicable)
- Missing description = $5/coin attribution penalty applied to entire form
- App must enforce complete descriptions before allowing batch export

### 2.6 VarietyPlus for 20C 1905-1943

Variety list lives at https://www.ngccoin.com/variety-plus/mexico/mexico-1905-to-date/20c/159942/

Page is Angular-rendered. Cannot be scraped via fetch. Confirmed during design.

Implication: the app maintains a local variety_reference table that Weston/Tish populate manually by visiting the page in a browser. One-time setup per series.

### 2.7 NGC Registry blocks bot access (403)

Confirmed during design. No automated registry sync possible without an authenticated session or an API Weston has not yet identified.

Pop refresh is a stub for now.

## 3. Architectural Decisions (Locked)

### 3.1 Stack

- Backend: FastAPI + Postgres
- Frontend: React + shadcn/ui
- Auth: JWT
- Infra: Vultr Ubuntu, Nginx, Cloudflare
- Deployment: Live on a Weston-owned domain (TBD)
- Image storage: Server filesystem, served via Nginx with auth check

### 3.2 Multi-grader architecture

Grader-agnostic from day one. NGC fully implemented, PCGS stubbed.

Grader logic lives in modules: `graders/ngc.py`, `graders/pcgs.py` (stub raising NotImplementedError).

Common interface: tier selection, fee calculation, form export, variety attribution lookup.

### 3.3 Source of truth

Postgres database. Not xlsx. Not SQLite.

Weston's existing `D:\Coins\Mexico Coin Collections_MASTER.xlsx` stays untouched as historical reference.

App provides export xlsx endpoint that generates a fresh spreadsheet view from Postgres on demand.

### 3.4 Per-coin vs per-issue

Per-coin rows. Weston has many duplicates of the same year/mint.

The xlsx export rolls per-coin data up into per-issue summary rows for the "collection view."

## 4. Database Schema

### 4.1 Table: coins (42 fields)

**Identity & physical (1-10):**
1. coin_id (PK) -- format {denom}-{year}-{seq}, e.g. 20c-1907-006
2. denomination -- 20c, 10c, 50c, un_peso, 5_peso, 8_reales
3. date_added -- timestamp, immutable
4. year -- integer
5. mint_mark -- text, nullable
6. km_number -- text
7. variety_code -- text, nullable
8. variety_attribution_source -- text, nullable
9. ngc_variety_attribution -- text, nullable
10. pcgs_variety_attribution -- text, nullable

**Provenance & cost (11-13):**
11. source -- text
12. acquisition_date -- date
13. paid_usd -- decimal

**Condition assessment (14-16):**
14. raw_grade_estimate -- text, Sheldon scale
15. problem_flags -- text array
16. details_risk -- boolean

**Imaging (17-19):**
17. obverse_image_path -- text
18. reverse_image_path -- text
19. image_capture_date -- timestamp

**Wager: hand prediction (20-23):**
20. predicted_grade_hand -- text
21. predicted_details_hand -- boolean
22. confidence_hand -- enum (low, medium, high)
23. prediction_date_hand -- timestamp, immutable once set

**Wager: screen prediction (24-26):**
24. predicted_grade_screen -- text, nullable
25. predicted_details_screen -- boolean, nullable
26. prediction_date_screen -- timestamp, nullable

**Submission packet (27-34):**
27. grader -- enum (NGC, PCGS, Raw)
28. submission_status -- enum (staged, on_form, shipped, at_grader, graded, returned, held_back)
29. tier -- text
30. declared_value_usd -- decimal
31. variety_plus_requested -- boolean
32. submission_invoice_number -- text, nullable
33. line_number_on_form -- integer, nullable, 1-50
34. ship_date -- date, nullable

**Results (35-38):**
35. cert_number -- text, nullable
36. actual_grade -- text, nullable
37. actual_details -- text, nullable
38. return_date -- date, nullable

**Pop snapshots:**
39. ngc_pop_at_submission -- integer, nullable
40. pcgs_pop_at_submission -- integer, nullable

**Misc:**
41. notes -- text
42. registry_set_id -- text, nullable

### 4.2 Table: pop_reference

One row per unique (km_number, year, mint_mark, variety_code) tuple. Stub refresh mechanism.

### 4.3 Table: batches

batch_id, name, grader, created_date, shipped_date, returned_date, invoice_number.

### 4.4 Table: variety_reference

Local cache of recognized varieties per (grader, denomination, year). Manually populated.

## 5. UX Requirements

### 5.1 Cataloguing flow

- One coin at a time, single page
- Large image upload area (drag-drop obverse and reverse)
- Year/mint/KM as dropdowns where possible
- Variety code as autocomplete from variety_reference
- Auto-assigns coin_id
- Hand prediction is required before save (this is the wager)
- Friendly validation errors, no stack traces

### 5.2 Image naming convention

Server-side rename on upload: `{coin_id}_O.{ext}` and `{coin_id}_R.{ext}`

### 5.3 Batch builder

- Visual grid of staged coins with thumbnails
- Drag to reorder line numbers
- Live fee total with line items
- Enforces 50-coin max per batch
- Enforces complete descriptions before export
- Export: CSV mapped to NGC form order, printable PDF cheat sheet, packing checklist

### 5.4 Reconciliation

Simple form: enter cert number + actual grade + actual details.
Auto-calculates prediction_hit (exact / within 1 / within 2 / miss).

### 5.5 Wager scorecard

- Hit rate by confidence level
- Average miss distance (predicted vs actual on Sheldon scale)
- Problem-flag accuracy
- Hand vs screen prediction comparison

## 6. Open Items

- Domain choice (TBD by Weston)
- PCGS submission rules (deferred)
- Pop data endpoint (Weston will provide; stub for now)
- xlsx export format (review master file first)
- Registry layer (out of scope for v1)

## 7. Out of Scope for v1

- PCGS implementation (architecture ready, content not)
- Pop data refresh (stubbed)
- Registry set management
- Mobile-native app
- Multi-series support beyond 20 Centavos

## 8. Reuse-First Mandate

Search order for every component: shadcn/ui registry, community registries, GitHub, official library examples, then bespoke.

## 9. Build Order

1. Postgres schema + migrations
2. FastAPI core: auth, CRUD on coins, batches
3. NGC grader module (fee calc, tier selection, form export)
4. Image upload + storage
5. React frontend: cataloguing, batch builder, reconciliation, scorecard
6. Deploy to Vultr
7. Weston tests with small batch
8. Tish onboarding session

## 10. Style & Convention Notes

- No em dashes
- Date format: MM-DD-YYYY
- No PA- prefix
- Match ACC/Polify stack patterns
- Linting: ruff + black (backend), eslint + prettier (frontend)
