---
description: "Work out, save, issue or mark paid one owner statement."
---
# Statement

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- statement <owner> --month=YYYY-MM [--save | --issue | --paid]
```

Without a flag it only shows the figures: check them with the operator before --issue. --paid only after the operator confirms the transfer left the bank. Nothing here moves money.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
