export type ResourceField = {
  key: string;
  label: string;
  type?: "text" | "number" | "boolean" | "json" | "datetime" | "textarea";
  required?: boolean;
};
export const resourceFields: Record<string, ResourceField[]> = {
  zones: [
    { key: "name", label: "Area name", required: true },
    {
      key: "prefixes",
      label: "Outward postcodes, as a JSON list",
      type: "json",
      required: true,
    },
    { key: "surchargeMinor", label: "Area surcharge (pence)", type: "number" },
    { key: "capacity", label: "Default capacity", type: "number" },
    { key: "active", label: "Active", type: "boolean" },
  ],
  slots: [
    { key: "zoneId", label: "Service area", required: true },
    {
      key: "start",
      label: "Start (your local time)",
      type: "datetime",
      required: true,
    },
    {
      key: "end",
      label: "End (your local time)",
      type: "datetime",
      required: true,
    },
    {
      key: "capacity",
      label: "Collection capacity",
      type: "number",
      required: true,
    },
    { key: "active", label: "Active", type: "boolean" },
  ],
  catalog: [
    { key: "key", label: "Item key", required: true },
    { key: "title", label: "Item name", required: true },
    { key: "category", label: "Category", required: true },
    { key: "image", label: "Image URL" },
    {
      key: "priceMinor",
      label: "Price (pence)",
      type: "number",
      required: true,
    },
    { key: "active", label: "Active", type: "boolean" },
  ],
  tariffs: [
    { key: "key", label: "Load key", required: true },
    { key: "title", label: "Load title", required: true },
    {
      key: "priceMinor",
      label: "Price (pence)",
      type: "number",
      required: true,
    },
    { key: "active", label: "Active", type: "boolean" },
  ],
  services: [
    { key: "slug", label: "Service slug", required: true },
    { key: "title", label: "Title", required: true },
    { key: "description", label: "Description", type: "textarea" },
    { key: "image", label: "Image URL" },
    { key: "active", label: "Active", type: "boolean" },
  ],
  posts: [
    { key: "slug", label: "URL slug", required: true },
    { key: "title", label: "Article title", required: true },
    { key: "excerpt", label: "Summary", type: "textarea" },
    { key: "body", label: "Article text", type: "textarea", required: true },
    { key: "image", label: "Image URL" },
    { key: "published", label: "Published", type: "boolean" },
  ],
};
