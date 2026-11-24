import { describe, expect, it } from "vitest";
import { collectionSlots } from "./collection-slots";

describe("collection windows", () => {
  it("creates the next two weeks excluding Sundays, starting tomorrow", () => {
    const slots = collectionSlots(new Date("2026-11-24T10:00:00Z"));
    expect(slots).toHaveLength(48);
    expect(slots[0].start.toISOString()).toBe("2026-11-25T09:00:00.000Z");
    expect(slots.at(-1)?.end.toISOString()).toBe("2026-12-08T17:00:00.000Z");
    expect(
      slots.every(
        (s) =>
          s.start.getUTCDay() !== 0 &&
          s.capacity === 3 &&
          s.end.getTime() - s.start.getTime() === 7200000,
      ),
    ).toBe(true);
  });
  it("keeps 9am London time across the daylight saving transition", () => {
    const slots = collectionSlots(new Date("2026-03-27T12:00:00Z"), 4);
    expect(slots[0].start.toISOString()).toBe("2026-03-28T09:00:00.000Z");
    expect(slots[4].start.toISOString()).toBe("2026-03-30T08:00:00.000Z");
  });
});
