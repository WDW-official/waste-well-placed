import { describe, it, expect, vi } from "vitest";
vi.mock("./auth", () => ({ getSession: vi.fn() }));
import { csvCell } from "./business";
describe("business report CSV", () => {
  it("quotes commas and line breaks", () => {
    expect(csvCell('A, B\n"test"')).toBe('"A, B\n""test"""');
  });
  it("neutralises spreadsheet formulas", () => {
    expect(csvCell("=SUM(A1:A2)")).toBe('"\'=SUM(A1:A2)"');
  });
});
