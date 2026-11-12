---
description: "Block a home for an owner stay, maintenance or a hold."
---
# Block

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- block <home> --from=DATE (--to=DATE | --nights=N) [--kind=owner_stay|maintenance|hold] [--note=]
```

If it would sit over a reservation, show the clash and ask. Remind them to close the same dates in the channel manager.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
