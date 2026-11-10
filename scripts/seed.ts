import { config } from "dotenv";
config({ path: ".env.local" });
import { connectDB } from "../src/lib/db";
import { Service, Catalog, Zone, Slot, User } from "../src/lib/models";
import { SERVICES, ITEMS } from "../src/lib/constants";
import bcrypt from "bcryptjs";
// WARNING: Example tariffs and coverage below must be replaced with company-approved data before launch.
async function main() {
  await connectDB();
  for (const s of SERVICES) {
    await Service.updateOne(
      { slug: s.slug },
      {
        $setOnInsert: {
          slug: s.slug,
          title: s.title,
          description: s.subtitle,
          image: s.image,
          category: "clearance",
          active: true,
        },
      },
      { upsert: true },
    );
  }
  for (const item of ITEMS) {
    await Catalog.updateOne(
      { key: item.key },
      {
        $setOnInsert: {
          key: item.key,
          title: item.title,
          category: item.category,
          priceMinor: item.price,
          active: true,
        },
      },
      { upsert: true },
    );
  }
  let zone = await Zone.findOne({ name: "Example London zone — NOT VERIFIED" });
  if (!zone) {
    zone = await Zone.create({
      name: "Example London zone — NOT VERIFIED",
      prefixes: (
        process.env.NEXT_PUBLIC_SERVICE_POSTCODE_PREFIXES ||
        "SW,SE,E,N,NW,W,EC,WC"
      )
        .split(",")
        .map((s) => s.trim()),
      active: true,
      surchargeMinor: 0,
      capacity: 3,
      allowedDays: [1, 2, 3, 4, 5, 6],
    });
  }
  for (let i = 1; i <= 14; i++) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + i);
    const day = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      weekday: "short",
    }).format(date);
    if (day === "Sun") continue;
    for (const hour of [9, 11, 13, 15]) {
      const start = new Date(
        Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate(),
          hour,
          0,
        ),
      );
      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      await Slot.updateOne(
        { zoneId: zone._id, start },
        {
          $setOnInsert: {
            zoneId: zone._id,
            start,
            end,
            capacity: 3,
            reservedCount: 0,
            active: true,
          },
        },
        { upsert: true },
      );
    }
  }
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    if (password.length < 12)
      throw Error("SEED_ADMIN_PASSWORD must be at least 12 characters");
    if (!(await User.exists({ email }))) {
      await User.create({
        name: "Operations administrator",
        email,
        passwordHash: await bcrypt.hash(password, 12),
        role: "superadmin",
      });
      console.log("Created superadmin:", email);
    } else console.log("Admin exists; password unchanged");
  }
  console.log(
    "Seed complete. Data is illustrative and must be reviewed before launch.",
  );
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
