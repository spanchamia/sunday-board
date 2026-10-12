# Version 1 data model (agreed 2026-10-10)

What the app stores and how it connects. Written for the owner to check against how
the household works; technical notes are at the end of each section. Database:
Postgres on Supabase. Every family-owned table carries `family_id`, and the database
itself only lets members of that family read or change those rows.

## Core (shared by every feature)

| Table | What it is | Key fields |
|---|---|---|
| `families` | A household | name |
| `family_members` | Who belongs to a family | family, user, role (owner / member) |
| `categories` | The My Home tree: *My Home › Kitchen › Vegetables*. Any depth | family, **parent** (empty for the top), name, order, default restock mode |
| `stores` | Where the family shops | family, name, order |
| `items` | Things the household buys: food, cleaning, toiletries… | family, category, catalogue item (optional), name, **restock mode**, restock every (days, set by family), learned rhythm (days, worked out by the app), usual amount (text, optional), notes |
| `item_stores` | Which stores carry an item | item, store, preferred? |
| `item_events` | History that teaches the app | item, **kind** (bought / have it), date, who, store (optional) |

- **Restock mode** replaces "staple vs. fresh" and works for any item:
  *Staple*: restocked on a rhythm (spices, rice, detergent, toilet paper).
  *As needed*: bought for a reason (vegetables for a planned dish).
  A category sets the default (Spices → Staple, Vegetables → As needed), inherited by
  sub-categories; an item follows it (`items.restock_mode` blank) unless it has its own
  setting, which is an exception (migration 0005).
- **Rhythm** = learned rhythm if there is enough history, else the family's setting,
  else a default for the category. Learned rhythm = typical gap between recent
  purchases, nudged by "Have it" taps.

## The catalogue (shared by all families, read-only)

| Table | What it is | Key fields |
|---|---|---|
| `catalog_items` | The "universe" of things households buy, used to set up and add items quickly | name, other names (e.g. *Toor dal* / *arhar dal*), suggested category path, suggested restock mode, tags (e.g. Indian staple), typical sizes (optional) |
| `starter_packs` | Ready-made sets for setup: "Indian kitchen basics", "Cleaning", "Toiletries"… | name, list of catalogue items |

- Seeded from Sunday Board's library: 1,896 ingredients (17 aisles) and 5,053
  supplies, which collapse to ~2,170 products once size variants ("250 ml", "1 L")
  become optional sizes. Cooked forms and nutrition are not used in v1.
- A family item can point at a catalogue item (`items.catalog_item` — optional), so
  typing your own item is always allowed. The link later helps shared dishes (G8) and
  Instacart matching (G10).
- Adding an item: type a few letters → your own items first, then catalogue matches
  → one tap files it in My Home with the suggested category and restock mode.

## Meals

| Table | What it is | Key fields |
|---|---|---|
| `meal_types` | The family's own: School lunch, Breakfast, Dinner… | family, name, order, usual time |
| `dishes` | A family's dish | family, name, notes, make every (days, optional), good on weekdays? weekends? |
| `dish_meal_types` | Which meal types a dish suits | dish, meal type |
| `dish_ingredients` | What a dish needs | dish, **item**, amount (text, optional) |
| `dish_prep_steps` | "Soak idli rice, 2 days before" | dish, name, how long before (minutes), order |
| `meal_type_items` | Ready items that suit a meal type (yogurt, pickle) | meal type, item |
| `planned_meals` | One dish (or ready item) on one day for one meal type | family, date, meal type, dish **or** item, who planned it |

- Ingredients point straight at items, so their category comes from the item; no
  separate "ingredient groups" like TenBy12.

## Calendar & tasks

| Table | What it is | Key fields |
|---|---|---|
| `tasks` | Prep tasks and to-dos | family, title, due (date + optional time), done at, **visibility** (family / just me), owner, **planned meal** + **prep step** (for prep tasks) |

- Prep tasks are created from a planned meal's dish prep steps and stay linked:
  move the meal and they move; remove it and they go.
- The calendar is a view: planned meals + tasks by day. (Events with times can be
  added later without changing these tables.)

## Shopping

| Table | What it is | Key fields |
|---|---|---|
| `list_entries` | One row per item on the list | family, item, **amount hint** (usual / extra / just a bit), amount (text, optional), store (optional override), **status** (to buy / in bag / bought / removed), added by, added at |
| `list_entry_reasons` | Why it is on the list (can be several) | entry, **reason** (planned meal / restock due / added by hand / added from a dish), planned meal or dish (when relevant) |

- One open entry per item, many reasons: tomatoes "for Chole, Tue and Sambhar, Thu".
- **Have it** removes the entry, records an `item_events` "have it", and pushes the
  item's next due date out. **Bought** records an `item_events` "bought" (and resets
  the rhythm clock). Marking the bag bought does that for every item in the bag.
- Split by store = group open entries by the entry's store, else the item's preferred
  store, else "Any store".
- Restock due items are worked out from `items` + `item_events`; they join the list
  as entries with the reason "restock due".

## Commands (every action in one place)

Screens, a future assistant (G11) and integrations (G10) all use the same named
commands, e.g. `addToList`, `markHaveIt`, `markBought`, `markBagBought`,
`planMeal`, `movePlannedMeal`, `removePlannedMeal`, `addDishNeeds`,
`completeTask`, `refreshRestock`.

## Importing TenBy12

| TenBy12 | Becomes |
|---|---|
| Families, Users (real family only) | `families`, `family_members` (both sign in again) |
| meta categories + item categories | `categories` under *My Home* (Kitchen ones under *My Home › Kitchen*) |
| items (316; ~20 duplicate names) | `items`, duplicates merged by name; "every 0 weeks" → As needed, otherwise Staple with that rhythm |
| items → stores | `item_stores` |
| purchase history (242) | `item_events` (bought) |
| dish categories (meal types) | `meal_types` |
| dishes + ingredient groups | `dishes`, `dish_ingredients` (groups flattened) |
| dish todos | `dish_prep_steps` |
| dish category items (yogurt, pickle) | `meal_type_items` |
| plans + plan dishes | `planned_meals` (history kept, feeds dish suggestions) |
| shopping list | `list_entries` (added by hand) |
| todos | open ones → `tasks` |
| archery_*, generate, test users | not imported |

## Confirmed with the owner (2026-10-10)
- Only to-dos can be private ("just me"); everything else is shared in the family.
- A person belongs to one family at a time.
- Meals are mostly one dish per day × meal type; special occasions add several
  dishes to the same slot (several `planned_meals` rows), which the model allows.

## Left out of v1 on purpose
Events with times, other families/invites UI, shared dish library, delivery
ordering, voice assistant, tablet view. The tables above leave room for each.
