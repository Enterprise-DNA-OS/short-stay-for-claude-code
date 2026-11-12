---
description: "Draft each cleaner their list for the next days."
---
# Draft clean sheet

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- draft-clean-sheet [--days=2]
```

One draft per cleaner. Never send it: a person sends.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
