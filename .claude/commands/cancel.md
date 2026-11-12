---
description: "Cancel a reservation and its departure clean."
---
# Cancel

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- cancel <code> [--reason=]
```

Confirm first. Refunds happen in the channel or the bank, not here.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
