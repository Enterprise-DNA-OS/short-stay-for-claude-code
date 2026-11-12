---
description: "Month end: a statement for every owner for last month, checked, then issued on a yes."
---
# Month end

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- statements
```

Then, for each owner with stays last month, run `npm run stays -- statement <owner> --month=<last month>` and show the totals in one table. Point out anything odd (a payout below zero, a home with no stays, an expense with no description). Issue each on the operator's yes with --issue, then `npm run docs -- owner-statement` to render them, then offer /draft-owner-update for each owner.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
