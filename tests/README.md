# Tests

Real-browser tests. They drive the built `index.html` through Chromium and assert
on what the page actually renders, which is how most of the bugs in this project
were found.

## Running them

```bash
cd tests
npm install                 # pulls Playwright
npx playwright install chromium

# in one terminal — serve the repo root
npm run serve

# in another
npm run cart
npm run reminders
# ...or any script listed in package.json
```

Serve over **HTTP, not `file://`**. Browsers partition storage differently for
`file://` origins and the reminder tests give false failures there.

`BASE_URL` overrides the address if you serve on a different port.

## What each one covers

| Script | Covers |
|---|---|
| `gate` | Sign-in, passcode encryption, unlock, wrong passcode, lock/unlock round trip |
| `reminders` | 1-day and 30-minute reminders firing, no duplicates after reload, routing |
| `deletes` | Deleting tasks from the list, the edit sheet, and the Done filter; persistence |
| `ghosts` | Reminders disappearing along with the thing they pointed at |
| `legacy` | Cleaning up reminders saved before they carried a reference |
| `library` | Ingredient search, cuisine and category filters, the nutrition card |
| `cart` | Drag into and out of the cart, own items, ticking off, reload, emptying |
| `planner` | Meal drag-and-drop, grocery aggregation, calendar entries |
| `names` | Task names staying legible on the calendar at every width |
| `supplies` | Supply shelves and search, into the cart, ticking off, reload |
| `repeats` | Frequencies landing on the day, catching up, not doubling up, stopping |
| `categories` | The shelf tree, walking down to a leaf, your own shelves and sub-shelves, your own things |
| `suggestions` | Cold-start staples, then what you actually buy, cook with and plan |
| `meals` | Meal types on a dish, the rail's search and chips, the grid's row labels |
| `users` | Two names keeping separate boards, the picker, switching, a locked board |
| `migrate` | A board from the single-board version being adopted by its owner |
| `taskrepeat` | All seven repeat kinds, rolling forward, skipping weekends, editing one |
| `mine` | Mine filling itself from what you buy, cook with, repeat and type in |
| `mineing` | The recipe builder's Mine tab: ranking, search, plus, drag, your own things |
| `keep` | The star on a library row keeping a thing in Mine, and taking it back out |
| `theme` | Auto / Light / Dark, surviving a reload, and the sign-in gate honouring it |

Screenshots land in `tests/screenshots/`.
