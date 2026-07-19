import 'react-phone-number-input/style.css';
import React from 'react';
import PhoneInputComponent, { getCountryCallingCode } from 'react-phone-number-input';
import type { Country } from 'react-phone-number-input';
import { isValidPhoneNumber } from 'react-phone-number-input';

export type { Country };
export { isValidPhoneNumber } from 'react-phone-number-input';

const CORRIDOR: Country[] = ['IR','CA','US','GB','DE','FR','TR','AE'];

const FA: Partial<Record<string,string>> = {
  IR:'ایران', CA:'کانادا', US:'آمریکا', GB:'بریتانیا',
  DE:'آلمان', FR:'فرانسه', TR:'ترکیه', AE:'امارات',
};

interface CSProps {
  value?: Country;
  onChange: (c?: Country) => void;
  options: Array<{ value?: Country; label?: string; divider?: boolean }>;
  disabled?: boolean; tabIndex?: number; className?: string;
}

const flag=(cc:string)=>[...cc.toUpperCase()].map(c=>String.fromCodePoint(0x1F1E6+c.charCodeAt(0)-65)).join('');
function ChaparCountrySelect({ value, onChange, options, disabled, tabIndex }: CSProps) {
  const vals = options.filter(o => o.value && !o.divider).map(o => o.value as Country);
  const corridorOpts = CORRIDOR.filter(c => vals.includes(c));
  const otherOpts    = vals.filter(c => !CORRIDOR.includes(c));
  return (
    <select value={value ?? ''} onChange={e => onChange((e.target.value as Country)||undefined)}
      disabled={disabled} tabIndex={tabIndex} className="PhoneInputCountrySelect"
      aria-label="کشور" style={{ direction:'ltr' }}>
      {corridorOpts.map(c => (
        <option key={c} value={c}>{flag(c)} +{getCountryCallingCode(c)}{FA[c]?' ‒ '+FA[c]:''}</option>
      ))}
      <option disabled>────────</option>
      {otherOpts.map(c => {
        const lbl = options.find(o=>o.value===c)?.label ?? c;
        return <option key={c} value={c}>{flag(c)} +{getCountryCallingCode(c)} {lbl}</option>;
      })}
    </select>
  );
}

export function PhoneField({
  value, onChange, defaultCountry='IR', placeholder, hasError, disabled,
}: {
  value: string; onChange: (v:string)=>void;
  defaultCountry?: Country; placeholder?: string; hasError?: boolean; disabled?: boolean;
}) {
  const e164      = value && value.startsWith('+') ? value : null;
  const isInvalid = hasError && !!value && !isValidPhoneNumber(value);
  return (
    <div dir="ltr" className={`ds-phone-field${hasError?' ds-phone-field--error':''}`}>
      <PhoneInputComponent
        value={value||undefined} onChange={v=>onChange(v??'')}
        defaultCountry={defaultCountry} international
        countryCallingCodeEditable={false}
        placeholder={placeholder} disabled={disabled}
        countrySelectComponent={ChaparCountrySelect}
      />
      {e164&&<p className="text-[10px] text-gray-400 mt-0.5 font-mono" dir="ltr">{e164}</p>}
      {isInvalid&&<p className="text-[11px] text-red-500 mt-1" dir="rtl">شماره تلفن معتبر نیست</p>}
    </div>
  );
}
