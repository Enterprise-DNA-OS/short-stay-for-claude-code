---
description: "Who leaves in the next two days, and anyone still showing as in after their date."
---
# Departures

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- departures [--days=2]
```

Anyone past their departure date: offer /check-out.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
