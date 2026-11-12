<h1 align="center">Short-Stay Management for Claude Code</h1>

<p align="center">
  <strong>The open-source holiday rental management system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Guesty data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=guesty">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/guesty?utm_source=github&utm_medium=readme&utm_campaign=guesty">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-guesty">Instead of Guesty</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Short-Stay Management for Claude Code does the job you pay Guesty for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the Guesty dashboard cannot.

Guesty publishes one price: Guesty Lite, from US$9 per listing a month, for hosts with one to three listings ([guesty.com/pricing](https://www.guesty.com/pricing/), checked 12 November 2026). Property managers with 4 to 199 listings go on Guesty Pro, which is quoted by listing count, and the owner portal and owner statements come with Pro. A holiday letting business with 50 or 100 homes pays that quote every month, for every home, for as long as it stays.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=guesty).

It is built for holiday letting businesses that manage homes for owners: five to fifty people running anywhere from ten to a few hundred homes in Sydney, Byron, the Mornington Peninsula, Perth, Queenstown or the Coromandel. It holds the homes, owners, reservations, cleans, repairs and expenses, works out every owner's share after channel commission and your fee, issues the monthly owner statement, and checks each home against the short-stay rules it lives under: the NSW 180 and Byron 60 night caps, WA registration and the Perth 90 nights, the Victorian short stay levy and Queenstown Lakes registration.

## Ten questions Guesty does not answer out of the box

1. Which cleaner's turnovers come before the lowest cleanliness scores? `/cleaners`
2. How many nights does each capped home have left this year, counting what is already booked? `/night-caps`
3. Which same-day turnovers in the next three days have no cleaner? `/turnovers`
4. Which homes earn us least after we pay the cleaners? `/performance`
5. Which channel leaves the owner the most per night after commission? `/channels`
6. Which owner statements are late, and which payouts have not gone? `/statements`
7. Which Victorian direct bookings have no levy recorded, and what is due this quarter? `/levy`
8. Which repeat guests have we paid the most commission on, so we can invite them to book direct? `/repeat-guests`
9. Which repairs are waiting on an owner's yes, and for how long? `/issues`
10. Which registrations expire in the next 30 days? `/compliance`

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/short-stay-for-claude-code.git
cd short-stay-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/attention`. The demo is an Australian letting business with eight homes and five owners, a year of stays, and a morning's worth of problems: a same-day turnover with no clean booked, a Byron cabin over its 60 nights, a statement not issued, a direct Victorian booking with no levy recorded.

## Your first hour: ten things to ask for

1. "What needs me today?" (`/attention`)
2. "Who is cleaning the same-day turnovers this week?" (`/turnovers`)
3. "Put Sparkle on the Bondi clean tomorrow." (`/assign-clean`)
4. "How close is Bondi to its 180 nights?" (`/night-caps`)
5. "Show me Helen's statement for last month, then issue it." (`/statement`)
6. "Draft Helen's owner update." (`/draft-owner-update`)
7. "Which homes made us least money last year, and why?" (`/performance`)
8. "Block Sorrento for Helen from the 20th to the 27th." (`/block`)
9. "Import my Guesty export from Downloads, test run first." (`/import`)
10. "Add a pet fee to every reservation and show it on the owner statement." (`/customise`)

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

| Command | What it does |
|---|---|
| `/add` | Add a home, owner, cleaner or channel. |
| `/arrivals` | Who arrives in the next two days, and what is still to collect on direct bookings. |
| `/assign-clean` | Put a cleaner on the clean after a departure. |
| `/attention` | Everything that needs a decision today, across every home. |
| `/block` | Block a home for an owner stay, maintenance or a hold. |
| `/book` | Take a booking or an enquiry, with a clash check and the departure clean added. |
| `/calendar` | One home night by night: reservations, owner blocks and free nights. |
| `/cancel` | Cancel a reservation and its departure clean. |
| `/channels` | Each booking channel after commission: what the owner keeps a night, and lead time. |
| `/check-in` | Mark a guest in. |
| `/check-out` | Mark a guest out; adds a departure clean if none is booked. |
| `/clean-done` | Mark a clean done, or done with an issue. |
| `/cleaners` | Each cleaner, and what the next guest said about cleanliness. |
| `/cleans` | The clean run sheet, for everyone or one cleaner. |
| `/compliance` | The short-stay rules each home lives under, checked against the records, with the rule cited. |
| `/customise` | Make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it. |
| `/departures` | Who leaves in the next two days, and anyone still showing as in after their date. |
| `/documents` | Render the paperwork: owner statements, clean run sheets and letting records, in your brand. |
| `/draft-clean-sheet` | Draft each cleaner their list for the next days. |
| `/draft-owner-update` | Draft the monthly owner email: payout, what is booked, open repairs. |
| `/draft-prearrival` | Draft pre-arrival notes for everyone arriving in the next two days, or one reservation. |
| `/expense` | Charge an expense to a home's owner on their next statement. |
| `/export` | Write every table to CSV. |
| `/homes` | Every home: owner, rules, registration, fee and cleaning fee. |
| `/import` | Bring reservations and listings across from Guesty. |
| `/issue` | Log a repair or problem at a home. |
| `/issues` | Open repairs and issues, urgent first, with what the owner has approved. |
| `/levy` | The Victorian short stay levy on bookings you took directly, by quarter. |
| `/log` | Note a call, email or visit against a home, owner, reservation, guest or cleaner. |
| `/month-end` | Month end: a statement for every owner for last month, checked, then issued on a yes. |
| `/new-view` | Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view`. |
| `/night-caps` | Nights let and booked against each capped home this counting year. |
| `/owner` | One owner: their homes over twelve months, statements, open repairs and recent notes. |
| `/owners` | Every owner, their homes, their last statement and anything unpaid. |
| `/pace` | The next twelve weeks on the books: nights, occupancy and rent. |
| `/pay` | Record money received on a reservation. |
| `/performance` | Each home over twelve months: nights, occupancy, rent, owner share, your margin and rating. |
| `/record-levy` | Record the Victorian short stay levy on a direct booking. |
| `/repeat-guests` | Guests who stayed more than once, and the commission paid to channels on their stays. |
| `/reservation` | One reservation in full: money, payments and its clean. |
| `/reservations` | Find reservations by home, owner, status or dates. |
| `/resolve` | Close a repair, and put its cost on the owner's next statement. |
| `/set` | Change a home, owner, cleaner, channel or the business settings. |
| `/statement` | Work out, save, issue or mark paid one owner statement. |
| `/statements` | Owner statements for the last three months, and which are late or unpaid. |
| `/turnovers` | Departures, the next arrival in the same home, and who is cleaning: same-day turnovers first. |
| `/views` | Render the read-only dashboards: this week, owners and homes, compliance. |
| `/weekly-review` | The Monday review: attention, the week's turnovers, night caps, the twelve weeks ahead and statements. |

`npm run docs` renders the paperwork in your brand (`brand.json`): owner statements, clean run sheets and the letting record for each capped or registered home. `npm run view` renders read-only pages: this week, owners and homes, compliance.

## Instead of Guesty

Export the reservations report (and the listings report, if you are on Pro) from Guesty as CSV, then:

```bash
npm run stays -- import guesty reservations.csv --listings=listings.csv           # test run, writes nothing
npm run stays -- import guesty reservations.csv --listings=listings.csv --apply   # writes it
```

Reservations, homes, guests, channels and payments come across. Messages, pricing rules and automations do not. This does not connect to Airbnb, Booking.com or Vrbo: keep a channel manager for rates and availability and import its reservations, or have Enterprise DNA connect it. The full guide, with the columns to pick in Guesty: [docs/replace-guesty.md](docs/replace-guesty.md). What the compliance checks cover, with sources: [docs/compliance.md](docs/compliance.md).

## Architecture

```
short-stay-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/                  the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the thesis and the migration guide
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Short-Stay Management for Claude Code for your business, migrates your Guesty data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=guesty)
- Read more: [enterprisedna.co/omni/instead-of/guesty](https://enterprisedna.co/omni/instead-of/guesty?utm_source=github&utm_medium=readme&utm_campaign=guesty)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
