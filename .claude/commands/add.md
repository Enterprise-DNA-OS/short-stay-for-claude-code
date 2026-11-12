---
description: "Add a home, owner, cleaner or channel."
---
# Add

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- add <home|owner|cleaner|channel> --name= ...
```

For a home ask for the rules it lives under (nsw-cap, byron-cap, nsw, wa-perth, wa-regional, vic, qldc, none), the night cap, the registration number and expiry, the fee and the cleaning figures.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
