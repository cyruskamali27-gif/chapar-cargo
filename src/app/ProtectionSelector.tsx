import type { SecurityLevel } from './shipmentTypes';

interface Props {
  securityLevel: SecurityLevel;
  onSecurityLevel: (v: SecurityLevel) => void;
  identityVerificationRequired: boolean;
  cargoVerificationRequired: boolean;
  otpDeliveryRequired: boolean;
  deliveryPhotoRequired: boolean;
  onIdentityVerification: (v: boolean) => void;
  onCargoVerification: (v: boolean) => void;
  onOtpDelivery: (v: boolean) => void;
  onDeliveryPhoto: (v: boolean) => void;
}

const LEVELS: { value: SecurityLevel; label: string; sub: string; badge: string; recommended?: boolean }[] = [
  {
    value: 'STANDARD',
    label: 'حمل عادی',
    sub: 'مناسب برای مدارک، نامه‌ها و اقلام کم‌ارزش. بدون ودیعه.',
    badge: 'حمل عادی',
  },
  {
    value: 'GUARANTEED',
    label: 'حمل تضمینی',
    sub: 'برای کالاهای ارزشمند. ودیعه مسافر قفل می‌شود تا تضمین تحویل داشته باشید.',
    badge: 'حمل تضمینی',
    recommended: true,
  },
];

const OPTIONAL_SERVICES: { key: keyof Props; label: string; desc: string }[] = [
  { key: 'identityVerificationRequired', label: 'احراز هویت مسافر',   desc: 'تأیید هویت مسافر پیش از تحویل کالا' },
  { key: 'cargoVerificationRequired',    label: 'تأیید کالا',          desc: 'بررسی و تأیید محتوای بسته توسط مسافر' },
  { key: 'otpDeliveryRequired',          label: 'OTP تحویل',           desc: 'کد تأیید یک‌بار مصرف برای تحویل نهایی' },
  { key: 'deliveryPhotoRequired',        label: 'عکس تحویل',           desc: 'مسافر موظف به ارسال عکس لحظه تحویل است' },
];

export default function SecuritySelector({
  securityLevel, onSecurityLevel,
  identityVerificationRequired, cargoVerificationRequired,
  otpDeliveryRequired, deliveryPhotoRequired,
  onIdentityVerification, onCargoVerification,
  onOtpDelivery, onDeliveryPhoto,
}: Props) {
  const boolGetters: Record<string, boolean> = {
    identityVerificationRequired,
    cargoVerificationRequired,
    otpDeliveryRequired,
    deliveryPhotoRequired,
  };
  const boolSetters: Record<string, (v: boolean) => void> = {
    identityVerificationRequired: onIdentityVerification,
    cargoVerificationRequired: onCargoVerification,
    otpDeliveryRequired: onOtpDelivery,
    deliveryPhotoRequired: onDeliveryPhoto,
  };

  return (
    <div className="space-y-5">
      {/* Security level */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 bg-cyan-500 rounded-full" />
          <h3 className="text-base font-bold text-gray-900">سطح امنیت حمل</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {LEVELS.map(opt => {
            const active = securityLevel === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSecurityLevel(opt.value)}
                className={`text-start p-4 rounded-xl border-2 transition-all ${
                  active ? 'border-cyan-500 bg-cyan-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      active ? 'border-cyan-500 bg-cyan-500' : 'border-gray-300'
                    }`}>
                      {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <span className={`text-sm font-semibold ${active ? 'text-cyan-700' : 'text-gray-800'}`}>
                      {opt.label}
                    </span>
                  </div>
                  {opt.recommended && (
                    <span className="text-[10px] font-bold bg-cyan-500 text-white px-2 py-0.5 rounded-full">پیشنهادی</span>
                  )}
                </div>
                <p className={`text-xs leading-relaxed ${active ? 'text-cyan-600' : 'text-gray-500'}`}>{opt.sub}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Optional services */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-5 bg-gray-300 rounded-full" />
          <h3 className="text-sm font-bold text-gray-700">خدمات تکمیلی</h3>
          <span className="text-xs text-gray-400">(اختیاری)</span>
        </div>
        <div className="space-y-2">
          {OPTIONAL_SERVICES.map(svc => {
            const checked = boolGetters[svc.key];
            const toggle  = boolSetters[svc.key];
            return (
              <button
                key={svc.key}
                type="button"
                onClick={() => toggle(!checked)}
                className={`w-full text-start flex items-start gap-3 p-3 rounded-xl border transition-all ${
                  checked ? 'border-cyan-300 bg-cyan-50' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                  checked ? 'border-cyan-500 bg-cyan-500' : 'border-gray-300'
                }`}>
                  {checked && <span className="text-white text-[10px] font-black leading-none">✓</span>}
                </div>
                <div>
                  <div className={`text-sm font-semibold ${checked ? 'text-cyan-700' : 'text-gray-800'}`}>{svc.label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{svc.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Badge for marketplace cards and route lists
export function SecurityBadge({ level }: { level: SecurityLevel }) {
  const isGuaranteed = level === 'GUARANTEED';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${
      isGuaranteed
        ? 'bg-green-50 text-green-700 border-green-200'
        : 'bg-gray-100 text-gray-600 border-gray-200'
    }`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
      {isGuaranteed ? 'حمل تضمینی' : 'حمل عادی'}
    </span>
  );
}
