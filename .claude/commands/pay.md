---
description: "Record money received on a reservation."
---
# Pay

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- pay <code> --amount= [--method=] [--reference=]
```

Show the new balance. This records a payment; it never takes one.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
