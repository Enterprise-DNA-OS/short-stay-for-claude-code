# Moving off Guesty

You can test this beside Guesty for a week before you switch anything off. The import never deletes and never sends anything, and a test run writes nothing.

## 1. Export from Guesty

Guesty emails reports as CSV rather than downloading them, and only users whose role allows it see the export button ([Guesty help: export reports](https://help.guesty.com/hc/en-gb/articles/9370076145437)).

**Reservations.** In Guesty, open the reservations report, add these columns in the column picker, set the date range (go back as far as you want history, a reservations report holds up to 50,000 rows), and export as comma-separated CSV:

| Column in Guesty | Becomes | Needed |
|---|---|---|
| Confirmation code | the reservation code | yes |
| Listing's nickname | the home | yes |
| Guest's name, Guest's email, Guest's phone | the guest (matched on email) | name yes |
| Check in, Check out | the dates | yes |
| Accommodation fare | rent | yes |
| Cleaning fare | the cleaning fee | no |
| Channel commission (or Host service fee) | commission; blank means the channel's rate | no |
| Source | the channel (Airbnb, Booking.com, Vrbo, Stayz, Expedia, Direct) | no |
| Status | confirmed, cancelled or enquiry | no |
| Number of guests, Total paid, Creation date | guests, a payment, the booked date | no |

**Listings (optional).** Export the listings report with Nickname, Address, Bedrooms, Accommodates and, if you keep it, the owner. Guesty Lite does not export listings: the import creates each home from the reservations instead, and you fill in the details after.

If your column names differ, the import names the ones it could not find and stops. Ask Claude Code to map them: "my export calls it Listing title, not Listing's nickname".

## 2. Run the import

```bash
npm run stays -- import guesty ~/Downloads/reservations.csv --listings=~/Downloads/listings.csv
```

That is a test run. It prints what it would create (homes, owners, guests, channels, reservations, payments) and every row it would skip, with the reason. When it looks right, add `--apply`. Run it again any time: a reservation already there is updated, never duplicated, so you can import again after the last week of bookings lands in Guesty.

Dates are read as day/month/year or `YYYY-MM-DD`. If your export uses month/day/year, add `--date-order=mdy`.

## 3. Fill in what Guesty does not export

- **Owners and fees.** Homes without an owner in the listings file go to "Owner to confirm". Add owners (`/add owner`) and set each home's owner, management fee and cleaning figures (`/set home`).
- **Rules and registrations.** For each home, set which rules it lives under and its registration number and expiry (`/set home <name> --rules=nsw-cap --registration=PID-STRA-12345 --registration-expires=2027-06-30`). Then run `/compliance`.
- **Cleaners.** Add each cleaner, then `/turnovers` and `/assign-clean` for the next week.
- **Owner blocks.** Add upcoming owner stays with `/block`.

## What carries over and what does not

| Carries over | Does not carry over |
|---|---|
| Every reservation in the date range, with guest, dates, rent, cleaning fee, commission and status | Guest messages and the unified inbox |
| Homes (from listings, or from the reservations) | Rates, minimum stays and pricing rules |
| Guests, matched on email | Payment card details (they should never leave your payment provider) |
| Channels, by source | Task templates and automation rules |
| Payments, as one total per reservation | Owner portal logins |

## What stays where it is

This does not connect to Airbnb, Booking.com or Vrbo. Keep a channel manager for rates and availability, and import its reservations here (any CSV it exports can be mapped the same way). Guest messaging stays in the channels or your inbox. Enterprise DNA connects these for you in the version we build and run.

## After the switch

Run `/attention` every morning and `/weekly-review` on Monday. At month end, `/month-end` writes and issues every owner statement. Turn off the Guesty subscription only when a full month of statements has come out right here.
