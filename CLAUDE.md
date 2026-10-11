# CLAUDE.md

Context for Claude (and any collaborator) working in this repo.

## Start here

**Read `PLAN.md` first.** It holds the product goals (G1–G9), the phased plan,
design notes, decisions, previous iterations and open questions. Keep it current:

- Add finished work to the **Change log** (newest first, with the commit hash).
- Record any "we chose X over Y because…" under **Decisions**.
- Move items between **Backlog** → **In progress** → **Change log** as work happens.
- Note anything learned about earlier iterations in §1a.

## Where the project stands (as of 2026-10-07)

- The owner (Smidth) is building a home-management app for **families**: shared
  family boards synced across devices, meal planning, shopping that saves money
  (bulk / warehouse stores) and time (fewer trips), a curated "My Home" catalogue
  with nested categories, shareable dishes, and dish prep tasks on the calendar.
- This is the **third iteration**: (1) fcapp, Go + MySQL on a home desktop
  (spanchamia/fcapp, private; reviewed, see PLAN.md §1a), (2) FlutterFlow app "TenBy12" on Firebase
  (too slow), (3) this repo, forked from a collaborator's "Sunday Board".
- **Decision: fresh build.** The existing Sunday Board code in this repo is a
  *reference* (ingredient/supply data, nutrition maths, repeat logic, shelf tree),
  not the foundation. See PLAN.md §3a for why.
- **Proposed stack (not final):** installable web app (PWA); Supabase backend
  (Postgres, auth, realtime, row-level security per family); front end hosted on
  Cloudflare Pages. Open questions are in PLAN.md §8.
- **Design for extensibility:** shared core + feature modules + integration plug-ins
  (long-term: Instacart/DoorDash ordering, G10). Keep files small, one folder per
  module, typed code and tests, so changes stay quick and safe. See PLAN.md §3a.
- TenBy12 is in daily use by the owner's family; its Firebase export lives in
  `firebase-export/` (git-ignored, contains family data; never commit). Ignore the
  `archery_*` collections for now.
- **Version 1 scope is agreed (PLAN.md §3):** replace TenBy12 for the owner's family.
  Core is the weekend "Plan & Shop" flow (one list with reasons, staples vs. fresh,
  "Have it", optional Usual/Extra/Just a bit amounts, learned restock, split by store),
  plus My Home items, dishes, meal plan, linked prep tasks, sync, TenBy12 import.
  Don't build later-phase features into v1; do keep the design open for them.
- **Next steps:** design the v1 data model (from the TenBy12 export), pick the front-end
  toolkit, set up Supabase + Cloudflare accounts, then build step 1 (PLAN.md §3).

## The existing Sunday Board code

- `src/sunday-board.html` is the source. `index.html` is **generated**: never edit
  it by hand. Rebuild with `python3 src/build.py`.
- Data tables: `src/data/ingredients.txt`, `src/data/supplies.txt`
  (regenerate supplies with `python3 src/gen_supplies.py`).
- Tests: Playwright scripts in `tests/` (see `tests/README.md`); serve over HTTP,
  not `file://`.

## Working with the owner

- Explain things in plain language; the owner wants to understand the app, not
  just receive code.
- Don't change data in the owner's live apps (e.g. TenBy12) while exploring;
  look read-only and ask before any action that could create or delete data.
- Ask before committing or pushing unless asked to.
