import { useState, useEffect } from 'react';
import { BadgeCheck, Camera, Phone, Cpu, Upload, Package, FileText, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import type { VerificationStatus } from './shipmentTypes';
import { useLang } from '../lib/LangContext';
import GuidedCapture, { type CaptureMode, type GuidedCaptureResult } from './GuidedCapture';

// ─── Status badge ──────────────────────────────────────────────────────────────
export function StatusBadge({ status }: { status: VerificationStatus }) {
  const { t } = useLang();
  const cfg = {
    PENDING:       { label: t.verPending,      cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', Icon: Clock },
    VERIFIED:      { label: t.verVerified,     cls: 'bg-green-50 text-green-700 border-green-200',   Icon: CheckCircle },
    REJECTED:      { label: t.verRejected,     cls: 'bg-red-50 text-red-700 border-red-200',         Icon: XCircle },
    MANUAL_REVIEW: { label: t.verManualReview, cls: 'bg-blue-50 text-blue-700 border-blue-200',      Icon: AlertCircle },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.cls}`}>
      <cfg.Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ─── KYC status badge (live fetch from /api/kyc/status) ───────────────────────
// Shows the user's own KYC verdict: pending / under_review / verified / rejected.
// No internal details are ever exposed — only the neutral label.
export function KycStatusBadge() {
  const { t } = useLang();
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('cp_token');
    if (!token) { setStatus('pending'); return; }
    fetch('/api/kyc/status', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setStatus(d?.status ?? 'pending'))
      .catch(() => setStatus('pending'));
  }, []);

  if (status === null) return null;

  const cfg = {
    pending:      { label: t.kycStatusPending,     cls: 'bg-gray-50 text-gray-500 border-gray-200',      Icon: Clock },
    under_review: { label: t.kycStatusUnderReview,  cls: 'bg-blue-50 text-blue-600 border-blue-200',      Icon: AlertCircle },
    verified:     { label: t.kycStatusVerified,     cls: 'bg-green-50 text-green-700 border-green-200',   Icon: CheckCircle },
    rejected:     { label: t.kycStatusRejected,     cls: 'bg-red-50 text-red-600 border-red-200',         Icon: XCircle },
  }[status] ?? { label: status, cls: 'bg-gray-50 text-gray-500 border-gray-200', Icon: Clock };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${cfg.cls}`}>
      <cfg.Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ─── Genuine file-upload stub (PDFs, video, receipts) ─────────────────────────
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

// ─── Camera capture trigger (photo-capture replacements) ──────────────────────
function CameraCaptureTrigger({ label, mode, icon: Icon, withLiveness, nationality, onResult }: {
  label: string;
  mode: CaptureMode;
  icon: React.FC<{ className?: string }>;
  withLiveness?: boolean;
  nationality?: string;
  onResult?: (result: GuidedCaptureResult) => void;
}) {
  const [open,     setOpen]     = useState(false);
  const [captured, setCaptured] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-4 w-full hover:border-cyan-300 hover:bg-cyan-50/30 transition-all"
      >
        {captured ? (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-medium">{label}</span>
          </div>
        ) : (
          <>
            <Icon className="w-6 h-6 text-gray-400" />
            <span className="text-xs text-gray-500 text-center">{label}</span>
          </>
        )}
      </button>

      {open && (
        <GuidedCapture
          mode={mode}
          liveness={withLiveness}
          nationality={nationality}
          onBack={() => setOpen(false)}
          onHome={() => setOpen(false)}
          onComplete={(result) => { setCaptured(true); setOpen(false); onResult?.(result); }}
        />
      )}
    </>
  );
}

// ─── Identity Verification ─────────────────────────────────────────────────────
interface IdentityVerificationProps {
  enabled: boolean;
  onToggle: (v: boolean) => void;
  status: VerificationStatus;
}

export function IdentityVerification({ enabled, onToggle, status }: IdentityVerificationProps) {
  const { t } = useLang();
  const [nationality,    setNationality]    = useState<string | null>(null);
  const [docMediaKey,    setDocMediaKey]    = useState<string | null>(null);
  const [selfieMediaKey, setSelfieMediaKey] = useState<string | null>(null);
  const [faceMatchDone,  setFaceMatchDone]  = useState(false);

  // Fetch KYC status to get nationality (for doc-type routing) + existing docType
  useEffect(() => {
    if (!enabled) return;
    const token = localStorage.getItem('cp_token');
    if (!token) return;
    fetch('/api/kyc/status', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.nationality) setNationality(d.nationality); })
      .catch(() => {});
  }, [enabled]);

  // Auto-trigger face-match when both doc + selfie are uploaded
  useEffect(() => {
    if (!docMediaKey || !selfieMediaKey || faceMatchDone) return;
    const token = localStorage.getItem('cp_token');
    if (!token) return;
    setFaceMatchDone(true);
    fetch('/api/kyc/passport/face-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ selfieMediaKey, passportMediaKey: docMediaKey }),
    }).catch(() => {});
  }, [docMediaKey, selfieMediaKey, faceMatchDone]);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
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
            <div className="text-sm font-semibold text-gray-900">{t.verIdentityTitle}</div>
            <div className="text-xs text-gray-500">{t.verIdentitySub}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {enabled && <StatusBadge status={status} />}
          <div className={`w-10 h-6 rounded-full transition-colors relative ${enabled ? 'bg-blue-500' : 'bg-gray-200'}`}>
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${enabled ? 'right-1' : 'left-1'}`} />
          </div>
        </div>
      </button>

      {enabled && (
        <div className="border-t border-gray-100 px-5 py-5 bg-slate-50 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Document: camera capture with doc-type selection */}
            <CameraCaptureTrigger
              label={t.verDocUpload}
              mode="document"
              icon={FileText}
              nationality={nationality ?? undefined}
              onResult={(r) => { if (r.docMediaKey) setDocMediaKey(r.docMediaKey); }}
            />
            {/* Selfie with liveness */}
            <CameraCaptureTrigger
              label={t.verSelfieUpload}
              mode="face"
              icon={Camera}
              withLiveness
              onResult={(r) => { if (r.selfieMediaKey) setSelfieMediaKey(r.selfieMediaKey); }}
            />
          </div>

          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">{t.verPhoneConfirm}</span>
            </div>
            <StatusBadge status="VERIFIED" />
          </div>

          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">{t.verAiCheck}</span>
            </div>
            <StatusBadge status={status} />
          </div>

          {/* Live KYC status badge */}
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <BadgeCheck className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">{t.kycPassportRow}</span>
            </div>
            <KycStatusBadge />
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">{t.verIdentityNote}</p>
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
  const { t } = useLang();
  const [declaredValue, setDeclaredValue] = useState('');
  const [serial, setSerial]               = useState('');

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
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
            <div className="text-sm font-semibold text-gray-900">{t.verCargoTitle}</div>
            <div className="text-xs text-gray-500">{t.verCargoSub}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {enabled && <StatusBadge status={status} />}
          <div className={`w-10 h-6 rounded-full transition-colors relative ${enabled ? 'bg-purple-500' : 'bg-gray-200'}`}>
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${enabled ? 'right-1' : 'left-1'}`} />
          </div>
        </div>
      </button>

      {enabled && (
        <div className="border-t border-gray-100 px-5 py-5 bg-slate-50 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Cargo photos: image capture only → camera */}
            <CameraCaptureTrigger label={t.verCargoPhotos} mode="photo" icon={Camera} />
            {/* Video: video file upload → genuine file upload, left as-is */}
            <FileUploadStub label={t.verCargoVideo} accept="video/*" icon={Upload} />
          </div>
          {/* Receipt: accepts PDF → genuine file upload, left as-is */}
          <FileUploadStub label={t.verCargoReceipt} accept="image/*,.pdf" icon={FileText} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t.verDeclaredValue}</label>
              <input type="number" placeholder="200" className="ds-input text-sm"
                value={declaredValue} onChange={e => setDeclaredValue(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">{t.verSerialNumber}</label>
              <input type="text" placeholder="SN-XXXX" className="ds-input text-sm"
                value={serial} onChange={e => setSerial(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">{t.verAiRiskCheck}</span>
            </div>
            <StatusBadge status={status} />
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">{t.verCargoNote}</p>
        </div>
      )}
    </div>
  );
}
