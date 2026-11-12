---
description: "The short-stay rules each home lives under, checked against the records, with the rule cited."
---
# Compliance

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- compliance
```

Read docs/compliance.md first. Report breached, then due, with the source of each rule. For each, draft the fix the operator can approve. If a rule looks out of date, say so and stop: do not guess at law. Nothing here is legal advice.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
