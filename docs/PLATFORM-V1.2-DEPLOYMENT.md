# Platform expansion v1.2 — implementation and deployment

## Scope delivered

The existing Next.js / React / TypeScript, MongoDB / Mongoose, Cloudinary, Stripe and Resend stack is retained. Public booking and service navigation remain. `/work-with-us` introduces recruitment without replacing customer CTAs.

| Brief area             | Implementation                                                                                                                                                                                                                                                                               | Verification / limit                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A: audit               | `PLATFORM-V1.2-AUDIT.md`; additive schemas and opt-in migration                                                                                                                                                                                                                              | No production data was read or migrated                                                                    |
| B: operations cockpit  | Searchable job/quote/issue/enquiry queues; job Summary, Photos, Quote & payments, Dispatch, Evidence, History, Financials tabs; quote revisions and itemised prices                                                                                                                          | Build and local tests; full provider staging test required                                                 |
| Photo quote conversion | Private uploads, secure hashed-token link, customer accept/decline, real slot hold, exactly one linked booking, existing server Checkout                                                                                                                                                     | Local acceptance and concurrent-accept tests; Stripe test payment must be exercised with configured keys   |
| C: onboarding          | Passwordless driver application start; full UK licence eligibility, van ownership/size and town/postcode; approval email for password setup; seven-stage saved application; private documents; consented encrypted check credentials; manual review; policy-based age/points/expiry blocking | No DVLA, insurer or register lookup is automated; these are human checks                                   |
| D: driver / dispatch   | Mobile workspace and installable manifest; online windows; hours/coverage/capacity/waste matching; unique live assignment locks; accept/decline/timeout; reasoned release; milestone updates                                                                                                 | Real MongoDB replica-set concurrency tests; availability is not GPS                                        |
| E: evidence / payout   | Separate before/after pickup, approved facility and receipt; independent verification; optional uploaded WTN; immutable offer/economics/policy snapshot; conditional/approved/scheduled/paid/held ledger and adjustments                                                                     | Manual bank transfer only; no bank details collected or transfer initiated                                 |
| Notifications          | Transactional outbox with recipient/event/template version, in-app updates, retry attempts and locked delivery; scheduler endpoint                                                                                                                                                           | Resend delivery needs live configuration and scheduler; no test emails were sent                           |
| Security               | Server role scopes; finance cannot read driver IDs; private image/document route; expiring provider download URL; dedicated AES-GCM key for DVLA credentials; MIME/signature/size checks; rate counters; noindex private layouts                                                             | Provider delivery, malware scanning and historical public asset remediation are staging/launch gates below |
| PWA                    | Driver manifest; offline notice only; private data and API calls are never cached by the service worker                                                                                                                                                                                      | Secure context required; install behavior needs real iOS/Android check                                     |
| Themes                 | Light/dark control on new driver and operations workspaces, responsive layouts                                                                                                                                                                                                               | Existing public website is preserved; full public-site dark theme is not introduced                        |

## Explicitly not represented as implemented

- Deposits/part-pay checkout and a refund initiation UI. The booking schema reserves distinct partial-payment states, while current Checkout still collects the full approved amount. Verified refund and dispute events hold unpaid driver settlements; initiate actual refunds in Stripe until a delegated refund workflow is implemented.
- Bulk corporate reports, recurring multi-site schedules, GPS/ETAs, route optimisation, AI-generated decisions, autonomous driver matching, automatic bank transfers, marketplace KYC or payout-provider integration. These are later phases in the brief.
- Automatic DVLA/insurance/facility verification, employment classification, approved legal WTN generation, regulatory certification, recycling claims or external checks. Only a person can sign off checks and upload authorised documents.
- Malware-scanning service and automatic record-retention deletion. File signatures and MIME/size are checked; PDFs download as attachments. Configure scanning/quarantine and the company's retention schedule before receiving production identity documents.
- Retrospective privacy of existing public Cloudinary URLs. New uploads are authenticated assets. The migration reports legacy public files; those must be copied to authenticated storage, references updated and public originals retired with a backed-up, reviewed remediation procedure. They cannot be made private merely by changing the web UI.

## Configuration

Retain existing database, Stripe, Cloudinary and Resend variables. MongoDB must be a replica set / Atlas deployment supporting transactions. Do not point integration tests at the application database.

If uploads report Cloudinary `Invalid Signature` or authentication HTTP 401, replace `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` with matching credentials from the same Cloudinary product environment. Use the API secret, not the API key or a delivery signing key. Restart the development server after updating `.env`; update deployment environment variables and redeploy for production. The SDK generates upload signatures automatically; keep uploads authenticated. Credential failures return HTTP 503 to the app and a configuration diagnostic in server logs.

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

## Driver application and password setup

New applicants do not choose a password. They must confirm a full UK driving licence and provide their town/city, postcode and van-ownership answer; owners also provide a make/model and van size. A “No” licence answer is rejected by both the form and server. Applicants without a van can submit for company-vehicle review without inventing vehicle documents, but the existing vehicle, insurance, roadworthiness and other operational checks still block activation until complete.

Pending applicants can request a single-use application access link at `/driver/login`. Staff approval queues a separate single-use password-setup link. Links expire after 48 hours, are stored as hashes on the account, and are replaced when a new link is requested. Password setup requires the application to remain active, invalidates earlier application-only sessions and enables normal driver sign-in. Existing driver passwords continue to work.

Email links use the existing notification outbox: configure `NEXT_PUBLIC_SITE_URL`, `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL` and the maintenance/outbox worker described above. Passwords are chosen by the driver and are never emailed. Restart the app after deploying these schema changes. No production records need to be migrated for this change.

## Audit fixes and operational rollout

The coverage API is now included in source control (only the root `/coverage/` test-report directory is ignored). Load tariffs and item catalog prices are shared by the public selectors, quote API and final server-side booking calculation. `/admin/pricing` edits load tariffs; `/admin/catalog` edits items. Price-book defaults are inserted only when a key has no database record.

The hold TTL index must be removed with the reviewed migration. `npm run migrate:audit -- --apply` drops only TTL indexes on `Hold.expiresAt`, creates the current indexes and new workflow collections, initialises missing price-book records, and reconciles slot capacity. Take a backup and run the read-only mode first. Reservation creation and release are transactional; reconciliation also repairs capacity if a previous TTL index already deleted a hold. Pending payment windows expire after one hour, and Stripe sessions use that expiry. Payments received after capacity was released go to `payment_review` for staff handling, without dispatch or an automatic new reservation.

Customers can request cancellation or a new collection date from their booking. Both require staff review in the job cockpit. Active assignments must be released before a change is approved. Paid bookings can be moved to a different available slot; unpaid reservations should be cancelled and restarted. Cancellation does not automatically promise or send a refund. Finance can queue an explicit amount and reason for Stripe processing. The maintenance worker sends each refund with a stable provider idempotency key, checks the provider result and holds related payouts. Unknown/exhausted provider retries require manual reconciliation; their amounts remain reserved against further refunds.

Password recovery is available at `/forgot-password` for customers, business users, staff and approved drivers. Pending driver applicants receive their application/setup link instead. Password-reset links expire after an hour, work once and invalidate earlier session versions. Customer profile name and phone are editable; email changes remain an identity-verification task.

Non-owner driver applicants can be assigned a company van, capacity, current insurance/roadworthiness dates and five private supporting assets in the driver review screen. These reset the relevant checks and return the application to vehicle review. They do not activate the driver or bypass policy.

Administrators onboard business organisations at `/admin/organizations`; managers maintain sites and billing contact in `/portal/sites`. New bookings are linked to the signed-in account’s organisation. Historical bookings are not automatically reassigned to organisations; review any historical backfill before applying it. Business reports export only the organisation’s verified/closed collections and do not invent environmental outcomes.

Finance issues immutable, uniquely numbered invoices from paid, undisputed jobs after company details and any required VAT number have been approved. Existing invoices can be printed or saved as PDF through the browser. Payment receipts are also available, explicitly labelled as not being VAT invoices. Refunded/disputed jobs require a credit-note review before a new invoice is issued.

The owner configures and approves company details, VAT treatment and policy text at `/admin/settings`. Until approved, existing legal drafts remain visibly drafts; no company registration, waste licence or legal approval has been invented. Reviews require a completed verified booking and customer publication consent, and are moderated at `/admin/reviews` before becoming public.

Two missing local workflow secrets (`DRIVER_DATA_KEY` and `CRON_SECRET`) were generated locally without displaying their values. Copy the appropriate securely stored values into the deployment environment; do not regenerate a driver encryption key after real identity data has been encrypted. Real Stripe credentials, a verified notification sender, the production origin and a running maintenance schedule still require environment-specific configuration. Live payments, refunds and email delivery must be exercised in staging with authorised test accounts before launch.

For an existing v1.2 deployment, use the narrow audit migration: run `npm run migrate:audit` to inspect the target database, take a backup, then explicitly run `npm run migrate:audit -- --apply`. It creates only the required audit-workflow collections/indexes, removes the obsolete hold TTL index, inserts missing price defaults without overwriting existing prices, and reconciles reservations. It does not re-run legacy crew conversion or driver approvals. Older v1.2 installations should still review the original platform migration separately if it has never been applied.
