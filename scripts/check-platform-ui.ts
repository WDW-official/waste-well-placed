import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { SignJWT } from "jose";
import {
  User,
  Booking,
  Organization,
  Zone,
  Slot,
  Post,
} from "../src/lib/models";
import { DriverApplication } from "../src/lib/operations/models";
import { adminLinks } from "../src/lib/admin-links";
async function main() {
  const directory = resolve(process.argv[2] ?? ".");
  const output = await mkdtemp(resolve(tmpdir(), "wwp-platform-ui-"));
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const secret = randomBytes(32).toString("hex");
  const port = 3437;
  const origin = `http://localhost:${port}`;
  const uploadedImage =
    "https://res.cloudinary.com/cfgipbsv/image/upload/v1/admin-test-image.png";
  const uploadBytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6V8AAAAASUVORK5CYII=",
    "base64",
  );
  let server: ReturnType<typeof spawn> | undefined;
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    await mongoose.connect(replica.getUri("wwp_ui_test"));
    const owner = await User.create({
      name: "UI test owner",
      email: "owner@example.test",
      passwordHash: "not-a-login",
      role: "superadmin",
    });
    const driver = await User.create({
      name: "UI test applicant",
      email: "driver@example.test",
      passwordHash: "not-a-login",
      role: "driver",
    });
    const customer = await User.create({
      name: "UI test customer",
      email: "customer@example.test",
      passwordHash: "not-a-login",
      role: "customer",
    });
    const business = await User.create({
      name: "UI test manager",
      email: "business@example.test",
      passwordHash: "not-a-login",
      role: "business",
    });
    const organization = await Organization.create({
      name: "UI test business",
      legalName: "UI Test Business",
      managerId: business._id,
      billingEmail: "billing@example.test",
      sites: [],
    });
    await User.updateOne(
      { _id: business._id },
      { $set: { organizationId: organization._id } },
    );
    const application = await DriverApplication.create({
      userId: driver._id,
      legalName: "UI test applicant",
      status: "draft",
    });
    const submittedApplicant = await User.create({
      name: "Applicant awaiting review",
      email: "submitted-driver@example.test",
      passwordHash: "not-a-login",
      role: "driver",
    });
    await DriverApplication.create({
      userId: submittedApplicant._id,
      legalName: "Applicant awaiting review",
      status: "submitted",
    });
    const booking = await Booking.create({
      userId: customer._id,
      reference: "UI-TEST-JOB",
      address: { postcode: "SW1A 1AA", line1: "Test address", city: "London" },
      status: "confirmed",
      paymentStatus: "paid",
      price: { totalMinor: 12000, vatMinor: 2000 },
      scheduledAt: new Date(Date.now() + 86400_000),
    });
    const zone = await Zone.create({
      name: "UI modal area",
      prefixes: ["E1"],
      capacity: 3,
      allowedDays: [1, 2, 3, 4, 5],
      active: true,
    });
    await Slot.create({
      zoneId: zone._id,
      start: new Date(Date.now() + 86400_000),
      end: new Date(Date.now() + 90000_000),
      capacity: 3,
      reservedCount: 1,
      active: true,
    });
    await Post.create({
      slug: "ui-modal-test",
      title: "UI modal article",
      body: "Full article text for checking record details and editing in a modal.",
      excerpt: "UI test summary",
      published: false,
    });
    server = spawn(
      process.execPath,
      [
        resolve("node_modules/next/dist/bin/next"),
        process.env.UI_DEV ? "dev" : "start",
        directory,
        "-p",
        String(port),
        "-H",
        "localhost",
      ],
      {
        cwd: directory,
        env: {
          ...process.env,
          MONGODB_URI: replica.getUri("wwp_ui_test"),
          SESSION_SECRET: secret,
          DRIVER_DATA_KEY: randomBytes(32).toString("hex"),
          RESEND_API_KEY: "",
          STRIPE_SECRET_KEY: "",
          NOTIFICATION_FROM_EMAIL: "",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let logs = "";
    server.stdout?.on("data", (chunk) => {
      logs = (logs + String(chunk)).slice(-6000);
    });
    server.stderr?.on("data", (chunk) => {
      logs = (logs + String(chunk)).slice(-6000);
    });
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      try {
        if ((await fetch(origin + "/driver/login")).ok) {
          ready = true;
          break;
        }
      } catch {
        /* The temporary server is starting. */
      }
      await new Promise((done) => setTimeout(done, 250));
    }
    if (!ready) throw Error(`UI server did not start: ${logs}`);
    const coverage = await fetch(origin + "/api/coverage/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postcode: "invalid" }),
    });
    if (coverage.status !== 422)
      throw Error(
        `Coverage route missing or not validating input: ${coverage.status}`,
      );
    browser = await chromium.launch({ headless: true });
    const scenarios = [
      { path: "/", role: "public", userId: "" },
      { path: "/book/details", role: "public", userId: "" },
      { path: "/book/load", role: "public", userId: "" },
      { path: "/book/items", role: "public", userId: "" },
      { path: "/book/schedule", role: "public", userId: "" },
      { path: "/book/checkout", role: "public", userId: "" },
      { path: "/book/photo-quote", role: "public", userId: "" },
      { path: "/forgot-password", role: "public", userId: "" },
      {
        path: "/reset-password?token=" + "a".repeat(64),
        role: "public",
        userId: "",
      },
      ...adminLinks.map(({ href }) => ({
        path: href,
        role: "superadmin",
        userId: String(owner._id),
      })),
      ...["/portal/sites", "/portal/reports", "/portal/invoices"].map(
        (path) => ({ path, role: "business", userId: String(business._id) }),
      ),
      {
        path: `/account/bookings/${booking._id}`,
        role: "customer",
        userId: String(customer._id),
      },
      { path: "/work-with-us", role: "public", userId: "" },
      { path: "/driver/login", role: "public", userId: "" },
      { path: "/driver/apply", role: "driver", userId: String(driver._id) },
      { path: "/driver", role: "driver", userId: String(driver._id) },
      { path: "/admin/jobs", role: "superadmin", userId: String(owner._id) },
      {
        path: `/admin/jobs/${booking._id}`,
        role: "superadmin",
        userId: String(owner._id),
      },
      {
        path: `/admin/drivers/${application._id}`,
        role: "superadmin",
        userId: String(owner._id),
      },
      {
        path: "/admin/operations-settings",
        role: "superadmin",
        userId: String(owner._id),
      },
    ];
    let checks = 0;
    for (const width of [320, 375, 390, 1440]) {
      for (const scenario of scenarios.filter(
        (item) =>
          !process.env.UI_ONLY ||
          process.env.UI_ONLY.split(",").includes(item.path),
      )) {
        const context = await browser.newContext({
          viewport: { width, height: 900 },
        });
        if (scenario.userId) {
          const token = await new SignJWT({ role: scenario.role })
            .setProtectedHeader({ alg: "HS256" })
            .setSubject(scenario.userId)
            .setIssuedAt()
            .setExpirationTime("1h")
            .sign(new TextEncoder().encode(secret));
          await context.addCookies([
            { name: "wwp_session", value: token, url: origin },
          ]);
        }
        const page = await context.newPage();
        let displayedPrice = 12345;
        let releaseInitialPrices = () => {};
        const initialPrices = new Promise<void>((done) => {
          releaseInitialPrices = done;
        });
        let failPrices = false;
        const selectionPricePage = ["/book/load", "/book/items"].includes(
          scenario.path,
        );
        const pricePage = [
          "/book/load",
          "/book/items",
          "/book/schedule",
          "/book/checkout",
        ].includes(scenario.path);
        if (["/book/load", "/book/items"].includes(scenario.path)) {
          const kind = scenario.path === "/book/load" ? "loads" : "items";
          await page.route(`**/api/catalog/${kind}`, async (route) => {
            await initialPrices;
            if (failPrices)
              return route.fulfill({
                status: 503,
                json: {
                  error:
                    "Service is temporarily unavailable. Please try again.",
                },
              });
            const response = await route.fetch();
            const data = await response.json();
            for (const row of data[kind])
              row[kind === "loads" ? "base" : "price"] = displayedPrice;
            await route.fulfill({ json: data });
          });
        }
        if (["/book/schedule", "/book/checkout"].includes(scenario.path)) {
          await context.addInitScript(() =>
            localStorage.setItem(
              "wwp_draft",
              JSON.stringify({
                kind: "load",
                loadKey: "mini",
                selected: true,
                postcode: "SW1A 1AA",
                stairs: false,
                longCarry: false,
                specialHandling: false,
                address: {
                  line1: "10 Example Street",
                  city: "London",
                  postcode: "SW1A 1AA",
                  notes: "",
                },
              }),
            ),
          );
          await page.route("**/api/quotes/estimate", (route) =>
            route.fulfill({
              json: {
                estimate: {
                  subtotalMinor: displayedPrice,
                  surchargeMinor: 0,
                  vatMinor: 0,
                  totalMinor: displayedPrice,
                  lines: [
                    { title: "Mini load", qty: 1, unitMinor: displayedPrice },
                  ],
                },
              },
            }),
          );
        }
        const addressPage = ["/book/details", "/book/photo-quote"].includes(
          scenario.path,
        );
        if (addressPage) {
          await context.addInitScript(() =>
            localStorage.setItem(
              "wwp_draft",
              JSON.stringify({
                kind: "load",
                loadKey: "mini",
                selected: true,
                postcode: "SW1A 1AA",
                stairs: false,
                longCarry: false,
                specialHandling: false,
                contact: {
                  name: "Test Customer",
                  email: "customer@example.test",
                  phone: "+447700900123",
                  business: false,
                  whatsapp: false,
                },
              }),
            ),
          );
          await page.route("**/api/postcodes/lookup?**", (route) => {
            const code = new URL(route.request().url()).searchParams
              .get("postcode")
              ?.replace(/\s/g, "")
              .toUpperCase();
            if (code === "B11BB")
              return route.fulfill({
                status: 503,
                json: {
                  error:
                    "Postcode lookup is temporarily unavailable. Please try again shortly.",
                },
              });
            return route.fulfill({
              json: {
                postcode: code === "SW1A1AA" ? "SW1A 1AA" : "M1 1AE",
                district: code === "SW1A1AA" ? "Westminster" : "Manchester",
              },
            });
          });
        }
        const tablePage = [
          "/admin/catalog",
          "/admin/content",
          "/admin/slots",
          "/admin/areas",
          "/admin/pricing",
          "/admin/customers",
        ].includes(scenario.path);
        if (
          process.env.UI_LOADING &&
          (tablePage || scenario.path === "/admin")
        ) {
          let first = true;
          await page.route(
            tablePage ? "**/api/admin/collections?**" : "**/api/operations?**",
            async (route) => {
              if (first && route.request().method() === "GET") {
                first = false;
                await new Promise((done) => setTimeout(done, 1500));
              }
              await route.continue();
            },
          );
        }
        await page.route("**/api/admin/images", (route) =>
          route.fulfill({ status: 201, json: { secureUrl: uploadedImage } }),
        );
        await page.route(uploadedImage, (route) =>
          route.fulfill({ contentType: "image/png", body: uploadBytes }),
        );
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(origin + scenario.path, {
          waitUntil: "domcontentloaded",
        });
        if (
          process.env.UI_LOADING &&
          (tablePage || scenario.path === "/admin")
        ) {
          await page
            .locator(
              tablePage
                ? '.data-table[aria-busy="true"] .admin-skeleton-block'
                : ".admin-skeleton-metrics",
            )
            .first()
            .waitFor();
          if (
            tablePage &&
            (await page.getByText("No results found", { exact: true }).count())
          )
            throw Error("Empty state displayed while records are loading");
          await page.screenshot({
            path: resolve(
              output,
              `${width}-${scenario.path.replace(/[^a-z0-9]/gi, "_")}-loading.png`,
            ),
          });
          await page
            .locator(
              tablePage
                ? '.data-table[aria-busy="false"]'
                : ".admin-overview-metric",
            )
            .first()
            .waitFor();
        }
        await page.waitForTimeout(500);
        if (selectionPricePage) {
          await page
            .getByRole("status", { name: "Loading price", exact: true })
            .first()
            .waitFor();
          const cards = page.locator(
            scenario.path === "/book/load" ? ".load-card" : ".item-card",
          );
          if (!(await cards.count()))
            throw Error("Selection cards disappeared during price loading");
          await page.screenshot({
            path: resolve(
              output,
              `${width}-${scenario.path.replace(/[^a-z0-9]/gi, "_")}-price-loading.png`,
            ),
          });
          releaseInitialPrices();
        }
        if (pricePage) {
          await page
            .getByText(/£123\.45/)
            .first()
            .waitFor();
          displayedPrice = 23456;
          await page.evaluate(() => window.dispatchEvent(new Event("focus")));
          await page
            .getByText(/£234\.56/)
            .first()
            .waitFor();
          if (await page.getByText(/£123\.45/).count())
            throw Error("Outdated price remained after refreshing");
        }
        if (selectionPricePage) {
          failPrices = true;
          await page.evaluate(() => window.dispatchEvent(new Event("focus")));
          await page
            .getByRole("alert")
            .filter({ hasText: "Prices are temporarily unavailable" })
            .waitFor();
          if (
            !(await page
              .locator(
                scenario.path === "/book/load" ? ".load-card" : ".item-card",
              )
              .count())
          )
            throw Error("Cards disappeared after price lookup failed");
          if (await page.getByText(/£234\.56/).count())
            throw Error("Old prices remained after lookup failed");
          await page.screenshot({
            path: resolve(
              output,
              `${width}-${scenario.path.replace(/[^a-z0-9]/gi, "_")}-price-unavailable.png`,
            ),
          });
          failPrices = false;
          await page
            .getByRole("button", { name: "Try again", exact: true })
            .click();
          await page
            .getByText(/£234\.56/)
            .first()
            .waitFor();
        }
        if (addressPage) {
          if (scenario.path === "/book/details")
            await page
              .getByRole("button", { name: "Next", exact: true })
              .click();
          else
            await page
              .getByRole("button", { name: /Add collection details/ })
              .click();
          const lookup = page.locator(".address-lookup");
          const street = page.locator(
            scenario.path === "/book/details" ? "#line1" : "#quote-street",
          );
          const city = page.locator(
            scenario.path === "/book/details" ? "#city" : "#quote-city",
          );
          await street.fill("10 Example Street");
          await lookup
            .getByRole("button", { name: "Find area", exact: true })
            .click();
          await lookup.getByRole("status").waitFor();
          if (
            (await street.inputValue()) !== "10 Example Street" ||
            (await city.inputValue()) !== "Westminster"
          )
            throw Error(
              "Postcode lookup did not fill area or overwrote manual street",
            );
          await page.screenshot({
            path: resolve(
              output,
              `${width}-${scenario.path.replace(/[^a-z0-9]/gi, "_")}-address-filled.png`,
            ),
          });
          const postcode = lookup.getByRole("textbox", {
            name: "UK postcode",
            exact: true,
          });
          await postcode.fill("M11AE");
          if ((await street.inputValue()) || (await city.inputValue()))
            throw Error("Changing postcode retained the previous address");
          await lookup
            .getByRole("button", { name: "Find area", exact: true })
            .click();
          await lookup.getByRole("status").waitFor();
          if ((await city.inputValue()) !== "Manchester")
            throw Error("Address lookup failed for a postcode outside London");
          await postcode.fill("B11BB");
          await lookup
            .getByRole("button", { name: "Find area", exact: true })
            .click();
          await lookup.getByRole("alert").waitFor();
          await lookup
            .getByRole("button", {
              name: "Enter address manually",
              exact: true,
            })
            .click();
          if (
            !(await street.evaluate(
              (element) => element === document.activeElement,
            ))
          )
            throw Error("Manual address entry did not receive focus");
          await street.fill("100 Manual Road");
          await city.fill("Birmingham");
        }
        if (scenario.path.startsWith("/admin")) {
          await page.locator(".admin-workspace").waitFor();
          if (scenario.path === "/admin") {
            await page.locator(".admin-overview-metric").first().waitFor();
            if ((await page.locator(".admin-overview-metric").count()) !== 4)
              throw Error("Admin overview must show four summary cards");
            const destinations = await page
              .locator(".admin-overview-metric")
              .evaluateAll((elements) =>
                elements.map((element) => element.getAttribute("href")),
              );
            if (
              JSON.stringify(destinations) !==
              JSON.stringify([
                "/admin/quotes",
                "/admin/jobs",
                "/admin/drivers",
                "/admin/jobs?status=evidence_submitted",
              ])
            )
              throw Error("Overview cards do not link to their related pages");
            if (
              (await page
                .locator('.admin-overview-metric[href="/admin/drivers"] strong')
                .innerText()) !== "1"
            )
              throw Error(
                "Driver application card must count submitted applications and exclude drafts",
              );
          } else if (await page.locator(".admin-overview-metric").count()) {
            throw Error("Overview summary cards repeated on a queue page");
          }
          if (
            await page
              .locator(".site-header, .footer, .floating-actions")
              .count()
          )
            throw Error(`Public layout present at ${scenario.path}`);
          if ((await page.locator("h1").count()) !== 1)
            throw Error(`Expected one page heading at ${scenario.path}`);
          const navigation = page.locator(".admin-sidebar nav");
          if ((await navigation.locator("a").count()) !== adminLinks.length)
            throw Error(`Missing sidebar links at ${scenario.path}`);
          if ((await navigation.locator('[aria-current="page"]').count()) !== 1)
            throw Error(`Missing active sidebar link at ${scenario.path}`);
          if (width < 901) {
            const contentWidth = await page
              .locator(".admin-main-column")
              .evaluate((element) => element.getBoundingClientRect().width);
            if (contentWidth !== width)
              throw Error(
                `Admin content does not fill mobile viewport: ${contentWidth}/${width}`,
              );
            await page
              .getByRole("button", { name: "Open admin navigation" })
              .click();
            const mobileNav = page.getByRole("navigation", {
              name: "Mobile admin navigation",
              exact: true,
            });
            await mobileNav.locator("a").last().scrollIntoViewIfNeeded();
            if (
              !(await mobileNav.evaluate(
                (element) =>
                  element.scrollHeight <= element.clientHeight + 1 ||
                  element.scrollTop > 0,
              ))
            )
              throw Error("Mobile sidebar does not scroll");
            await page
              .getByRole("button", { name: "Close navigation" })
              .click();
          }
        }
        const safeName = scenario.path.replace(/[^a-z0-9]/gi, "_");
        const overflow = await page.evaluate(() => ({
          viewport: innerWidth,
          body: document.documentElement.scrollWidth,
        }));
        if (overflow.body > overflow.viewport + 1) {
          const outside = await page.evaluate(() =>
            Array.from(document.querySelectorAll("body *"))
              .filter(
                (element) =>
                  element.getBoundingClientRect().right > innerWidth + 1,
              )
              .slice(-12)
              .map((element) => ({
                tag: element.tagName,
                class: element.className,
                right: element.getBoundingClientRect().right,
                text: element.textContent?.slice(0, 70),
              })),
          );
          console.log(JSON.stringify(outside));
          throw Error(
            `Horizontal overflow at ${scenario.path}, ${width}px: ${overflow.body}`,
          );
        }
        if (errors.length)
          throw Error(
            `Browser errors at ${scenario.path}: ${errors.join("; ")}`,
          );
        await page.screenshot({
          path: resolve(output, `${width}-${safeName}.png`),
          fullPage: true,
        });
        if (tablePage && scenario.path !== "/admin/customers") {
          await page
            .getByRole("button", { name: "Add record", exact: true })
            .click();
          const create = page.getByRole("dialog", {
            name: "Add record",
            exact: true,
          });
          await create.waitFor();
          const bounds = await create.boundingBox();
          if (!bounds || bounds.x < 0 || bounds.x + bounds.width > width)
            throw Error("Create modal overflows the viewport");
          if (scenario.path === "/admin/slots") {
            await create
              .getByRole("combobox", {
                name: "Schedule group (optional)",
                exact: true,
              })
              .click();
            await create
              .getByRole("option", { name: "UI modal area", exact: true })
              .click();
          } else if (scenario.path === "/admin/pricing") {
            await create
              .getByRole("combobox", { name: "Load key", exact: true })
              .click();
            await create
              .locator('[role="option"]:not([aria-disabled="true"])')
              .first()
              .click();
            if (
              !(await create
                .getByRole("textbox", { name: "Load title", exact: true })
                .inputValue())
            )
              throw Error("Load selection did not prefill the title");
          }
          const boolean = create.getByRole("combobox", {
            name: scenario.path === "/admin/content" ? "Published" : "Active",
            exact: true,
          });
          await boolean.click();
          await create.getByRole("option", { name: "No", exact: true }).click();
          await boolean.click();
          await page.keyboard.press("Escape");
          if (!(await create.isVisible()))
            throw Error("Closing a dropdown closed the create modal");
          await page.screenshot({
            path: resolve(output, `${width}-${safeName}-create.png`),
          });
          const textInput = create.locator('input[type="text"]').first();
          if (await textInput.count())
            await textInput.fill("Discarded changes");
          await create
            .getByRole("button", { name: "Cancel", exact: true })
            .click();
          await create.waitFor({ state: "hidden" });
          await page
            .getByRole("button", { name: "Add record", exact: true })
            .click();
          await create.waitFor();
          if ((await textInput.count()) && (await textInput.inputValue()))
            throw Error("Canceled create form did not reset");
          await page.keyboard.press("Escape");
          await create.waitFor({ state: "hidden" });
        }
        if (width === 1440 && scenario.path === "/admin/content") {
          await page
            .getByRole("button", { name: "Add record", exact: true })
            .click();
          await page
            .getByLabel("URL slug", { exact: true })
            .fill("ui-image-article");
          await page
            .getByLabel("Article title", { exact: true })
            .fill("Article with an uploaded image");
          await page
            .getByLabel("Article text", { exact: true })
            .fill("An article created with an image picked from a file.");
          await page
            .getByLabel("Choose image file", { exact: true })
            .setInputFiles({
              name: "picked.png",
              mimeType: "image/png",
              buffer: uploadBytes,
            });
          await page
            .locator(`.admin-image-input img[src="${uploadedImage}"]`)
            .waitFor();
          const created = page.waitForResponse(
            (result) =>
              result.url().endsWith("/api/admin/collections") &&
              result.request().method() === "POST",
          );
          await page
            .getByRole("button", { name: "Create record", exact: true })
            .click();
          if (!(await created).ok())
            throw Error("Could not create a record with an uploaded image");
          await page
            .getByRole("cell", {
              name: "Article with an uploaded image",
              exact: true,
            })
            .waitFor();
        }
        if (
          [
            "/admin/catalog",
            "/admin/slots",
            "/admin/areas",
            "/admin/content",
            "/admin/customers",
          ].includes(scenario.path)
        ) {
          await page
            .getByRole("button", { name: "View", exact: true })
            .first()
            .click();
          const modal = page.getByRole("dialog");
          await modal
            .getByRole("heading", { name: "Record details", exact: true })
            .waitFor();
          const fits = await modal.evaluate((element) => {
            const bounds = element.getBoundingClientRect();
            return (
              bounds.left >= 0 &&
              bounds.right <= innerWidth &&
              element.scrollWidth <= element.clientWidth + 1
            );
          });
          if (!fits)
            throw Error(
              `Record modal overflows at ${scenario.path}, ${width}px`,
            );
          await page.screenshot({
            path: resolve(output, `${width}-${safeName}-view.png`),
          });
          if (scenario.path === "/admin/customers") {
            if (
              await modal
                .getByRole("button", { name: "Edit record", exact: true })
                .count()
            )
              throw Error("Read-only users have an edit action");
            await page.keyboard.press("Escape");
          } else {
            await modal
              .getByRole("button", { name: "Edit record", exact: true })
              .click();
            await modal
              .getByRole("heading", { name: "Edit record", exact: true })
              .waitFor();
            await page.screenshot({
              path: resolve(output, `${width}-${safeName}-edit.png`),
            });
            if (width === 1440) {
              if (scenario.path === "/admin/catalog") {
                const imageInput = modal.getByLabel("Choose image file", {
                  exact: true,
                });
                await imageInput.setInputFiles({
                  name: "invalid.txt",
                  mimeType: "text/plain",
                  buffer: Buffer.from("not an image"),
                });
                await modal.getByRole("alert").waitFor();
                await imageInput.setInputFiles({
                  name: "picked.png",
                  mimeType: "image/png",
                  buffer: uploadBytes,
                });
                await modal.locator(`img[src="${uploadedImage}"]`).waitFor();
                await modal
                  .locator(".admin-image-loading-status")
                  .waitFor({ state: "hidden" });
                if (
                  !(await modal
                    .locator(`img[src="${uploadedImage}"]`)
                    .evaluate(
                      (element) =>
                        (element as HTMLImageElement).naturalWidth > 0,
                    ))
                )
                  throw Error("Uploaded image could not be displayed");
                await modal
                  .getByLabel("Item name", { exact: true })
                  .fill("Updated modal item");
                await modal
                  .getByLabel("Price (£)", { exact: true })
                  .fill("64.00");
                await modal
                  .getByRole("checkbox", { name: /^Active/ })
                  .uncheck();
              } else if (scenario.path === "/admin/areas") {
                await modal
                  .getByLabel("Outward postcodes, as a JSON list", {
                    exact: true,
                  })
                  .fill("invalid JSON");
                await modal
                  .getByRole("button", { name: "Save changes", exact: true })
                  .click();
                await modal.getByRole("alert").waitFor();
                await modal
                  .getByLabel("Outward postcodes, as a JSON list", {
                    exact: true,
                  })
                  .fill('["E1", "E2"]');
              } else if (scenario.path === "/admin/slots") {
                if (
                  !(await modal
                    .getByLabel("Start (your local time)", { exact: true })
                    .isDisabled())
                )
                  throw Error("Reserved slot dates must be locked");
                await modal
                  .getByLabel("Collection capacity", { exact: true })
                  .fill("4");
              } else {
                await modal
                  .getByLabel("Article text", { exact: true })
                  .fill("Updated full article text through the record modal.");
              }
              const response = page.waitForResponse(
                (result) =>
                  result.url().endsWith("/api/admin/record") &&
                  result.request().method() === "PATCH",
              );
              await modal
                .getByRole("button", { name: "Save changes", exact: true })
                .click();
              const saved = await response;
              if (!saved.ok())
                throw Error(
                  `Record modal save failed at ${scenario.path}: ${await saved.text()}`,
                );
              await modal.waitFor({ state: "hidden" });
              if (scenario.path === "/admin/catalog")
                await page
                  .getByRole("cell", {
                    name: "Updated modal item",
                    exact: true,
                  })
                  .waitFor();
              if (
                scenario.path === "/admin/catalog" ||
                scenario.path === "/admin/content"
              ) {
                await page
                  .getByRole("button", { name: "View", exact: true })
                  .first()
                  .click();
                await modal.locator(`img[src="${uploadedImage}"]`).waitFor();
                await page.screenshot({
                  path: resolve(
                    output,
                    `${width}-${safeName}-uploaded-image.png`,
                  ),
                });
                await modal
                  .getByRole("button", { name: "Close", exact: true })
                  .click();
              }
              if (
                scenario.path === "/admin/slots" &&
                Object.keys(saved.request().postDataJSON().patch).join(",") !==
                  "capacity"
              )
                throw Error("Unchanged slot fields were resubmitted");
            } else {
              await modal
                .getByRole("button", { name: "Cancel", exact: true })
                .click();
              await modal.waitFor({ state: "hidden" });
            }
            await page
              .getByRole("button", { name: "Edit", exact: true })
              .first()
              .click();
            await modal
              .getByRole("heading", { name: "Edit record", exact: true })
              .waitFor();
            await page.keyboard.press("Escape");
            await modal.waitFor({ state: "hidden" });
          }
        }
        if (["/admin/catalog", "/admin/pricing"].includes(scenario.path)) {
          await page.locator(".table-wrap").evaluate((element) => {
            element.scrollLeft = element.scrollWidth;
          });
          const priceButton = page
            .getByRole("button", { name: /^Change price for/ })
            .first();
          await priceButton.click();
          const priceModal = page.getByRole("dialog", {
            name: "Change price",
            exact: true,
          });
          await priceModal.waitFor();
          const priceInput = priceModal.getByRole("spinbutton", {
            name: "Price (£)",
            exact: true,
          });
          const previous = await priceInput.inputValue();
          const next = (Number(previous) + 1.25).toFixed(2);
          await priceInput.fill(next);
          await page.screenshot({
            path: resolve(output, `${width}-${safeName}-change-price.png`),
          });
          const changed = page.waitForResponse(
            (response) =>
              response.url().endsWith("/api/admin/record") &&
              response.request().method() === "PATCH",
          );
          await priceModal
            .getByRole("button", { name: "Save price", exact: true })
            .click();
          const saved = await changed;
          if (!saved.ok())
            throw Error(`Price update failed: ${await saved.text()}`);
          const payload = saved.request().postDataJSON();
          if (
            Object.keys(payload.patch).join(",") !== "priceMinor" ||
            payload.patch.priceMinor !== Math.round(Number(next) * 100)
          )
            throw Error("GBP price was not converted to pence correctly");
          await priceModal.waitFor({ state: "hidden" });
          await page
            .getByRole("button", { name: /^Change price for/ })
            .first()
            .click();
          if ((await priceInput.inputValue()) !== next)
            throw Error("Saved price did not persist in pounds");
          await priceModal
            .getByRole("button", { name: "Cancel", exact: true })
            .click();
        }
        if (width === 1440 && scenario.path === "/admin") {
          await page
            .locator('.admin-overview-metric[href="/admin/drivers"]')
            .click();
          await page.waitForURL(origin + "/admin/drivers");
          await page
            .getByRole("heading", { name: "Driver applications", exact: true })
            .waitFor();
          await page.goBack();
          await page
            .locator(
              '.admin-overview-metric[href="/admin/jobs?status=evidence_submitted"]',
            )
            .click();
          await page.waitForURL(
            origin + "/admin/jobs?status=evidence_submitted",
          );
          if (
            (await page
              .getByRole("textbox", { name: "Filter by status" })
              .inputValue()) !== "evidence_submitted"
          )
            throw Error(
              "Evidence card did not apply the collection status filter",
            );
        }
        if (width === 1440 && scenario.path === "/admin/settings") {
          const scrolled = await page.evaluate(() => {
            const shell =
              document.querySelector<HTMLElement>(".admin-workspace")!;
            const nav =
              document.querySelector<HTMLElement>(".admin-sidebar-nav")!;
            const view = document.querySelector<HTMLElement>(".admin-view")!;
            const filler = document.createElement("div");
            filler.style.height = "2500px";
            view.append(filler);
            shell.dataset.persistenceCheck = "kept";
            view.scrollTop = 180;
            nav.scrollTop = 150;
            return {
              view: view.scrollTop,
              nav: nav.scrollTop,
              body: document.scrollingElement?.scrollTop,
            };
          });
          if (
            scrolled.view !== 180 ||
            scrolled.nav !== 150 ||
            scrolled.body !== 0
          )
            throw Error(
              `Admin scroll areas are not independent: ${JSON.stringify(scrolled)}`,
            );
          await page
            .getByRole("navigation", { name: "Admin navigation", exact: true })
            .getByRole("link", { name: "Catalog", exact: true })
            .click();
          await page.waitForURL(origin + "/admin/catalog");
          await page
            .getByRole("heading", { name: "Item catalog", exact: true })
            .waitFor();
          const persistent = await page.evaluate(() => ({
            shell:
              document.querySelector<HTMLElement>(".admin-workspace")?.dataset
                .persistenceCheck,
            scroll: document.querySelector(".admin-view")?.scrollTop,
          }));
          if (persistent.shell !== "kept" || persistent.scroll !== 0)
            throw Error(
              "Sidebar was remounted or new page did not start at the top",
            );
        }
        checks++;
        await context.close();
      }
    }
    console.log(
      `Browser checks passed: ${checks} page/viewport combinations. Screenshots: ${output}`,
    );
  } finally {
    await browser?.close();
    server?.kill("SIGTERM");
    await mongoose.disconnect();
    await replica.stop();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "UI check failed");
  process.exitCode = 1;
});
