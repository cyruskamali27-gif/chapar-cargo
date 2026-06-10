import { useState } from 'react';
import { BadgeCheck, Camera, Phone, Cpu, Upload, Package, FileText, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import type { VerificationStatus } from './shipmentTypes';

// ─── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: VerificationStatus }) {
  const cfg = {
    PENDING:       { label: 'در انتظار',        cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', Icon: Clock },
    VERIFIED:      { label: 'تأیید شده',        cls: 'bg-green-50 text-green-700 border-green-200',   Icon: CheckCircle },
    REJECTED:      { label: 'رد شده',           cls: 'bg-red-50 text-red-700 border-red-200',         Icon: XCircle },
    MANUAL_REVIEW: { label: 'بررسی دستی',       cls: 'bg-blue-50 text-blue-700 border-blue-200',      Icon: AlertCircle },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.cls}`}>
      <cfg.Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ─── File upload stub ──────────────────────────────────────────────────────────
function FileUploadStub({ label, accept, icon: Icon }: { label: string; accept: string; icon: React.FC<{ className?: string }> }) {
  const [file, setFile] = useState<string | null>(null);
  return (
    <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-4 cursor-pointer hover:border-cyan-300 hover:bg-cyan-50/30 transition-all">
      <input type="file" accept={accept} className="hidden" onChange={e => setFile(e.target.files?.[0]?.name ?? null)} />
      {file ? (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle className="w-4 h-4" />
          <span className="text-sm font-medium truncate max-w-[160px]">{file}</span>
        </div>
      ) : (
        <>
          <Icon className="w-6 h-6 text-gray-400" />
          <span className="text-xs text-gray-500 text-center">{label}</span>
        </>
      )}
    </label>
  );
}

// ─── Identity Verification ─────────────────────────────────────────────────────
interface IdentityVerificationProps {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  status: VerificationStatus;
}

export function IdentityVerification({ enabled, onToggle, status }: IdentityVerificationProps) {
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${enabled ? 'bg-blue-50 border border-blue-200' : 'bg-gray-100'}`}>
            <BadgeCheck className={`w-4 h-4 ${enabled ? 'text-blue-600' : 'text-gray-400'}`} />
          </div>
          <div className="text-start">
            <div className="text-sm font-semibold text-gray-900">احراز هویت</div>
            <div className="text-xs text-gray-500">تأیید هویت با هوش مصنوعی</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {enabled && <StatusBadge status={status} />}
          <div className={`w-10 h-6 rounded-full transition-colors relative ${enabled ? 'bg-blue-500' : 'bg-gray-200'}`}>
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${enabled ? 'right-1' : 'left-1'}`} />
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {enabled && (
        <div className="border-t border-gray-100 px-5 py-5 bg-slate-50 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FileUploadStub label="کارت ملی یا پاسپورت" accept="image/*,.pdf" icon={FileText} />
            <FileUploadStub label="سلفی / عکس زنده" accept="image/*" icon={Camera} />
          </div>

          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">تأیید شماره موبایل</span>
            </div>
            <StatusBadge status="VERIFIED" />
          </div>

          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">بررسی هوش مصنوعی</span>
            </div>
            <StatusBadge status={status} />
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            اطلاعات هویتی شما به‌صورت رمزنگاری‌شده ذخیره می‌شود و تنها برای تأیید هویت استفاده خواهد شد.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Cargo Verification ────────────────────────────────────────────────────────
interface CargoVerificationProps {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  status: VerificationStatus;
}

export function CargoVerification({ enabled, onToggle, status }: CargoVerificationProps) {
  const [declaredValue, setDeclaredValue] = useState('');
  const [serial, setSerial]               = useState('');

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => onToggle(!enabled)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${enabled ? 'bg-purple-50 border border-purple-200' : 'bg-gray-100'}`}>
            <Package className={`w-4 h-4 ${enabled ? 'text-purple-600' : 'text-gray-400'}`} />
          </div>
          <div className="text-start">
            <div className="text-sm font-semibold text-gray-900">احراز کالا</div>
            <div className="text-xs text-gray-500">تأیید محتوا و ارزش کالا</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {enabled && <StatusBadge status={status} />}
          <div className={`w-10 h-6 rounded-full transition-colors relative ${enabled ? 'bg-purple-500' : 'bg-gray-200'}`}>
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${enabled ? 'right-1' : 'left-1'}`} />
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {enabled && (
        <div className="border-t border-gray-100 px-5 py-5 bg-slate-50 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FileUploadStub label="عکس‌های کالا (اجباری)" accept="image/*" icon={Camera} />
            <FileUploadStub label="ویدیو کالا (اختیاری)" accept="video/*" icon={Upload} />
          </div>
          <FileUploadStub label="رسید خرید (اختیاری)" accept="image/*,.pdf" icon={FileText} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">ارزش اعلام‌شده ($)</label>
              <input type="number" placeholder="200" className="ds-input text-sm"
                value={declaredValue} onChange={e => setDeclaredValue(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">شماره سریال (اختیاری)</label>
              <input type="text" placeholder="SN-XXXX" className="ds-input text-sm"
                value={serial} onChange={e => setSerial(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">بررسی ریسک هوش مصنوعی</span>
            </div>
            <StatusBadge status={status} />
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            احراز کالا احتمال اختلاف را کاهش می‌دهد و پوشش بیمه‌ای بیشتری ارائه می‌دهد.
          </p>
        </div>
      )}
    </div>
  );
}
