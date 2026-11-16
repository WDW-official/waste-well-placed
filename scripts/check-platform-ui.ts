import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { SignJWT } from "jose";
import { User, Booking } from "../src/lib/models";
import { DriverApplication } from "../src/lib/operations/models";
async function main() {
  const directory = resolve(process.argv[2] ?? ".");
  const output = await mkdtemp(resolve(tmpdir(), "wwp-platform-ui-"));
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const secret = randomBytes(32).toString("hex");
  const port = 3437;
  const origin = `http://127.0.0.1:${port}`;
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
    const application = await DriverApplication.create({
      userId: driver._id,
      legalName: "UI test applicant",
      status: "draft",
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
    server = spawn(
      process.execPath,
      [
        resolve("node_modules/next/dist/bin/next"),
        "start",
        directory,
        "-p",
        String(port),
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
    browser = await chromium.launch({ headless: true });
    const scenarios = [
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
        (item) => !process.env.UI_ONLY || item.path === process.env.UI_ONLY,
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
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(origin + scenario.path, {
          waitUntil: "domcontentloaded",
        });
        await page.waitForTimeout(500);
        const safeName = scenario.path.replace(/[^a-z0-9]/gi, "_");
        for (const theme of ["light", "dark"]) {
          if (
            theme === "dark" &&
            (await page.getByRole("button", { name: "Use dark theme" }).count())
          )
            await page.getByRole("button", { name: "Use dark theme" }).click();
          await page.waitForTimeout(300);
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
              `Horizontal overflow at ${scenario.path}, ${width}px, ${theme}: ${overflow.body}`,
            );
          }
          if (errors.length)
            throw Error(
              `Browser errors at ${scenario.path}: ${errors.join("; ")}`,
            );
          await page.screenshot({
            path: resolve(output, `${width}-${safeName}-${theme}.png`),
            fullPage: true,
          });
          checks++;
        }
        await context.close();
      }
    }
    console.log(
      `Browser checks passed: ${checks} page/viewport/theme combinations. Screenshots: ${output}`,
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
