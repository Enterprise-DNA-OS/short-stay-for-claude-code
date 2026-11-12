---
description: "The Victorian short stay levy on bookings you took directly, by quarter."
---
# Levy

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- levy [--from=DATE] [--to=DATE]
```

Total the levy due, list any stay with NOT RECORDED, and offer /record-levy for each. Bookings through a platform that collects the levy itself are left out.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
