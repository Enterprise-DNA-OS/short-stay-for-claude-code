---
description: "Mark a clean done, or done with an issue."
---
# Clean done

Read CLAUDE.md first. Use fresh data and run:

```bash
npm run stays -- clean-done <code> [--issue-note="what was found"]
```

An issue stays on /attention until someone deals with it. Offer /issue to log a repair.

Answer in plain language, tables for numbers, in the business's currency. Ambiguous names list the candidates and exit 1: ask which one. Never invent a reservation, a rate, a payment, an owner figure or a guest detail. Nothing here sends a message, charges a card or pays an owner: drafts go to drafts/ and a person acts.
