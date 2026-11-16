# v1.2 local verification — 16 November 2026

- Production build: passed in an isolated copy of the repository, avoiding the development server's `.next` cache.
- TypeScript: `npm run typecheck` passed.
- ESLint: `npm run lint` passed with no warnings. Generated Next build output is excluded from linting.
- Unit / route-isolation tests: 52 passed.
- MongoDB replica-set integration tests: 8 passed. The test database is temporary and destroyed after the run.
- Chromium responsive checks: 64 page/viewport/theme combinations passed at 320, 375, 390 and 1440 pixels. No detected page JavaScript errors or horizontal document overflow. Driver application and dark policy form screenshots were also visually inspected.

Integration coverage includes simultaneous offers and acceptances, one payout per assignment, expired insurance, minimum margin, reasoned release, mandatory before/after and facility evidence, independent review, duplicate settlement protection, three-photo private quote linkage and concurrent acceptance, denied customer/finance identity access, underage/seven-point activation rejection, duplicate Stripe confirmation and refund event handling. Stripe is mocked in these tests; there are no provider payments or messages.

The browser harness uses synthetic owner, driver and customer accounts in a temporary local database. It checks recruitment, driver sign-in/application/workspace, staff jobs/detail, driver review and owner policy screens. A narrow-screen select overflow and transient dark-theme input contrast issue were fixed during the checks.

Not exercised against live services: actual Stripe Checkout/signatures/event delivery, Cloudinary authenticated upload/download, Resend delivery, external driver/facility checks, bank transfers, scheduler hosting, production migrations, actual-device camera/PWA installation or a full legal/privacy/retention review. See PLATFORM-V1.2-DEPLOYMENT.md for configuration, remaining scope and the staging release exercise. No production data, user accounts, permissions or files were changed.
