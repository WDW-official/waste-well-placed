import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Waste Well Placed Driver",
    short_name: "WWP Driver",
    description: "Your approved collections, evidence and earnings.",
    start_url: "/driver",
    scope: "/driver",
    display: "standalone",
    background_color: "#f5f8f4",
    theme_color: "#003f35",
    icons: [
      {
        src: "/images/logo-original.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
