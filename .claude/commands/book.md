---
description: "Take a booking or an enquiry, with a clash check and the departure clean added."
---
# Book

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- book <home> --guest="Name" --arrive=DATE (--nights=N | --depart=DATE) --rent=AMOUNT [--channel=Direct] [--guests=2] [--email=] [--enquiry]
```

Confirm the home, dates and rent with the operator before running. On a clash, show it and ask; only use --force on a clear yes. Remind them to close the dates in the channel manager.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
