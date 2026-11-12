# The CLI

Every slash command runs one line of `scripts/stays.mjs`. Run `npm run stays -- help` for the full list. Add `--json` to any report for machine output.

Names match exactly first, then by fragment, case-insensitive. A reservation can be found by its code or the guest's name. When a name matches more than one record, the CLI lists them and exits 1.

| Area | Commands |
|---|---|
| The day | `attention`, `arrivals`, `departures`, `turnovers`, `cleans`, `calendar <home>` |
| Guests | `reservations`, `reservation <code>`, `book`, `cancel`, `check-in`, `check-out`, `pay`, `repeat-guests` |
| Cleans | `assign-clean <code> <cleaner>`, `clean-done <code>`, `cleaners` |
| Owners | `owners`, `owner <name>`, `statements`, `statement <owner> --month=YYYY-MM [--save|--issue|--paid]`, `block`, `expense`, `issue`, `resolve`, `issues` |
| Rules | `compliance`, `night-caps`, `levy`, `record-levy` |
| The business | `homes`, `performance`, `channels`, `pace`, `weekly-review` |
| Records | `add`, `set`, `log`, `import guesty`, `export` |
| Drafts | `draft-owner-update`, `draft-prearrival`, `draft-clean-sheet` |

Money is stored in cents and printed in dollars. Dates are calendar dates; a stay's nights run from the arrival date to the night before departure. Owner statements count stays by the month they end in.

`settings.as_of` pins "today" for testing. Leave it empty in real use.
