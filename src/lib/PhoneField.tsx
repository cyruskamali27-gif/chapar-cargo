import 'react-phone-number-input/style.css';
import PhoneInputComponent from 'react-phone-number-input';
import type { Country } from 'react-phone-number-input';

export type { Country };
export { isValidPhoneNumber } from 'react-phone-number-input';

export function PhoneField({
  value,
  onChange,
  defaultCountry = 'IR',
  placeholder,
  hasError,
}: {
  value:           string;
  onChange:        (v: string) => void;
  defaultCountry?: Country;
  placeholder?:    string;
  hasError?:       boolean;
}) {
  return (
    <div
      dir="ltr"
      className={`ds-phone-field${hasError ? ' ds-phone-field--error' : ''}`}
    >
      <PhoneInputComponent
        value={value || undefined}
        onChange={v => onChange(v ?? '')}
        defaultCountry={defaultCountry}
        international
        placeholder={placeholder}
      />
    </div>
  );
}
