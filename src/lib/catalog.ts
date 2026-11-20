import { Catalog } from "./models";
import { CompanyProfile, Tariff } from "./workflow-models";
import { ITEMS } from "./constants";
import { connectDB } from "./db";
import { priceEstimate } from "./pricing";
import { estimateSchema } from "./validation";
import type { z } from "zod";
import { defaultLoads } from "./catalog-defaults";
export { defaultLoads } from "./catalog-defaults";
export async function itemCatalog() {
  await connectDB();
  const stored = await Catalog.find({}).lean();
  const defaults = ITEMS.map((item) => {
    const row = stored.find((row) => row.key === item.key);
    return {
      ...item,
      title: row?.title ?? item.title,
      category: row?.category ?? item.category,
      price: row?.priceMinor ?? item.price,
      image: row?.image || item.image,
      active: row?.active !== false,
    };
  });
  const additional = stored
    .filter((row) => row.key && !ITEMS.some((item) => item.key === row.key))
    .map((row) => ({
      key: row.key!,
      title: row.title ?? row.key!,
      category: row.category ?? "Other",
      price: row.priceMinor ?? 0,
      image: row.image || ITEMS[0].image,
      active: row.active !== false,
    }));
  return [...defaults, ...additional].filter((item) => item.active);
}
export async function loadCatalog() {
  await connectDB();
  const stored = await Tariff.find({}).lean();
  return defaultLoads.map((load) => {
    const row = stored.find((row) => row.key === load.key);
    return {
      ...load,
      title: row?.title ?? load.title,
      base: row?.priceMinor ?? load.base,
      active: row?.active !== false,
    };
  });
}
export async function quotePrice(
  data: z.infer<typeof estimateSchema>,
  zoneSurcharge = 0,
) {
  await connectDB();
  const company = await CompanyProfile.findOne({
    key: "company",
  }).lean();
  const approvedTax =
    company?.approvedTax?.vatRate != null
      ? company.approvedTax
      : company?.approved
        ? company
        : null;
  const tax = approvedTax
    ? {
        vatRate: approvedTax.vatRegistered ? (approvedTax.vatRate ?? 0.2) : 0,
        vatIncluded: approvedTax.pricesIncludeVat ?? false,
      }
    : {};
  if (data.kind === "items")
    return priceEstimate(data, zoneSurcharge, {
      ...tax,
      items: await itemCatalog(),
    });
  return priceEstimate(data, zoneSurcharge, {
    ...tax,
    loads: (await loadCatalog()).filter((load) => load.active),
  });
}
export async function initialisePriceBook() {
  await connectDB();
  await Tariff.bulkWrite(
    defaultLoads.map((load) => ({
      updateOne: {
        filter: { key: load.key },
        update: {
          $setOnInsert: {
            key: load.key,
            title: load.title,
            priceMinor: load.base,
            active: true,
          },
        },
        upsert: true,
      },
    })),
  );
  await Catalog.bulkWrite(
    ITEMS.map((item) => ({
      updateOne: {
        filter: { key: item.key },
        update: {
          $setOnInsert: {
            key: item.key,
            title: item.title,
            category: item.category,
            priceMinor: item.price,
            image: item.image,
            active: true,
          },
        },
        upsert: true,
      },
    })),
  );
}
