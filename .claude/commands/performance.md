---
description: "Each home over twelve months: nights, occupancy, rent, owner share, your margin and rating."
---
# Performance

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- performance
```

Name the homes that earn you least after cleaner pay, and why (low occupancy, low rate, high clean cost).

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
