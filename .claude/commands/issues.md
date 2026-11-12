---
description: "Open repairs and issues, urgent first, with what the owner has approved."
---
# Issues

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- issues [--all]
```

For anything waiting on an owner, offer /draft-owner-update or a note.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
