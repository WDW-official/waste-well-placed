# Platform expansion v1.2 — implementation and deployment

## Scope delivered

The existing Next.js / React / TypeScript, MongoDB / Mongoose, Cloudinary, Stripe and Resend stack is retained. Public booking and service navigation remain. `/work-with-us` introduces recruitment without replacing customer CTAs.

| Brief area             | Implementation                                                                                                                                                                                                                   | Verification / limit                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A: audit               | `PLATFORM-V1.2-AUDIT.md`; additive schemas and opt-in migration                                                                                                                                                                  | No production data was read or migrated                                                                    |
| B: operations cockpit  | Searchable job/quote/issue/enquiry queues; job Summary, Photos, Quote & payments, Dispatch, Evidence, History, Financials tabs; quote revisions and itemised prices                                                              | Build and local tests; full provider staging test required                                                 |
| Photo quote conversion | Private uploads, secure hashed-token link, customer accept/decline, real slot hold, exactly one linked booking, existing server Checkout                                                                                         | Local acceptance and concurrent-accept tests; Stripe test payment must be exercised with configured keys   |
| C: onboarding          | Separate driver registration/login; seven-stage saved application; private documents; consented encrypted check credentials; manual review; policy-based age/points/expiry blocking                                              | No DVLA, insurer or register lookup is automated; these are human checks                                   |
| D: driver / dispatch   | Mobile workspace and installable manifest; online windows; hours/coverage/capacity/waste matching; unique live assignment locks; accept/decline/timeout; reasoned release; milestone updates                                     | Real MongoDB replica-set concurrency tests; availability is not GPS                                        |
| E: evidence / payout   | Separate before/after pickup, approved facility and receipt; independent verification; optional uploaded WTN; immutable offer/economics/policy snapshot; conditional/approved/scheduled/paid/held ledger and adjustments         | Manual bank transfer only; no bank details collected or transfer initiated                                 |
| Notifications          | Transactional outbox with recipient/event/template version, in-app updates, retry attempts and locked delivery; scheduler endpoint                                                                                               | Resend delivery needs live configuration and scheduler; no test emails were sent                           |
| Security               | Server role scopes; finance cannot read driver IDs; private image/document route; expiring provider download URL; dedicated AES-GCM key for DVLA credentials; MIME/signature/size checks; rate counters; noindex private layouts | Provider delivery, malware scanning and historical public asset remediation are staging/launch gates below |
| PWA                    | Driver manifest; offline notice only; private data and API calls are never cached by the service worker                                                                                                                          | Secure context required; install behavior needs real iOS/Android check                                     |
| Themes                 | Light/dark control on new driver and operations workspaces, responsive layouts                                                                                                                                                   | Existing public website is preserved; full public-site dark theme is not introduced                        |

## Explicitly not represented as implemented

- Deposits/part-pay checkout and a refund initiation UI. The booking schema reserves distinct partial-payment states, while current Checkout still collects the full approved amount. Verified refund and dispute events hold unpaid driver settlements; initiate actual refunds in Stripe until a delegated refund workflow is implemented.
- Bulk corporate reports, recurring multi-site schedules, GPS/ETAs, route optimisation, AI-generated decisions, autonomous driver matching, automatic bank transfers, marketplace KYC or payout-provider integration. These are later phases in the brief.
- Automatic DVLA/insurance/facility verification, employment classification, approved legal WTN generation, regulatory certification, recycling claims or external checks. Only a person can sign off checks and upload authorised documents.
- Malware-scanning service and automatic record-retention deletion. File signatures and MIME/size are checked; PDFs download as attachments. Configure scanning/quarantine and the company's retention schedule before receiving production identity documents.
- Retrospective privacy of existing public Cloudinary URLs. New uploads are authenticated assets. The migration reports legacy public files; those must be copied to authenticated storage, references updated and public originals retired with a backed-up, reviewed remediation procedure. They cannot be made private merely by changing the web UI.

## Configuration

Retain existing database, Stripe, Cloudinary and Resend variables. MongoDB must be a replica set / Atlas deployment supporting transactions. Do not point integration tests at the application database.

Add these private variables:

- `DRIVER_DATA_KEY`: 64 hexadecimal characters from `openssl rand -hex 32`. Keep a secure backup; losing or rotating it without re-encryption makes existing protected check credentials unreadable. Never expose it using `NEXT_PUBLIC_`.
- `CRON_SECRET`: independently generated secret for scheduler requests.
- `NEXT_PUBLIC_SITE_URL`: canonical HTTPS origin, used for secure links in email.
- `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL`: required for outbox email delivery. Without them, notices remain visible in app and delivery attempts are recorded as failed.
- `MONGODB_TEST_URI` / `PLATFORM_TEST_PASSWORD`: optional isolated manual QA fixtures, never production values.

The private upload endpoint accepts JPEG/PNG/WebP and document PDFs up to 3 MB per request, keeping payloads under typical serverless request limits. Configure Cloudinary to allow authenticated image/raw storage and signed private downloads. Test a JPEG and PDF end to end with the actual account; this was not exercised against production. The server streams files through `/api/assets/:id` after checking ownership/role/assignment or a valid customer quote capability, using a 60-second signed upstream URL. Use a trusted reverse proxy that sets `x-forwarded-for`; add edge anti-abuse controls as needed.

## Migration and roles

1. Back up the database and review the audit.
2. Run `npm run migrate:platform` for a read-only count report. Then explicitly run `npm run migrate:platform -- --apply` against the intended environment. This creates collections/indexes and backfills version fields. Existing crew accounts become unapproved driver applicants; historical completed jobs get a review issue. It never approves drivers, facilities or policy.
3. Confirm existing active collections and historical evidence manually. The legacy crew self-completion endpoint now returns 410. Historical self-issued WTN references are not treated as independent verification.
4. Provision the owner's existing user as `superadmin` through an authorised database administration process. New public registration always creates only `customer` or `driver`; it cannot create staff. Staff role names are `admin`, `dispatcher`, `finance`, `compliance`, `superadmin`.
5. Owner signs off `/admin/operations-settings`, including age/points policy, pay basis/rate and minimum margin. No offers or driver activation are permitted until policy approval. An age of 21 is a proposed company policy, not a claim of a universal legal minimum.
6. Compliance adds genuinely checked facilities at `/admin/facilities`, with accepted waste types and recheck dates. Driver reviewers check real evidence at `/admin/drivers/:id` before activating applicants.
7. Make sure all new collections/indexes exist before accepting traffic. Unique partial indexes enforce a single live assignment per booking and driver; the payout assignment index prevents duplicate ledgers. Do not use `syncIndexes()` blindly against production.

All new financial values are integer GBP pence. The offer stores the original pay, cost forecast, margin and policy version. Negative adjustments are only permitted while a payout is held for review, require a reason, and invalidate any previous approval. The app does not establish whether a commercial adjustment is contractually lawful; record the applicable agreement externally.

## Scheduler and webhooks

Run an authenticated POST to `/api/operations/maintenance` every minute using `Authorization: Bearer <CRON_SECRET>`. It expires unanswered offers, takes timed-out availability offline, flags upcoming/expired documents and delivers a bounded outbox batch. Configure retries and monitor failed delivery records. Large-scale batching beyond the first 500 active profiles needs a cursor-based scheduler before scaling beyond this release.

Stripe webhook events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.closed`

Use `/api/payments/webhook` and the real signing secret. Payment confirmation and customer notification enqueueing commit together. Refund and dispute event IDs are deduplicated. A pickup status does not alter paid state. If a payment predates stored payment-intent IDs, reconcile its refunds/disputes manually rather than assuming the new event mapping exists.

## Local verification

- `npm test`: pure policy, pricing, validation, crypto and role-isolation tests.
- `npm run test:integration`: starts and destroys a dedicated temporary MongoDB replica set; no app database, messages or provider calls. First run downloads a MongoDB binary. Tests cover competing offers/accepts, pay ledger uniqueness, expiry/margin gates, required evidence, self-approval denial, duplicate settlement, quote conversion, customer privacy and driver activation rejection.
- `npm run typecheck` and `npm run build`.
- `npm run check:platform-ui -- /absolute/path/to/production-build`: starts an isolated temporary database and Next server, creates synthetic accounts, checks page overflow and browser errors at 320/375/390/1440px in light/dark, and writes screenshots to a temporary folder. Requires Playwright Chromium (`npx playwright install chromium`).
- `npm run seed:platform-test`: optional manual test accounts only in a database named `*_test`, using `MONGODB_TEST_URI` and `PLATFORM_TEST_PASSWORD`. It does not activate the sample applicant, facility or policy.

Do not run migrations, fixtures, test transfers or email tests against production without environment-specific approval. No production deployment, data migration, driver activation, email delivery, external verification, transfer or account-permission change has been performed as part of this implementation.

## Staging release exercise

Use three private photos, an applicant with current evidence, a verified receiving facility and Stripe test mode. Follow submission → human pricing → secure customer acceptance → slot hold → test payment → eligible driver offer/acceptance → pickup photos → facility receipt → independent verification → finance approval → record a test transfer reference. Repeat with an underage applicant, seven points, expired insurance, two simultaneous accepts, rejected evidence and duplicate payment events. Verify access denial for unrelated customers/drivers and finance identity access. Confirm actual provider delivery, mobile cameras, PWA installation, privacy/retention and business operating policies before enabling production recruitment and dispatch.

After configuring secrets and applying the reviewed migration, restart the application process so cached Mongoose models load the new schemas. Local verification results are recorded in [PLATFORM-V1.2-VERIFICATION.md](PLATFORM-V1.2-VERIFICATION.md).
