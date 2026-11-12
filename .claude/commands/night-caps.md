---
description: "Nights let and booked against each capped home this counting year."
---
# Night caps

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- night-caps
```

Name any home within 15% of its cap and how many nights are left. Say what to do: close the calendar in the channel manager, or apply for approval. Bookings of 21 nights or more and owner blocks are not counted.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
