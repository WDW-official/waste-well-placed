import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/min";

export type PhoneCountry = {
  code: CountryCode;
  name: string;
  callingCode: string;
  flag: string;
};

export function phoneCountry(code: CountryCode): PhoneCountry {
  return {
    code,
    name: new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code,
    callingCode: `+${getCountryCallingCode(code)}`,
    flag: String.fromCodePoint(
      ...[...code].map((letter) => 127397 + letter.charCodeAt(0)),
    ),
  };
}

export function getPhoneCountries(): PhoneCountry[] {
  return getCountries()
    .map(phoneCountry)
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
}

export function internationalPhone(
  value: string,
  country: CountryCode,
): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const parsed = parsePhoneNumberFromString(trimmed, {
    defaultCountry: country,
    extract: false,
  });
  if (parsed) return parsed.number;
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  return trimmed.startsWith("+")
    ? `+${digits}`
    : `+${getCountryCallingCode(country)}${digits}`;
}
