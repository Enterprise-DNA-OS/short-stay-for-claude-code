---
description: "Guests who stayed more than once, and the commission paid to channels on their stays."
---
# Repeat guests

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- repeat-guests
```

These are the guests to invite to book direct next time. Draft nothing to a guest without a yes.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
