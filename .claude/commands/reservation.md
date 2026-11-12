---
description: "One reservation in full: money, payments and its clean."
---
# Reservation

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- reservation <code or guest name>
```

Lead with anything wrong: a balance, no clean, a clash.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
