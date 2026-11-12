---
description: "Log a repair or problem at a home."
---
# Issue

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- issue <home> --title= [--priority=urgent|normal|low] [--quote=] [--status=open|waiting_owner|booked]
```

If the owner must approve the cost, set --status=waiting_owner.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
