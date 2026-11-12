---
description: "Bring reservations and listings across from Guesty."
---
# Import

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- import guesty <reservations.csv> [--listings=listings.csv] [--owner="Name"] [--date-order=dmy|mdy]
```

Read docs/replace-guesty.md first. Always run without --apply first and show the summary and skipped rows. If columns are missing, map them with the operator. Run with --apply only on a yes. Then run /attention and /homes so they can set owners, rules and registration numbers.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
