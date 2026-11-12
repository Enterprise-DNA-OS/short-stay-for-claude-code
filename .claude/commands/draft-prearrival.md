---
description: "Draft pre-arrival notes for everyone arriving in the next two days, or one reservation."
---
# Draft prearrival

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- draft-prearrival [code] [--days=2]
```

Fill the check-in details from CLAUDE.md. Never put a door code in a draft.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
