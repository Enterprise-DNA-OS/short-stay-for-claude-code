---
description: "The clean run sheet, for everyone or one cleaner."
---
# Cleans

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- cleans [--days=3] [--cleaner=<name>]
```

Order by date, same-day turnovers first. Offer /draft-clean-sheet to send each cleaner their list.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
