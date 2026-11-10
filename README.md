# Waste Well Placed — UK waste collection platform

A Next.js source-code project. The responsive UI has been checked locally; no production deployment has been made.

Built with Next.js App Router / TypeScript / Tailwind CSS 4 / MongoDB & Mongoose / Cloudinary / Stripe GBP / signed cookie sessions / Motion. Original Waste Well Placed branding and a separate reference-inspired mockup are included.

## Quick start (when you are ready to run it yourself)

1. Install Node.js 20+ and a MongoDB instance or MongoDB Atlas.
2. In this directory run `npm install`.
3. Copy `.env.example` to `.env.local`, replace placeholder secrets and business details. Generate a long SESSION_SECRET: `openssl rand -hex 32`.
4. Add actual `MONGODB_URI`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, and optionally Resend credentials.
5. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` (min. 12 characters). Run **`npm run seed`**. **Seeded geography and tariffs are samples only, not verified Waste Well Placed service areas or company prices.** Never seed production with sample booking rules.
6. Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` for verification.
7. Only when you choose to launch locally, run `npm run dev`; production deploys require the business and technical checks below.

## Responsive design

The homepage, desktop navigation, mobile modal menu and booking pages follow the supplied desktop/mobile layout references using Waste Well Placed branding. The design includes a postcode booking widget, six service cards, photo-quote callout, illustrated collection sizes, swipeable mobile load cards, item search and quantity controls, a saved booking basket, and an accordion for contact, address, access conditions and optional photos.

Contact details and photo references are validated and stored with bookings. Collection photo uploads use the existing Cloudinary configuration. Contact and WhatsApp links use the public business settings and fall back to the contact page when unconfigured. Prices and capacity still come from the existing server workflows; no competitor review counts or credentials are used.

Run `npm test` for pricing, postcode lookup and booking metadata validation. The test configuration resolves the project's `@/` imports.

## UK postcode lookup

Postcode verification uses [Postcodes.io](https://postcodes.io/docs/overview/), a free API with no API key or environment variables required. The server needs outbound HTTPS access to `api.postcodes.io`.

- `GET /api/postcodes/lookup?postcode=SW1A%201AA` returns a formatted postcode, country, district and coordinates.
- The homepage booking widget checks the postcode before continuing. The address step verifies it again through `/api/coverage/check`, then checks your configured collection zones.
- Invalid formats or unknown postcodes return 422; provider failures or a five-second timeout return 503 with a retry message. Successful upstream lookups are cached for 24 hours.
- This service provides postcode geography, not street addresses or postal towns. Customers enter their collection address and town manually.

## Architecture

- `src/app`: public site, booking flow, auth/account, business/portal, operations/admin and crew.
- `src/components`: UI modules and responsive booking widgets.
- `src/lib`: MongoDB, models, auth, pricing, validation, notification, coverage, Stripe and Cloudinary.
- `src/app/api`: JSON APIs including server-side quote validation and Stripe webhook.
- `scripts/seed.ts`: opt-in sample catalog, postcode zone and capacity slots plus admin bootstrap.
- `public/images`: supplied logo + concept images cropped from the original project mockup.

## Routes

| Area       | Routes                                                                                                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public     | `/`, `/services`, `/services/[slug]`, `/how-it-works`, `/areas`, `/areas/[slug]`, `/about`, `/contact`, `/faq`, `/reviews`, `/blog`, `/blog/[slug]`, `/terms`, `/privacy`                               |
| Booking    | `/book`, `/book/load`, `/book/items`, `/book/photo-quote`, `/book/details`, `/book/schedule`, `/book/checkout`, `/book/confirmation/[ref]`, `/book/quote-received`                                      |
| Customer   | `/login`, `/register`, `/forgot-password`, `/account`, `/account/bookings`, `/account/bookings/[id]`, `/account/documents`, `/account/profile`                                                          |
| Business   | `/business`, `/business/services`, `/business/portal`, `/business/enquire`, `/portal`, `/portal/sites`, `/portal/bookings`, `/portal/reports`, `/portal/invoices`                                       |
| Operations | `/admin`, `/admin/jobs`, `/admin/quotes`, `/admin/pricing`, `/admin/catalog`, `/admin/slots`, `/admin/areas`, `/admin/customers`, `/admin/teams`, `/admin/reports`, `/admin/content`, `/admin/settings` |
| Crew       | `/crew`, `/crew/jobs/[id]`, `/crew/history`                                                                                                                                                             |

## Working backend workflows implemented

- Registration & login (bcrypt password hashes, HTTP-only SameSite session cookies and re-checking database role on server).
- Real UK postcode validation and configured prefix/zone lookup; uncovered postcodes rejected.
- Load/item estimation calculated **on the server** in integer pennies; UK GBP and configurable VAT. Special handling redirects to manual quote.
- Photo quote form with Cloudinary signed browser uploads and stored MongoDB quote requests.
- Slot listing with time/capacity filters; atomic slot decrement on holds and expiry cleanup (read limitations below).
- Booking creation requires session, valid active user slot hold, recomputed server price, matching postcode and an idempotency key.
- Stripe GBP Checkout session with raw-body, signed, payment-verifying webhook and idempotent booking payment transition.
- Customer booking timeline and account-scoped document access.
- Admin list pages, quote status/pricing API, service area/catalog slot editing API with audit logs and crew assignment field.
- Crew status transition API and basic completion evidence (after photo URL required).
- Business organisation/site-linked read-only portal, enquiry capture and route scaffolding.
- SEO metadata, sitemap, robots, animated reveal and responsive layouts; reduced-motion CSS handling.

## Important unfinished / pre-launch items

This is an **application starter with substantial workflows**, not an audited, ready-to-deploy replacement for every LITTA feature. Do not describe these as completed:

1. **Authentic availability** — the seed generates sample slots, but production needs real driver shifts, zoned calendars, holiday blackouts, travel buffers and operation hours.
2. **Capacity & resilience** — use a database transaction or background reservation service for all state transitions; expire and release unpaid bookings, reconcile Stripe sessions, release held capacity on refund/cancellation and regularly reconcile `reservedCount` vs active holds/paid jobs. TTL deletion on holds does _not_ release counters by itself. Current expiry cleanup runs when slot endpoints are called.
3. **Cloudinary security** — add quota/rate limits, upload presets with explicit allowed MIME types/max bytes, verify assets by authenticated server-side Cloudinary API before accepting public IDs, virus/moderation review, and private asset delivery for sensitive photos. The current quote upload signing endpoint is public for guest quotes; it needs anti-abuse controls.
4. **Security hardening** — use rate limiting, bot protections, CSRF token defense where appropriate, email verification, 2FA for admins, password recovery, audit trail for pricing overrides and pen testing. Origin checks on mutating API requests are supplementary, not complete CSRF defense.
5. **Pricing administration** — seed unit prices are currently used in the `pricing.ts` engine, not the MongoDB catalog edits. Connect production `priceBooks` to the calculator before advertising admin-editable live tariffs.
6. **Business portal** — multi-site and reporting screens are present; self-service site editing, subscriptions, invite roles, recurring schedules, VAT invoices, downloadable CSV and scoped organisation workflows still require development.
7. **Photo quote acceptance** — admins can review and price requests; the signed acceptance link, customer acceptance checkout conversion and expiry handling are not yet implemented.
8. **Documents** — the text-based collection record is **not an official UK Waste Transfer Note**. Issue legally valid records only after verifying carrier licence, EWC codes, producer/holder details, transfer location/date, parties' signatures and transfer/destination info. Signed compliant PDF + genuine VAT invoice remain to be built.
9. **Crew evidence** — the current UI accepts a photo URL for completion but does not yet expose a file-upload control. Build private signed Cloudinary upload and ownership checks before production.
10. **Notifications** — Resend optional email only; no real SMS/WhatsApp provider or job queue. Implement durable notification outbox and retry.
11. **Geolocation** — no live GPS driver tracking, route optimisation or maps in the customer account; a status timeline is provided.
12. **Content** — blog models/admin listings exist but rich text editor, moderation, newsletters and customer reviews are not wired; legal texts are clearly marked pre-launch drafts.
13. **UK legal & finance** — VAT registration status, VAT display, cancellation policy, business registration, Environment Agency/SEPA/NRW carrier registration as applicable, insurance, GDPR retention, accessibility testing and payment business onboarding must be supplied by the company.
14. **Visual exactness** — layout is reference-led and uses the requested palette, not an exact reproduction of LITTA proprietary UI/art. Replace concept artwork with licensed original photos before production.
15. **Testing** — small pricing unit tests included; E2E, integration, accessibility audits, visual regression, webhook race tests and load tests still required.

## Demo user journey

Seed an example London postcode zone and slots, register a customer, navigate to `Book a collection`, select a load size or item, enter a matching postcode, choose an available slot, sign in **before** slot reservation if necessary, and check out with Stripe test credentials. A paid booking transitions to `confirmed` only after Stripe sends a successful signed webhook. Admin account creation is manual from seed; do not expose admin registration publicly.

## Routes and limitations worth knowing

- `/api/admin/record` selectively patches listed fields, but the generic admin table does not provide dedicated structured editors for nested arrays or the full price engine.
- `/forgot-password` is an honest support notice, not a pretend reset form.
- `/reviews` shows no invented ratings; use verified reviews only.
- `/portal/invoices` is an honest placeholder; do not issue a fake VAT receipt.
- Desktop mockup is concept art, included separately and not a screenshot of a running site.

## Deployment

Recommended: Vercel for Next.js, MongoDB Atlas for DB, Cloudinary for image hosting, Stripe UK account for payments, Resend for email. Configure webhook URL `https://YOURDOMAIN/api/payments/webhook`, events `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Store secrets in provider environment settings, never `NEXT_PUBLIC_*` or Git. Deploy only after completing the checklist above.

## Reference

Functional inspiration: https://www.litta.co.uk/ (public reference reviewed 6 Nov 2026). This project does not copy LITTA source code, content, licence numbers, reviews, pricing or trademarks.
