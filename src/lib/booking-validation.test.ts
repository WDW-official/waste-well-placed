import { describe, expect, it } from "vitest";
import { bookingSchema } from "./validation";

const booking = {
  kind: "load",
  postcode: "SW1A 1AA",
  loadKey: "mini",
  address: { line1: "10 Test Street", city: "London", postcode: "SW1A 1AA" },
  slotId: "0123456789abcdef01234567",
  holdId: "0123456789abcdef01234568",
  idempotencyKey: "3be04ccd-9f37-4efc-9cb6-bae039d56c56",
};
const contact = {
  name: "Test Customer",
  email: "customer@example.com",
  phone: "07123456789",
  business: false,
  whatsapp: false,
};

describe("Booking collection details", () => {
  it("preserves the contact details and uploaded photos used by the quote form", () => {
    const photos = [
      {
        publicId: "waste-well-placed/quote/example",
        secureUrl:
          "https://res.cloudinary.com/example/image/upload/example.jpg",
      },
    ];
    const parsed = bookingSchema.parse({ ...booking, contact, photos });
    expect(parsed.contact).toEqual(contact);
    expect(parsed.photos).toEqual(photos);
  });
  it("continues accepting existing bookings without optional contact metadata", () => {
    expect(bookingSchema.safeParse(booking).success).toBe(true);
  });
  it("rejects invalid contact details", () => {
    expect(
      bookingSchema.safeParse({
        ...booking,
        contact: { ...contact, email: "invalid" },
      }).success,
    ).toBe(false);
  });
  it("rejects photos outside the configured upload provider", () => {
    expect(
      bookingSchema.safeParse({
        ...booking,
        photos: [
          {
            publicId: "other/image",
            secureUrl: "https://example.com/image.jpg",
          },
        ],
      }).success,
    ).toBe(false);
  });
});
