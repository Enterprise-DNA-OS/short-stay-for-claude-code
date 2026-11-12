---
description: "Record the Victorian short stay levy on a direct booking."
---
# Record levy

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- record-levy <code> --amount=
```

Work the amount out with /levy first (7.5% of the total booking fee).

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
