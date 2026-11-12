---
description: "Note a call, email or visit against a home, owner, reservation, guest or cleaner."
---
# Log

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- log <home|owner|reservation|guest|cleaner> <name> --note= [--kind=note|call|email|visit|owner_approval|complaint]
```

Use --kind=owner_approval when an owner says yes to a cost.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
