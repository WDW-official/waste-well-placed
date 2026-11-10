"use client";

import { useEffect, useRef, useState } from "react";
import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/min";
import { Select } from "@/components/select";
import {
  internationalPhone,
  phoneCountry,
  type PhoneCountry,
} from "@/lib/phone-countries";

type PhoneInputProps = {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

let countriesRequest: Promise<PhoneCountry[]> | undefined;
function loadCountries() {
  if (!countriesRequest) {
    countriesRequest = fetch("/api/phone-countries")
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load countries");
        const data = await response.json();
        if (!Array.isArray(data.countries) || !data.countries.length)
          throw new Error("No countries available");
        return data.countries as PhoneCountry[];
      })
      .catch((error) => {
        countriesRequest = undefined;
        throw error;
      });
  }
  return countriesRequest;
}

function initialNumber(value: string) {
  const parsed = value.startsWith("+")
    ? parsePhoneNumberFromString(value)
    : undefined;
  return {
    country: parsed?.country ?? ("GB" as CountryCode),
    text: parsed?.country ? parsed.formatNational() : value,
  };
}

export function PhoneInput({
  id,
  value,
  onValueChange,
  required,
  disabled,
  className = "",
}: PhoneInputProps) {
  const [country, setCountry] = useState<CountryCode>(
    () => initialNumber(value).country,
  );
  const [text, setText] = useState(() => initialNumber(value).text);
  const [countries, setCountries] = useState<PhoneCountry[]>([]);
  const [failed, setFailed] = useState(false);
  const emittedValue = useRef(value);

  useEffect(() => {
    let cancelled = false;
    loadCountries()
      .then((list) => {
        if (!cancelled) setCountries(list);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (value === emittedValue.current) return;
    emittedValue.current = value;
    const incoming = initialNumber(value);
    setCountry(incoming.country);
    setText(incoming.text);
  }, [value]);

  function emit(raw: string, selectedCountry: CountryCode) {
    const number = internationalPhone(raw, selectedCountry);
    emittedValue.current = number;
    onValueChange(number);
  }

  const selected = phoneCountry(country);
  const available = countries.length ? countries : [selected];

  return (
    <div className={`phone-field ${className}`}>
      <div className="phone-input-group">
        <Select
          id={`${id}-country`}
          aria-label="Phone country code"
          value={country}
          selectedLabel={`${selected.flag} ${selected.callingCode}`}
          disabled={disabled}
          className="phone-country-select"
          onValueChange={(code) => {
            const next = code as CountryCode;
            setCountry(next);
            const parsed = text.startsWith("+")
              ? parsePhoneNumberFromString(text)
              : undefined;
            const national = parsed ? String(parsed.nationalNumber) : text;
            setText(national);
            emit(national, next);
          }}
          options={available.map((item) => ({
            value: item.code,
            label: `${item.name} ${item.flag} (${item.callingCode})`,
          }))}
        />
        <input
          id={id}
          type="tel"
          autoComplete="tel-national"
          inputMode="tel"
          className="input phone-national-input"
          placeholder="Phone number"
          required={required}
          disabled={disabled}
          minLength={required ? 8 : undefined}
          maxLength={30}
          value={text}
          aria-describedby={failed ? `${id}-country-status` : undefined}
          onChange={(event) => {
            const raw = event.target.value;
            const parsed = raw.startsWith("+")
              ? parsePhoneNumberFromString(raw)
              : undefined;
            const next = parsed?.country ?? country;
            setCountry(next);
            setText(raw);
            emit(raw, next);
          }}
          onBlur={() => {
            const parsed = parsePhoneNumberFromString(text, {
              defaultCountry: country,
              extract: false,
            });
            if (parsed?.country === country) setText(parsed.formatNational());
          }}
        />
      </div>
      {failed && (
        <p
          id={`${id}-country-status`}
          className="phone-country-status"
          role="status"
        >
          Country list unavailable. You can still enter a full number starting
          with +.
        </p>
      )}
    </div>
  );
}
