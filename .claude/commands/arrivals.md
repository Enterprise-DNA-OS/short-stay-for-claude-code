---
description: "Who arrives in the next two days, and what is still to collect on direct bookings."
---
# Arrivals

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- arrivals [--days=2]
```

Flag any arrival whose home has a clean not booked or no cleaner (run turnovers if unsure). Offer /draft-prearrival.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
