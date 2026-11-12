---
description: "Close a repair, and put its cost on the owner's next statement."
---
# Resolve

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- resolve <home> --title=<a few words> [--cost=]
```

Only add --cost when the operator gives the figure.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
