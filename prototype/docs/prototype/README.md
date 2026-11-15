# Converge clickable prototype

This is a front-end-only proof of concept for the Converge FYP. Everything runs in the browser with mock Dublin data held in memory: there's no API, database, payments or real map.

## Run it

You need Node 22. pnpm comes through Corepack, which ships with Node, so there's nothing to install globally.

```bash
cd prototype/apps/web
corepack pnpm install
corepack pnpm dev            # http://localhost:5173
```

Other commands:

| Command | What it does |
| --- | --- |
| `corepack pnpm build` | Type-checks (`tsc --noEmit`) and builds to `dist/` |
| `corepack pnpm exec playwright install chromium` | One-off browser download for the tests (about 125 MB) |
| `corepack pnpm test:e2e` | 31 Playwright tests: the three journeys, the blocked rules, the analytics dashboards, and axe WCAG 2.1 AA scans at 360px and 1280px |

If you'd rather type plain `pnpm`, run `corepack enable pnpm` once from an **administrator** terminal (DECISIONS D-001).

### Things to know
- **Data resets on reload.** State is in memory only (D-004). Navigate by clicking, not by editing the URL, or use **Reset demo** in the profile menu to start again.
- **"Today" is Wednesday 18 November 2026** for date filters and listings (D-024). The 10-minute ticket hold uses the real clock.
- **One account, three roles.** The demo user, Aoife Kelly (AK), is an attendee, an organiser and a venue operator (FR 4). Switch roles from the **profile menu** (AK, top right). Below 760px it's in the **☰ menu**.
- **Remote images and fonts.** Photos load from Unsplash and fonts from Google Fonts. Offline, the layout still works and the images show as grey boxes.

## Click through scripts

### Journey 1: attendee discovers and buys

1. **What's on** (`/`): this is the Figma design.
   - Type "harbour" in **What**, then clear it.
   - Click the **Arts & culture** chip, then **All events**.
   - Open **Filters**. Drag the price slider, then turn on "Welcoming if you're coming on your own".
   - Click a **map pin**. The detail card at the bottom updates.
   - Click the heart on a card to **save** it, then use the **Saved** chip to see your saved events.
2. Open **The Corner House Sessions** from its card. Keyboard works too: Tab to the title and press Enter.
   - The event page shows the venue, the nearest stop (**Luas Red Line · Smithfield, 150 m, about 2 min walk**), the organiser's rating, the ticket types left and a mini-map (FR 40).
3. **Get tickets.** The ticket dialog opens.
   - Tab around: focus stays inside the dialog. Escape closes it and returns focus to the button.
   - Reopen it, add a second ticket (total **€44.00**) and click **Continue to checkout**.
4. **Checkout.** The tickets are **Reserved** with a 10-minute countdown. You see Subtotal, Promo discount, Booking fee "Included" and Total **before** paying (FR 47).
   - Click **Pay €44.00 · test mode**.
5. **My tickets.** Two **Paid** tickets with QR placeholders (FR 50). Under Past, the Samhain Céilí ticket shows as **Checked In**.

**Blocked rules to show:**

| Rule | How to see it |
| --- | --- |
| **TX1** | Open **Late Studio: Life Drawing & Vinyl** (Sold Out). Get tickets is blocked and the notice explains why. |
| **TT3** | Reserve tickets, then at checkout click **Demo: let the hold expire now**. The tickets are Released and go back on sale. |

### Journey 2: organiser and venue, book and publish

1. Profile menu → **Organiser**. On the dashboard, click **Create event**. **EX1** blocks it: "You need a Confirmed booking first".
2. **Find a venue.** Defaults: 60 guests, Sat 12 Dec, 7–11 pm, within 5 km of the city centre.
   - Each result shows distance, capacity, nearest stop with walking time, price guide and availability (FR 15).
3. Open **The Lock Keeper's Room**. The page shows packages and deposits, availability, the nearest stop and the booking form (FR 16).
   - Click **Send booking request**. The booking is now **Pending** (BT1).
4. Click **Switch to Venue operator view**, which opens the request.
   - "Clashing bookings" lists the Dublin Board Gamers request for the same evening.
   - Click **Approve and hold the date**. The booking is now **Approved** (BT2).
5. Click **Requests** in the top nav. Dublin Board Gamers now shows **Clashes**. Open it: Approve is blocked by **BX2**, so there are no double bookings (FR 21).
   - Decline it if you like; a reason is required (BT3).
6. Back on your own request (the **View** link), click **Switch to Organiser view**, then **Pay €100.00 deposit · test mode**. The booking is now **Confirmed** (BT6).
7. Click **Create event from this booking**. A **Draft** opens with the venue, date and times copied from the booking (FR 26).
   - Enter a title, e.g. "Liberties Winter Supper Club".
   - **Publish** is blocked by **EX3** until there's a ticket type. The checklist shows what's missing.
8. Add a ticket type: "Supper seat", €35, quantity 60. Click **Publish event**. The event is now **Published** (ET2).
9. Click **See it on the map**. What's on now lists 6 events, with a **€35** pin for your event (FR 37).

**Also try:**

| Rule | How to see it |
| --- | --- |
| **BX1** | Book **The Loft at Tara** on **Sat 5 Dec** (already Confirmed for someone else). |
| Availability | Pick a **Monday** (venues are closed). |
| Event times | In the editor, set start/end times outside the booking. |

### Journey 3: community

1. As **Attendee**, open `/events/e-cornerhouse/community` (or the community section of any event page). It's **locked** for non-ticket-holders (FR 58).
2. Buy a Corner House ticket (journey 1, steps 2–4), then click **Event community** on My tickets, or use the **Community** tab.
3. Read the existing posts and the **Coming on their own** list, which shows shared interests (FR 61).
4. Turn on **I'm coming on my own**. You join the list (FR 60).
5. Write a post, reply to Nadia, then delete your own post (FR 59).

### Analytics dashboards and insights (FR 67–FR 71)

The history behind these dashboards is **synthetic and seeded** (D-045).

1. Profile menu → **Venue operator** → **Analytics**. Look at:
   - the stat tiles (occupancy, bookings, booking revenue, bar revenue per attendee)
   - occupancy by month
   - bar sales by 15 minutes from doors, with the peak highlighted (FR 69)
   - the revenue split
2. In **Insights**, find *"Events held on Thursdays with ticket prices between €10 and €15 generated 26% higher bar revenue per attendee than comparable Friday events."*
   - Open **How this was worked out** to see both groups' averages, the number of events in each, the 95% CI and the Bonferroni note.
3. Change the **Venue** filter or the **period**. Every figure and insight re-scopes. Insights that no longer have 8 events per group disappear instead of being guessed.
4. Profile menu → **Organiser** → **Analytics**. Look at:
   - tickets sold, revenue, sell-through and attendance, with change vs the previous period
   - tickets sold per week and revenue by month
   - sell-through by ticket type
5. **Ticket sales forecast** (FR 70): *Midwinter Long Table* is flagged "Tracking below similar events". Its sales-pace chart compares it with the middle 80% of similar past events. Hover, or focus the chart and use the arrow keys.
6. Click **Show table** on any chart for the same data as a table.
7. Switch to **Last 3 months**: the weekday comparisons drop out because there aren't 8 events per group, leaving only the forecast flag (FR 71's minimum sample rule).

## What it demonstrates

| Area | Requirements |
| --- | --- |
| Discovery | FR 37 (illustrated map), FR 39, FR 40, FR 41, FR 42 (interactions counted in the profile menu) |
| Ticketing | FR 28, FR 32, FR 46 (TT1/TT2/TX1), FR 47, FR 48 (holds count against stock), FR 49 (TT3), FR 50, FR 51 |
| Venues and bookings | FR 4, FR 15, FR 16, FR 19 (BT1/BX1), FR 20 (BT2/BT3), FR 21 (BX2), FR 22 (BT6) |
| Events | FR 26 (ET1/EX1), FR 27, FR 29 (ET2/EX2/EX3), FR 32 (ET5/ET6) |
| Community | FR 58, FR 59, FR 60, FR 61 (partial) |
| Analytics | FR 67, FR 68, FR 69 (bar sales by 15 minutes; no CSV upload), FR 70 (pace baseline), FR 71 (statistical insights with templates, minimum 8 per group) |
| Quality | NFR 20 (360–1920px), NFR 21 (WCAG 2.1 AA: axe-clean, keyboard, focus, dialog, reduced motion), NFR 32 (euro, Europe/Dublin) |

## Known gaps

**Not built, by design (front-end only):**
- No Express API, PostgreSQL/PostGIS, Supabase Auth or Realtime, Stripe or Mapbox.
- Rules run in the browser as a stand-in for the service layer and database constraints (D-007, D-008). Concurrency guarantees (NFR 13) can't be shown.

**Not covered by the journeys:**
- Sign-in, email verification and real RBAC: role switching is a view switch.
- Recommendations (FR 43–FR 45).
- Shortlisting and comparing venues (FR 17–FR 18).
- Withdrawing, cancelling or expiring bookings (FR 23–FR 24).
- Booking messages (FR 25).
- Editing, unpublishing or cancelling events (FR 30–FR 31).
- Check in scanning, refunds and transfers (FR 52–FR 57).
- Community moderation, report/block and DMs (FR 62–FR 64).
- Admin (FR 72–FR 75).
- Analytics extras: bar sales CSV upload (FR 69), engagement metrics in FR 67, stored insights and model runs (D-051).
- Comparing venue facilities side by side.

**Simplifications:**
- Analytics history is synthetic, with planted patterns that the detectors rediscover (D-045).
- The forecast is ml-design.md's pace baseline, not the gradient-boosted model (D-047).
- Insights use statistics and templates; there's no LLM. **ADR 010 says otherwise**, which is flagged in D-044.
- The map is an illustration with fixed pin positions. Zoom only scales it.
- Distances use a haversine from three fixed points (D-043).
- Shared interests ignore profile privacy settings, which aren't modelled (**departs from FR 61**, D-041).
- QR codes are placeholders drawn from a random token, not scannable codes.
- Promo codes always show "None"; the booking fee is "Included" (D-012).

**Testing:**
- Playwright tests cover each journey and the blocked rules through the UI. They don't cover every transition in the state tables (NFR 28, D-021). `src/domain/rules.ts` is pure, so it's ready for unit tests.
- Tests run on Chromium only. 

**Data:**
- The four export venues are real places, but they aren't bookable in the demo (D-027).
- The three bookable venues and all people are fictional.
- Photos are from Unsplash.

## Where things are

```
prototype/apps/web/
  src/domain/    types.ts (entities, state names) · rules.ts (guards: BX1, BX2, EX1–EX3, TX1, TT3…) · format.ts · venues.ts
  src/data/      seed.ts (Dublin mock data)
  src/analytics/ history.ts (seeded synthetic history) · metrics.ts · forecast.ts · insights.ts · stats.ts
  src/state/     store.tsx (in-memory store; actions call the guards)
  src/components charts/Charts.tsx (SVG charts) · TopBar (role switcher) · Dialog (focus trap) · MapPanel · EventCard · TicketModal · BlockedNotice · …
  src/screens/   attendee/ · organiser/ · venue/ · analytics/ · HostLanding · NotFound
  src/styles/    tokens.css · base.css · explore.css (ported export) · screens.css · workspace.css · analytics.css
  e2e/           journey1-attendee · journey2-organiser · journey3-community · analytics · a11y · a11y-workspace
```
