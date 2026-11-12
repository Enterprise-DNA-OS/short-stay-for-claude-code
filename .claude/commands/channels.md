---
description: "Each booking channel after commission: what the owner keeps a night, and lead time."
---
# Channels

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- channels
```

Say which channel leaves the owner most a night, and what moving 10% of nights to direct would be worth, from these figures only.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
