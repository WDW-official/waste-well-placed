import { SERVICE_IMAGES, ITEM_IMAGES } from "@/lib/images";

export const SERVICES = [
  {
    slug: "general-waste",
    title: "General waste",
    subtitle: "Everyday rubbish, bags and boxes",
    image: SERVICE_IMAGES["general-waste"],
    icon: "Trash2",
  },
  {
    slug: "furniture",
    title: "Furniture removal",
    subtitle: "Tables, chairs, beds and cabinets",
    image: SERVICE_IMAGES["furniture"],
    icon: "Armchair",
  },
  {
    slug: "sofas",
    title: "Sofa removal",
    subtitle: "Sofas and armchairs of all sizes",
    image: SERVICE_IMAGES["sofas"],
    icon: "Sofa",
  },
  {
    slug: "appliances",
    title: "Appliance removal",
    subtitle: "Fridges, washers and electricals",
    image: SERVICE_IMAGES["appliances"],
    icon: "Refrigerator",
  },
  {
    slug: "office",
    title: "Office clearance",
    subtitle: "Desks, chairs and commercial waste",
    image: SERVICE_IMAGES["office"],
    icon: "Building2",
  },
  {
    slug: "house",
    title: "House clearance",
    subtitle: "Full and partial home clearances",
    image: SERVICE_IMAGES["house"],
    icon: "House",
  },
  {
    slug: "construction-waste",
    title: "Construction waste",
    subtitle: "Building debris, timber and renovation waste",
    image: SERVICE_IMAGES["construction-waste"],
    icon: "Shovel",
  },
  {
    slug: "garden-waste",
    title: "Garden waste",
    subtitle: "Garden cuttings, branches and green waste",
    image: SERVICE_IMAGES["garden-waste"],
    icon: "Leaf",
  },
];
export const ITEM_SERVICE_CATEGORIES: Record<string, string> = {
  furniture: "Furniture",
  sofas: "Sofas",
  appliances: "Appliances",
};

export function itemBookingHref(serviceSlug: string) {
  const category = ITEM_SERVICE_CATEGORIES[serviceSlug];
  return category
    ? `/book/items?category=${encodeURIComponent(category)}`
    : "/book/items";
}

export function isSpecialistLoadService(service: string | null | undefined) {
  return service === "construction-waste" || service === "garden-waste";
}

export function loadBookingHref(service: string) {
  return isSpecialistLoadService(service)
    ? `/book/load?service=${service}`
    : "/book/load";
}

export const LOADS = [
  {
    key: "mini",
    title: "Mini load",
    volume: 2,
    weight: 100,
    bags: 10,
    minutes: 15,
    base: 5900,
  },
  {
    key: "small",
    title: "Small load",
    volume: 4,
    weight: 200,
    bags: 20,
    minutes: 25,
    base: 9900,
  },
  {
    key: "medium",
    title: "Medium load",
    volume: 7,
    weight: 350,
    bags: 35,
    minutes: 40,
    base: 15900,
  },
  {
    key: "large",
    title: "Large load",
    volume: 12,
    weight: 650,
    bags: 55,
    minutes: 60,
    base: 23900,
  },
  {
    key: "xl",
    title: "XL load",
    volume: 16,
    weight: 900,
    bags: 75,
    minutes: 90,
    base: 31900,
  },
];
// Specialist loads have separate guide prices and reuse the small/medium/XL
// weight limits. Their volume is a quarter, half or all of the 16-yard full load.
export const SPECIALIST_LOADS = ["construction", "garden"].flatMap(
  (wasteType) =>
    [
      {
        size: "quarter",
        title: "Quarter load",
        volume: 4,
        base: 14900,
        tariff: LOADS[1],
      },
      {
        size: "half",
        title: "Half load",
        volume: 8,
        base: 26900,
        tariff: LOADS[2],
      },
      {
        size: "full",
        title: "Full load",
        volume: 16,
        base: 44900,
        tariff: LOADS[4],
      },
    ].map(({ size, title, volume, base, tariff }) => ({
      ...tariff,
      key: `${wasteType}-${size}`,
      title: `${wasteType === "construction" ? "Construction" : "Garden"} waste — ${title.toLowerCase()}`,
      sizeTitle: title,
      volume,
      base,
      wasteType,
      service: `${wasteType}-waste`,
    })),
);

export function getLoad(key: string | undefined) {
  return [
    ...LOADS.map((load) => ({
      ...load,
      wasteType: "mixed",
      service: "general-waste",
    })),
    ...SPECIALIST_LOADS,
  ].find((load) => load.key === key);
}

export const ITEMS = [
  {
    key: "sofa-2",
    image: ITEM_IMAGES["sofa-2"],
    title: "2-seater sofa",
    category: "Sofas",
    price: 7400,
  },
  {
    key: "sofa-3",
    image: ITEM_IMAGES["sofa-3"],
    title: "3-seater sofa",
    category: "Sofas",
    price: 8900,
  },
  {
    key: "mattress",
    image: ITEM_IMAGES["mattress"],
    title: "Mattress",
    category: "Beds",
    price: 5900,
  },
  {
    key: "bed-frame",
    image: ITEM_IMAGES["bed-frame"],
    title: "Bed frame",
    category: "Beds",
    price: 6900,
  },
  {
    key: "fridge",
    image: ITEM_IMAGES["fridge"],
    title: "Fridge freezer",
    category: "Appliances",
    price: 8900,
  },
  {
    key: "washer",
    image: ITEM_IMAGES["washer"],
    title: "Washing machine",
    category: "Appliances",
    price: 6900,
  },
  {
    key: "chair",
    image: ITEM_IMAGES["chair"],
    title: "Dining chair",
    category: "Furniture",
    price: 1900,
  },
  {
    key: "table",
    image: ITEM_IMAGES["table"],
    title: "Dining table",
    category: "Furniture",
    price: 5900,
  },
  {
    key: "desk",
    image: ITEM_IMAGES["desk"],
    title: "Office desk",
    category: "Office",
    price: 4900,
  },
  {
    key: "bags",
    image: ITEM_IMAGES["bags"],
    title: "Bagged rubbish",
    category: "General",
    price: 900,
  },
  {
    key: "gym",
    image: ITEM_IMAGES["gym"],
    title: "Gym equipment",
    category: "Gym equipment",
    // Temporary guide price, in pence.
    price: 7900,
  },
];
export const DEFAULT_FAQS = [
  {
    q: "How do I get a price?",
    a: "Enter a supported postcode and choose a load size or individual items. The final amount is shown before payment. Large or unusual clearances are reviewed by our team.",
  },
  {
    q: "Which areas do you cover?",
    a: "Coverage is determined by our current operating postcode zones. Enter your postcode to check availability; we do not promise nationwide service unless we have confirmed it.",
  },
  {
    q: "What waste can you collect?",
    a: "We can assess household and commercial rubbish, furniture and many appliances. Hazardous materials, asbestos, chemicals and other restricted waste require a separate specialist assessment.",
  },
  {
    q: "Do I get waste documentation?",
    a: "Following completion, we can issue an appropriate waste transfer record with the details recorded by the collection team. We only claim licences or recycling rates that have been verified.",
  },
  {
    q: "Can I change or cancel my booking?",
    a: "Contact our team with your reference. Applicable cancellation or rescheduling terms are displayed before payment.",
  },
];
