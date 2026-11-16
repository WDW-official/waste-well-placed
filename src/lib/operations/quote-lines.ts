export function parseQuoteLines(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      if (
        parts.length !== 3 ||
        !parts[0] ||
        !/^\d+$/.test(parts[1]) ||
        !/^\d+(\.\d{1,2})?$/.test(parts[2])
      )
        throw Error(
          "Use one line per charge: description | quantity | unit price in GBP",
        );
      const qty = Number(parts[1]);
      const unitMinor = Math.round(Number(parts[2]) * 100);
      if (
        qty < 1 ||
        qty > 100 ||
        !Number.isSafeInteger(unitMinor) ||
        unitMinor > 100_000_000
      )
        throw Error("Quote line amounts are out of range");
      return { description: parts[0], qty, unitMinor };
    });
  if (!lines.length || lines.length > 40)
    throw Error("Include between 1 and 40 quote lines");
  return lines;
}
