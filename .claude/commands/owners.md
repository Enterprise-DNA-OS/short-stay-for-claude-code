---
description: "Every owner, their homes, their last statement and anything unpaid."
---
# Owners

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- owners
```

Point out any owner without a statement for last month.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
