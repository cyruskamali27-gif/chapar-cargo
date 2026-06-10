import { type ProtectionType, calculatePricing } from './shipmentTypes';

interface Props {
  value: ProtectionType;
  onChange: (v: ProtectionType) => void;
  declaredValue?: number;
  weightKg?: number;
  pricePerKg?: number;
}

const OPTIONS: { type: ProtectionType; label: string; desc: string; features: string[]; badge: string; badgeClass: string }[] = [
  {
    type: 'NONE',
    label: 'بدون تضمین',
    desc: 'مناسب برای مدارک، نامه‌ها و اقلام کم‌ارزش.',
    features: ['بدون امانی', 'بدون ودیعه مسافر', 'کمترین کارمزد'],
    badge: 'بدون تضمین',
    badgeClass: 'bg-gray-100 text-gray-600 border-gray-200',
  },
  {
    type: 'TRAVELER_GUARANTEE',
    label: 'تضمین مسافر',
    desc: 'مسافر مبلغ تضمین قرار می‌دهد تا امنیت فرستنده افزایش یابد.',
    features: ['ودیعه مسافر الزامی', 'بدون ودیعه فرستنده', 'جبران خسارت در صورت عدم تحویل'],
    badge: 'تضمین مسافر',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    type: 'SENDER_GUARANTEE',
    label: 'تضمین فرستنده',
    desc: 'فرستنده مبلغ تضمین قرار می‌دهد تا از وقت و هزینه مسافر محافظت شود.',
    features: ['ودیعه فرستنده الزامی', 'بدون ودیعه مسافر', 'حمایت از مسافر'],
    badge: 'تضمین فرستنده',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  {
    type: 'FULL_ESCROW',
    label: 'تضمین دوطرفه',
    desc: 'بالاترین سطح امنیت برای کالاهای ارزشمند.',
    features: ['ودیعه مسافر', 'ودیعه فرستنده', 'حساب امانی', 'رسیدگی به اختلافات', 'تأیید تحویل'],
    badge: 'تضمین دوطرفه',
    badgeClass: 'bg-green-50 text-green-700 border-green-200',
    recommended: true,
  } as { type: ProtectionType; label: string; desc: string; features: string[]; badge: string; badgeClass: string; recommended?: boolean },
];

export { OPTIONS as PROTECTION_OPTIONS };

export default function ProtectionSelector({ value, onChange, declaredValue = 200, weightKg = 2, pricePerKg = 20 }: Props) {
  const pricing = calculatePricing(value, declaredValue, weightKg, pricePerKg);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1 h-5 bg-cyan-500 rounded-full" />
        <h3 className="text-base font-bold text-gray-900">سطح امنیت و تضمین حمل</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {OPTIONS.map(opt => {
          const active = value === opt.type;
          return (
            <button
              key={opt.type}
              type="button"
              onClick={() => onChange(opt.type)}
              className={`text-start p-4 rounded-xl border-2 transition-all ${
                active
                  ? 'border-cyan-500 bg-cyan-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
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
                {(opt as { recommended?: boolean }).recommended && (
                  <span className="text-[10px] font-bold bg-cyan-500 text-white px-2 py-0.5 rounded-full">پیشنهادی</span>
                )}
              </div>
              <p className={`text-xs leading-relaxed mb-2 ${active ? 'text-cyan-600' : 'text-gray-500'}`}>{opt.desc}</p>
              <ul className="space-y-1">
                {opt.features.map(f => (
                  <li key={f} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className={`w-1 h-1 rounded-full flex-shrink-0 ${active ? 'bg-cyan-500' : 'bg-gray-300'}`} />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      {/* Live pricing summary */}
      <div className="bg-slate-50 border border-gray-200 rounded-xl p-4">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">برآورد هزینه</div>
        <div className="space-y-1.5">
          {[
            ['کارمزد حمل', `$${pricing.baseFee}`],
            ['کارمزد پلتفرم', `$${pricing.platformFee}`],
            ...(pricing.travelerDeposit > 0 ? [['ودیعه مسافر', `$${pricing.travelerDeposit}`]] : []),
            ...(pricing.senderDeposit > 0 ? [['ودیعه فرستنده', `$${pricing.senderDeposit}`]] : []),
            ['نوع بیمه', pricing.insuranceLabel],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span className="text-gray-500">{k}</span>
              <span className="text-gray-800 font-medium">{v}</span>
            </div>
          ))}
          <div className="border-t border-gray-200 pt-2 mt-2 flex justify-between font-bold">
            <span className="text-gray-700">جمع کل</span>
            <span className="text-cyan-600">${pricing.total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Badge component for route cards / marketplace
export function ProtectionBadge({ type }: { type: ProtectionType }) {
  const opt = OPTIONS.find(o => o.type === type);
  if (!opt) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${opt.badgeClass}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-60" />
      {opt.badge}
    </span>
  );
}
