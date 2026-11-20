import { getLoad, ITEMS } from "@/lib/constants";
import { type z } from "zod";
import { estimateSchema } from "@/lib/validation";
type Estimate = z.infer<typeof estimateSchema>;
export function priceEstimate(
  data: Estimate,
  zoneSurcharge = 0,
  catalog?: {
    vatRate?: number;
    vatIncluded?: boolean;
    loads?: { key: string; title: string; base: number }[];
    items?: { key: string; title: string; price: number }[];
  },
) {
  let subtotalMinor = 0;
  let lines: { title: string; qty: number; unitMinor: number }[] = [];
  if (data.kind === "load") {
    const load = catalog?.loads
      ? catalog.loads.find((load) => load.key === data.loadKey)
      : getLoad(data.loadKey);
    if (!load) throw new Error("Unknown load size");
    subtotalMinor = load.base;
    lines = [{ title: load.title, qty: 1, unitMinor: load.base }];
  } else {
    lines = data.items.map((entry) => {
      const i = (catalog?.items ?? ITEMS).find((x) => x.key === entry.key);
      if (!i) throw new Error(`Unknown item: ${entry.key}`);
      return { title: i.title, qty: entry.qty, unitMinor: i.price };
    });
    subtotalMinor = lines.reduce((a, l) => a + l.qty * l.unitMinor, 0);
  }
  const surcharges = {
    area: zoneSurcharge,
    stairs: data.stairs ? 2000 : 0,
    longCarry: data.longCarry ? 1500 : 0,
    specialHandling: data.specialHandling ? 2500 : 0,
  };
  const surchargeMinor = Object.values(surcharges).reduce((a, n) => a + n, 0);
  const rate = catalog?.vatRate ?? Number(process.env.VAT_RATE ?? "0.2");
  if (!Number.isFinite(rate) || rate < 0 || rate > 1)
    throw Error("Invalid VAT rate");
  const include =
    catalog?.vatIncluded ?? process.env.PRICES_INCLUDE_VAT === "true";
  const grossBase = subtotalMinor + surchargeMinor;
  const vatMinor = include
    ? Math.round((grossBase * rate) / (1 + rate))
    : Math.round(grossBase * rate);
  const totalMinor = include ? grossBase : grossBase + vatMinor;
  return {
    currency: "GBP" as const,
    lines,
    subtotalMinor,
    surchargeMinor,
    surcharges,
    vatMinor,
    totalMinor,
    vatIncluded: include,
  };
}
