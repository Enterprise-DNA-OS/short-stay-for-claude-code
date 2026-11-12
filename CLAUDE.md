# Short-Stay Management for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| Add a home, owner, cleaner or channel. | `/add` |
| Who arrives in the next two days, and what is still to collect on direct bookings. | `/arrivals` |
| Put a cleaner on the clean after a departure. | `/assign-clean` |
| Everything that needs a decision today, across every home. | `/attention` |
| Block a home for an owner stay, maintenance or a hold. | `/block` |
| Take a booking or an enquiry, with a clash check and the departure clean added. | `/book` |
| One home night by night: reservations, owner blocks and free nights. | `/calendar` |
| Cancel a reservation and its departure clean. | `/cancel` |
| Each booking channel after commission: what the owner keeps a night, and lead time. | `/channels` |
| Mark a guest in. | `/check-in` |
| Mark a guest out; adds a departure clean if none is booked. | `/check-out` |
| Mark a clean done, or done with an issue. | `/clean-done` |
| Each cleaner, and what the next guest said about cleanliness. | `/cleaners` |
| The clean run sheet, for everyone or one cleaner. | `/cleans` |
| The short-stay rules each home lives under, checked against the records, with the rule cited. | `/compliance` |
| Make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it. | `/customise` |
| Who leaves in the next two days, and anyone still showing as in after their date. | `/departures` |
| Render the paperwork: owner statements, clean run sheets and letting records, in your brand. | `/documents` |
| Draft each cleaner their list for the next days. | `/draft-clean-sheet` |
| Draft the monthly owner email: payout, what is booked, open repairs. | `/draft-owner-update` |
| Draft pre-arrival notes for everyone arriving in the next two days, or one reservation. | `/draft-prearrival` |
| Charge an expense to a home's owner on their next statement. | `/expense` |
| Write every table to CSV. | `/export` |
| Every home: owner, rules, registration, fee and cleaning fee. | `/homes` |
| Bring reservations and listings across from Guesty. | `/import` |
| Log a repair or problem at a home. | `/issue` |
| Open repairs and issues, urgent first, with what the owner has approved. | `/issues` |
| The Victorian short stay levy on bookings you took directly, by quarter. | `/levy` |
| Note a call, email or visit against a home, owner, reservation, guest or cleaner. | `/log` |
| Month end: a statement for every owner for last month, checked, then issued on a yes. | `/month-end` |
| Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view`. | `/new-view` |
| Nights let and booked against each capped home this counting year. | `/night-caps` |
| One owner: their homes over twelve months, statements, open repairs and recent notes. | `/owner` |
| Every owner, their homes, their last statement and anything unpaid. | `/owners` |
| The next twelve weeks on the books: nights, occupancy and rent. | `/pace` |
| Record money received on a reservation. | `/pay` |
| Each home over twelve months: nights, occupancy, rent, owner share, your margin and rating. | `/performance` |
| Record the Victorian short stay levy on a direct booking. | `/record-levy` |
| Guests who stayed more than once, and the commission paid to channels on their stays. | `/repeat-guests` |
| One reservation in full: money, payments and its clean. | `/reservation` |
| Find reservations by home, owner, status or dates. | `/reservations` |
| Close a repair, and put its cost on the owner's next statement. | `/resolve` |
| Change a home, owner, cleaner, channel or the business settings. | `/set` |
| Work out, save, issue or mark paid one owner statement. | `/statement` |
| Owner statements for the last three months, and which are late or unpaid. | `/statements` |
| Departures, the next arrival in the same home, and who is cleaning: same-day turnovers first. | `/turnovers` |
| Render the read-only dashboards: this week, owners and homes, compliance. | `/views` |
| The Monday review: attention, the week's turnovers, night caps, the twelve weeks ahead and statements. | `/weekly-review` |

If an ask fits nothing here, run the CLI directly (`npm run <cli> -- --help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.
- Never issue an owner statement or mark one paid without a yes in this session. Never put a door or lockbox code in a draft or a note.
- A night cap or registration problem is reported with its rule and source from `docs/compliance.md`. Do not guess at law.

## House details for drafts

- **Check-in and check-out:** [15:00 / 10:00, or per home in `homes`]
- **How guests get in:** per home in `access_notes`; the code itself is sent on the day, never written here
- **Owner statement day:** issued by the [10th] of each month (`settings.statement_due_days`)

## Where things live

- `scripts/` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/` the thesis and the guide for moving off Guesty.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/guesty
