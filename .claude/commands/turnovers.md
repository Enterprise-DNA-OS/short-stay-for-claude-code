---
description: "Departures, the next arrival in the same home, and who is cleaning: same-day turnovers first."
---
# Turnovers

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- turnovers [--days=3]
```

Same-day turnovers with NOT BOOKED or no cleaner are the first job of the day: offer /assign-clean with the cleaner who covers that area.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
