---
description: "Each cleaner, and what the next guest said about cleanliness."
---
# Cleaners

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- cleaners
```

Name the cleaner with the lowest next-guest cleanliness and the homes involved. Suggest a check, not a conclusion: one bad home can drag a cleaner down.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
