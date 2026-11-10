import type { MetadataRoute } from "next";
import { SERVICES } from "@/lib/constants";
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return [
    ...[
      "",
      "services",
      "how-it-works",
      "areas",
      "business",
      "about",
      "contact",
      "faq",
      "reviews",
      "blog",
      "privacy",
      "terms",
    ].map((s) => ({
      url: `${base}/${s}`,
      changeFrequency: "monthly" as const,
    })),
    ...SERVICES.map((s) => ({
      url: `${base}/services/${s.slug}`,
      changeFrequency: "monthly" as const,
    })),
  ];
}
