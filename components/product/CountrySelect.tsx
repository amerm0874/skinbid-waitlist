"use client";

import { countryOptions } from "@/lib/countries";

export default function CountrySelect({
  value,
  onChange,
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const selected = value.trim();
  const options = countryOptions(selected);

  return (
    <select
      className="field"
      name="country"
      autoComplete="off"
      required={required}
      size={1}
      value={selected}
      onChange={(event) => onChange(event.target.value)}
    >
      {selected ? null : (
        <option value="" disabled>
          Select country
        </option>
      )}
      {options.map((country) => (
        <option key={country} value={country}>
          {country}
        </option>
      ))}
    </select>
  );
}
