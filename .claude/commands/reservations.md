---
description: "Find reservations by home, owner, status or dates."
---
# Reservations

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- reservations [--home=] [--owner=] [--status=] [--from=] [--to=]
```

Show the list; offer /reservation for the detail of one.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
