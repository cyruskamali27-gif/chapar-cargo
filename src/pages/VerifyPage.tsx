/**
 * VerifyPage — ports verify.html (full KYC) exactly.
 *
 * localStorage keys read/written (mirrors verify.html):
 *   cp_session        — pre-fill personal info (read only)
 *   cp_order          — autosave: firstName, lastName, email, phone,
 *                       docType, docFront, docBack, aiIdPassed, selfie (ref)
 *   cp_face_match_log — raw key, audit log when selfie missing
 *   cp_kyc_identities — raw key, dedup check per identity
 *   cp_verifications  — via Store.set, records pending status per userId
 *
 * No API endpoints — 100% client-side/localStorage, same as verify.html.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, Home, CheckCircle } from 'lucide-react';
import { Store, getSession, getOrder, saveOrder } from '../lib/store';
import { StatusBadge } from '../app/VerificationModules';
import { useLang } from '../lib/LangContext';

type DocType = 'passport' | 'license' | 'national_id';

interface DocConfig {
  camLabel: string;
  frontTitle: string;
  frontHint: string;
  frontIllus: string;
  backTitle?: string;
  backHint?: string;
  backIllus?: string;
  needsBack: boolean;
  guideSummary: string;
  guideNote: string;
  aiChecks: string[];
  extractFields: (name: string) => [string, string][];
}

// ── Toast (simple inline notification) ────────────────────────────────────────
function Toast({ msg, type, onDone }: { msg: string; type: 'error' | 'success'; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div
      className={`fixed top-5 left-1/2 -translate-x-1/2 z-[700] px-5 py-3 rounded-xl shadow-lg text-sm font-semibold text-white transition-all ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}
    >
      {msg}
    </div>
  );
}

// ── DocSideCard — single front/back capture card ───────────────────────────────
interface DocSideCardProps {
  title: string;
  hint: string;
  illus: string;
  dataURL: string | null;
  capturedLabel: string;
  notCapturedLabel: string;
  cameraBtn: string;
  redoBtn: string;
  onCamera: () => void;
  onRedo: () => void;
}
function DocSideCard({ title, hint, illus, dataURL, capturedLabel, notCapturedLabel, cameraBtn, redoBtn, onCamera, onRedo }: DocSideCardProps) {
  const captured = !!dataURL;
  return (
    <div className={`border rounded-xl p-4 mb-3 transition-colors ${captured ? 'border-green-300 bg-green-50/30' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-bold text-gray-800">{title}</div>
        <div className={`text-xs font-bold ${captured ? 'text-green-600' : 'text-gray-400'}`}>
          {captured ? capturedLabel : notCapturedLabel}
        </div>
      </div>
      <div className="text-xs text-gray-500 mb-2 leading-relaxed">{hint}</div>
      {illus && (
        <div className="mb-3 border border-dashed border-blue-200 rounded-lg p-3 text-xs text-gray-500 leading-relaxed whitespace-pre-line bg-blue-50/30">
          {illus}
        </div>
      )}
      {!captured ? (
        <button
          type="button"
          onClick={onCamera}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold rounded-lg hover:bg-blue-100 transition-colors"
        >
          {cameraBtn}
        </button>
      ) : (
        <div>
          <img src={dataURL!} alt={title} className="w-full rounded-lg object-cover max-h-40 mb-2" />
          <button
            type="button"
            onClick={onRedo}
            className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600"
          >
            {redoBtn}
          </button>
        </div>
      )}
    </div>
  );
}

// ── CameraModal ────────────────────────────────────────────────────────────────
interface CameraModalProps {
  guideLabel: string;
  captureBtn: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onCapture: () => void;
  onClose: () => void;
}
function CameraModal({ guideLabel, captureBtn, videoRef, onCapture, onClose }: CameraModalProps) {
  return (
    <div className="fixed inset-0 z-[600] bg-black flex flex-col">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full flex-1 object-cover"
      />
      {/* top bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-end"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,.6), transparent)' }}>
        <button
          onClick={onClose}
          className="w-11 h-11 rounded-full bg-black/50 border border-white/20 text-white text-xl flex items-center justify-center"
        >
          ✕
        </button>
      </div>
      {/* guide frame */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[84%] h-[44%] border-2 border-dashed border-white/50 rounded-2xl pointer-events-none" />
      <div
        className="absolute text-xs font-bold text-white/80 text-center bg-black/45 px-3 py-1 rounded-lg pointer-events-none"
        style={{ top: 'calc(50% - 22% - 28px)', left: '50%', transform: 'translateX(-50%)' }}
      >
        {guideLabel}
      </div>
      {/* bottom bar */}
      <div
        className="absolute bottom-0 left-0 right-0 pb-10 pt-6 flex items-center justify-center"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,.7), transparent)' }}
      >
        <div className="text-center">
          <button
            onClick={onCapture}
            className="w-[70px] h-[70px] rounded-full border-4 border-white/40 flex items-center justify-center"
            style={{ background: 'transparent' }}
          >
            <div className="w-[54px] h-[54px] rounded-full bg-white" />
          </button>
          <div className="text-xs font-bold text-white/85 mt-2.5">{captureBtn}</div>
        </div>
      </div>
    </div>
  );
}

// ── Main VerifyPage ────────────────────────────────────────────────────────────
export default function VerifyPage() {
  const { t, isRTL } = useLang();
  const sess = getSession();
  const saved = getOrder() as Record<string, string | boolean | null>;

  function buildDocConfigs(): Record<DocType, DocConfig> {
    return {
      passport: {
        camLabel: t.vfyPassCamLabel,
        frontTitle: t.vfyPassFrontTitle,
        frontHint: t.vfyPassFrontHint,
        frontIllus: t.vfyPassFrontIllus,
        needsBack: false,
        guideSummary: t.vfyPassSummary,
        guideNote: t.vfyPassGuideNote,
        aiChecks: [t.vfyPassCheck1, t.vfyPassCheck2, t.vfyPassCheck3, t.vfyPassCheck4, t.vfyPassCheck5],
        extractFields: (name) => [
          [t.vfyPassExtName, name || t.vfyExtDetected],
          [t.vfyPassExtNum, 'AB' + Math.floor(1000000 + Math.random() * 9000000)],
          [t.vfyPassExtExpiry, '2029/' + String(Math.floor(1 + Math.random() * 12)).padStart(2, '0') + '/15'],
          [t.vfyPassExtCountry, t.vfyPassExtCountryVal],
        ],
      },
      license: {
        camLabel: t.vfyLicCamLabel,
        frontTitle: t.vfyLicFrontTitle,
        frontHint: t.vfyLicFrontHint,
        frontIllus: t.vfyLicFrontIllus,
        backTitle: t.vfyLicBackTitle,
        backHint: t.vfyLicBackHint,
        backIllus: t.vfyLicBackIllus,
        needsBack: true,
        guideSummary: t.vfyLicSummary,
        guideNote: t.vfyLicGuideNote,
        aiChecks: [t.vfyLicCheck1, t.vfyLicCheck2, t.vfyLicCheck3, t.vfyLicCheck4, t.vfyLicCheck5],
        extractFields: (name) => [
          [t.vfyLicExtName, name || t.vfyExtDetected],
          [t.vfyLicExtNum, String(Math.floor(10000000 + Math.random() * 90000000))],
          [t.vfyLicExtCat, t.vfyLicExtCatVal],
          [t.vfyLicExtExpiry, '2027/' + String(Math.floor(1 + Math.random() * 12)).padStart(2, '0') + '/01'],
        ],
      },
      national_id: {
        camLabel: t.vfyNatCamLabel,
        frontTitle: t.vfyNatFrontTitle,
        frontHint: t.vfyNatFrontHint,
        frontIllus: t.vfyNatFrontIllus,
        backTitle: t.vfyNatBackTitle,
        backHint: t.vfyNatBackHint,
        backIllus: t.vfyNatBackIllus,
        needsBack: true,
        guideSummary: t.vfyNatSummary,
        guideNote: t.vfyNatGuideNote,
        aiChecks: [t.vfyNatCheck1, t.vfyNatCheck2, t.vfyNatCheck3, t.vfyNatCheck4, t.vfyNatCheck5],
        extractFields: (name) => [
          [t.vfyNatExtName, name || t.vfyExtDetected],
          [t.vfyNatExtCode, String(Math.floor(1000000000 + Math.random() * 9000000000))],
          [t.vfyNatExtBirth, '۱۳' + Math.floor(60 + Math.random() * 30) + '/0' + Math.floor(1 + Math.random() * 9) + '/01'],
          [t.vfyNatExtPlace, t.vfyNatExtPlaceVal],
        ],
      },
    };
  }

  // Personal info
  const [firstName, setFirstName] = useState<string>((sess?.firstName || saved.firstName || '') as string);
  const [lastName,  setLastName]  = useState<string>((sess?.lastName  || saved.lastName  || '') as string);
  const [email,     setEmail]     = useState<string>((sess?.email     || saved.email     || '') as string);
  const [phone,     setPhone]     = useState<string>((sess?.phone     || saved.phone     || '') as string);

  const sessLocked = { firstName: !!sess?.firstName, lastName: !!sess?.lastName, email: !!sess?.email };

  // Doc state
  const [docType,    setDocType]    = useState<DocType | null>((saved.docType as DocType) || null);
  const [frontData,  setFrontData]  = useState<string | null>((saved.docFront  as string) || null);
  const [backData,   setBackData]   = useState<string | null>((saved.docBack   as string) || null);
  const [aiIdPassed, setAiIdPassed] = useState<boolean>(!!(saved.aiIdPassed));

  // AI check animation
  const [aiRunning,      setAiRunning]      = useState(false);
  const [aiDone,         setAiDone]         = useState(false);
  const [visibleChecks,  setVisibleChecks]  = useState<number>(0);
  const [extractedRows,  setExtractedRows]  = useState<[string, string][]>([]);
  const aiTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Camera
  const [camOpen,   setCamOpen]   = useState(false);
  const [camSide,   setCamSide]   = useState<'front' | 'back'>('front');
  const videoRef  = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' } | null>(null);

  const showToast = useCallback((msg: string, type: 'error' | 'success' = 'error') => {
    setToast({ msg, type });
  }, []);

  const DOC_CONFIGS = buildDocConfigs();
  const cfg = docType ? DOC_CONFIGS[docType] : null;
  const needsBack = cfg?.needsBack ?? false;

  // Derived
  const frontOk  = !!frontData;
  const backOk   = !needsBack || !!backData;
  const docsReady = !!docType && frontOk && backOk;
  const canSubmit = docsReady && aiIdPassed;

  // Autosave mirrors verify.html autosave()
  const autosave = useCallback((patch: Record<string, unknown> = {}) => {
    saveOrder({
      firstName, lastName, email, phone,
      docType, docFront: frontData, docBack: backData, aiIdPassed,
      ...patch,
    });
  }, [firstName, lastName, email, phone, docType, frontData, backData, aiIdPassed]);

  // Cleanup timers + stream on unmount
  useEffect(() => {
    return () => {
      aiTimers.current.forEach(clearTimeout);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(tk => tk.stop());
      }
    };
  }, []);

  // ── Camera helpers ────────────────────────────────────────────────────────
  const openCamera = useCallback((side: 'front' | 'back') => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast(t.vfyCamUnsupported, 'error');
      return;
    }
    setCamSide(side);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(stream => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCamOpen(true);
      })
      .catch(() => {
        showToast(t.vfyCamDenied, 'error');
      });
  }, [showToast, t]);

  const closeCamera = useCallback(() => {
    setCamOpen(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(tk => tk.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const captureDoc = useCallback(() => {
    const vid = videoRef.current;
    const canvas = canvasRef.current;
    if (!vid || !canvas) return;
    canvas.width  = vid.videoWidth  || 640;
    canvas.height = vid.videoHeight || 480;
    canvas.getContext('2d')?.drawImage(vid, 0, 0);
    const dataURL = canvas.toDataURL('image/jpeg', 0.8);

    if (camSide === 'front') {
      setFrontData(dataURL);
      setAiIdPassed(false);
      setAiRunning(false);
      setAiDone(false);
      setVisibleChecks(0);
      setExtractedRows([]);
      saveOrder({ docFront: dataURL, aiIdPassed: false });
    } else {
      setBackData(dataURL);
      setAiIdPassed(false);
      setAiRunning(false);
      setAiDone(false);
      setVisibleChecks(0);
      setExtractedRows([]);
      saveOrder({ docBack: dataURL, aiIdPassed: false });
    }
    closeCamera();
  }, [camSide, closeCamera]);

  // ── Redo ──────────────────────────────────────────────────────────────────
  const redoFront = useCallback(() => {
    setFrontData(null);
    setAiIdPassed(false);
    setAiRunning(false);
    setAiDone(false);
    setVisibleChecks(0);
    setExtractedRows([]);
    saveOrder({ docFront: null, aiIdPassed: false });
  }, []);

  const redoBack = useCallback(() => {
    setBackData(null);
    setAiIdPassed(false);
    setAiRunning(false);
    setAiDone(false);
    setVisibleChecks(0);
    setExtractedRows([]);
    saveOrder({ docBack: null, aiIdPassed: false });
  }, []);

  // ── AI check (mirrors verify.html startIdAI exactly) ─────────────────────
  const startIdAI = useCallback(() => {
    if (!cfg) return;
    setAiRunning(true);
    setAiDone(false);
    setVisibleChecks(0);
    setExtractedRows([]);
    aiTimers.current.forEach(clearTimeout);
    aiTimers.current = [];

    cfg.aiChecks.forEach((_, i) => {
      const timer = setTimeout(() => {
        setVisibleChecks(prev => Math.max(prev, i + 1));
      }, 900 * (i + 1));
      aiTimers.current.push(timer);
    });

    const totalTime = 900 * cfg.aiChecks.length + 600;
    const timer = setTimeout(() => {
      const fullName = (firstName + ' ' + lastName).trim();
      const rows = cfg.extractFields(fullName);
      setExtractedRows(rows);
      setAiDone(true);
      setAiIdPassed(true);
      saveOrder({ aiIdPassed: true });
    }, totalTime);
    aiTimers.current.push(timer);
  }, [cfg, firstName, lastName]);

  // ── Select doc type ───────────────────────────────────────────────────────
  const selectDocType = useCallback((dt: DocType) => {
    setDocType(dt);
    setFrontData(null);
    setBackData(null);
    setAiIdPassed(false);
    setAiRunning(false);
    setAiDone(false);
    setVisibleChecks(0);
    setExtractedRows([]);
    saveOrder({ docType: dt, docFront: null, docBack: null, aiIdPassed: false });
  }, []);

  // ── Submit (mirrors verify.html submitVerify exactly) ─────────────────────
  const submitVerify = useCallback(() => {
    if (!firstName.trim() || !lastName.trim()) {
      showToast(t.vfyErrName, 'error'); return;
    }
    if (!docType) { showToast(t.vfyErrDocType, 'error'); return; }
    if (!frontData) { showToast(t.vfyErrFront, 'error'); return; }
    if (needsBack && !backData) { showToast(t.vfyErrBack, 'error'); return; }
    if (!aiIdPassed) { showToast(t.vfyErrAi, 'error'); return; }
    autosave();

    // Face-match audit log — mirrors verify.html (raw localStorage key)
    const selfieData = (getOrder() as Record<string, string | null>).selfie ?? null;
    if (!selfieData && frontData) {
      const fmLog: unknown[] = JSON.parse(localStorage.getItem('cp_face_match_log') || '[]');
      fmLog.push({ userId: sess?.userId, docType, result: 'selfie_missing', ts: Date.now() });
      localStorage.setItem('cp_face_match_log', JSON.stringify(fmLog));
    }

    // KYC identity dedup — mirrors verify.html (raw localStorage key)
    if (sess?.userId && frontData) {
      const identKey = (docType || '') + ':' + (firstName.trim() + lastName.trim()).toLowerCase();
      const kycIds: Record<string, string> = JSON.parse(localStorage.getItem('cp_kyc_identities') || '{}');
      const existingOwner = kycIds[identKey];
      if (existingOwner && existingOwner !== sess.userId) {
        showToast(t.vfyErrDupId, 'error');
        return;
      }
      kycIds[identKey] = sess.userId;
      localStorage.setItem('cp_kyc_identities', JSON.stringify(kycIds));
    }

    // Write verification status — mirrors verify.html Store.set('verifications', ...)
    if (sess?.userId) {
      const verifs = Store.get<Record<string, unknown>>('verifications') || {};
      verifs[sess.userId] = { status: 'pending', docType, submittedAt: Date.now() };
      Store.set('verifications', verifs);
    }

    // Navigate — mirrors verify.html: ?return= param or /payment.html
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get('return');
    window.location.href = returnTo || '/payment';
  }, [firstName, lastName, docType, frontData, backData, needsBack, aiIdPassed, autosave, sess, showToast, t]);

  // ── Inline field save on blur ─────────────────────────────────────────────
  const onFieldBlur = useCallback(() => {
    autosave();
  }, [autosave]);

  // ── Step progress (visual only) ───────────────────────────────────────────
  const stepsDone = [
    !!(firstName && lastName && email),
    !!docType,
    frontOk && backOk,
    aiIdPassed,
  ].filter(Boolean).length;
  const progressPct = Math.round((stepsDone / 4) * 100);

  return (
    <div className="min-h-screen bg-white" dir={isRTL ? 'rtl' : 'ltr'}>
      {toast && (
        <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />
      )}

      {/* Camera modal */}
      {camOpen && (
        <CameraModal
          guideLabel={cfg?.camLabel ?? t.vfyCamDefault}
          captureBtn={t.vfyCaptureBtn}
          videoRef={videoRef}
          onCapture={captureDoc}
          onClose={closeCamera}
        />
      )}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="ds-page-header px-4 sm:px-6 lg:px-8">
        <div className="max-w-lg mx-auto relative z-10">
          <div className="flex items-center gap-3 mb-8 flex-wrap">
            <button onClick={() => window.history.back()} className="ds-nav-btn group">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span>{t.vfyBack}</span>
            </button>
            <button onClick={() => { window.location.href = '/'; }} className="ds-nav-btn ds-nav-btn-home">
              <Home className="w-4 h-4" />
              <span>{t.vfyHome}</span>
            </button>
          </div>

          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">{t.vfyTitle}</h1>
          <p className="text-gray-500 text-base">{t.vfySubtitle}</p>

          {/* Progress bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
              <span>{t.vfyProgress}</span>
              <span>{progressPct}٪</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 pb-24 space-y-5">

        {/* ── A) Personal info ── */}
        <div className="ds-card p-5">
          <div className="text-sm font-bold text-gray-800 mb-4">{t.vfyPersonalTitle}</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="ds-label block mb-1">{t.vfyFirstName}</label>
              <input
                type="text"
                className="ds-input w-full"
                placeholder={t.vfyFirstName}
                value={firstName}
                readOnly={sessLocked.firstName}
                style={sessLocked.firstName ? { opacity: .7 } : {}}
                onChange={e => setFirstName(e.target.value)}
                onBlur={onFieldBlur}
              />
            </div>
            <div>
              <label className="ds-label block mb-1">{t.vfyLastName}</label>
              <input
                type="text"
                className="ds-input w-full"
                placeholder={t.vfyLastName}
                value={lastName}
                readOnly={sessLocked.lastName}
                style={sessLocked.lastName ? { opacity: .7 } : {}}
                onChange={e => setLastName(e.target.value)}
                onBlur={onFieldBlur}
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="ds-label block mb-1">{t.vfyEmail}</label>
            <input
              type="email"
              className="ds-input w-full"
              placeholder="example@email.com"
              style={{ direction: 'ltr', ...(sessLocked.email ? { opacity: .7 } : {}) }}
              value={email}
              readOnly={sessLocked.email}
              onChange={e => setEmail(e.target.value)}
              onBlur={onFieldBlur}
            />
          </div>
          <div>
            <label className="ds-label block mb-1">{t.vfyPhone}</label>
            <input
              type="tel"
              className="ds-input w-full"
              placeholder="+98 912..."
              style={{ direction: 'ltr' }}
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onBlur={onFieldBlur}
            />
          </div>
        </div>

        {/* ── B) Document type selector ── */}
        <div>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">{t.vfyDocTypeLabel}</div>
          <div className="grid grid-cols-3 gap-3">
            {([
              { dtype: 'passport'    as DocType, icon: '🛂', label: t.vfyDocPassport  },
              { dtype: 'license'     as DocType, icon: '🚗', label: t.vfyDocLicense   },
              { dtype: 'national_id' as DocType, icon: '🪪', label: t.vfyDocNational  },
            ]).map(({ dtype, icon, label }) => (
              <button
                key={dtype}
                type="button"
                onClick={() => selectDocType(dtype)}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 text-center transition-all ${
                  docType === dtype
                    ? 'border-blue-400 bg-blue-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="text-2xl mb-1.5">{icon}</div>
                <div className="text-xs font-bold text-gray-600">{label}</div>
              </button>
            ))}
          </div>

          {/* Guide panel */}
          {cfg && (
            <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <div className="text-xs font-bold text-blue-600 mb-0.5">{cfg.guideSummary}</div>
              <div className="text-xs text-gray-500">{cfg.guideNote}</div>
            </div>
          )}
        </div>

        {/* ── C) Document capture ── */}
        {docType && cfg && (
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">{t.vfyDocImageLabel}</div>

            <DocSideCard
              title={cfg.frontTitle}
              hint={cfg.frontHint}
              illus={cfg.frontIllus}
              dataURL={frontData}
              capturedLabel={t.vfyCaptured}
              notCapturedLabel={t.vfyNotCaptured}
              cameraBtn={t.vfyCameraBtn}
              redoBtn={t.vfyRedoBtn}
              onCamera={() => openCamera('front')}
              onRedo={redoFront}
            />

            {needsBack && (
              <DocSideCard
                title={cfg.backTitle!}
                hint={cfg.backHint!}
                illus={cfg.backIllus!}
                dataURL={backData}
                capturedLabel={t.vfyCaptured}
                notCapturedLabel={t.vfyNotCaptured}
                cameraBtn={t.vfyCameraBtn}
                redoBtn={t.vfyRedoBtn}
                onCamera={() => openCamera('back')}
                onRedo={redoBack}
              />
            )}
          </div>
        )}

        {/* ── D) AI Document Review ── */}
        {docsReady && (
          <div className="ds-card p-5">
            <div className="text-sm font-bold text-gray-800 mb-4">{t.vfyAiTitle}</div>

            {!aiRunning && !aiDone && (
              <div>
                <button
                  type="button"
                  onClick={startIdAI}
                  className="ds-btn-primary px-6 py-3 text-sm"
                >
                  {t.vfyAiStartBtn}
                </button>
                <div className="text-xs text-gray-400 mt-2">{t.vfyAiAvailHint}</div>
              </div>
            )}

            {(aiRunning || aiDone) && (
              <div>
                {/* Info note */}
                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3 text-xs text-gray-500">
                  {t.vfyAiInfoNote}
                </div>

                {/* Spinner / done indicator */}
                <div className="flex items-center gap-3 mb-4">
                  {!aiDone ? (
                    <div className="w-8 h-8 rounded-full border-[3px] border-blue-100 border-t-blue-500 animate-spin flex-shrink-0" />
                  ) : (
                    <CheckCircle className="w-8 h-8 text-green-500 flex-shrink-0" />
                  )}
                  <span className="text-sm font-semibold text-gray-600">
                    {aiDone ? t.vfyAiDone : t.vfyAiRunning}
                  </span>
                  {aiDone && <StatusBadge status="VERIFIED" />}
                </div>

                {/* AI check items — revealed one by one */}
                <div className="space-y-2 mb-4">
                  {cfg?.aiChecks.map((chk, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg border text-sm transition-all duration-300 ${
                        i < visibleChecks
                          ? 'opacity-100 translate-y-0 border-green-200 bg-green-50'
                          : 'opacity-0 translate-y-2 border-transparent'
                      }`}
                    >
                      <span className="text-base flex-shrink-0">✅</span>
                      <span className="font-semibold text-gray-700">{chk}</span>
                    </div>
                  ))}
                </div>

                {/* Extracted fields */}
                {extractedRows.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                    <div className="text-xs font-bold text-green-700 mb-3">{t.vfyExtractedTitle}</div>
                    <div className="space-y-2">
                      {extractedRows.map(([label, value], i) => (
                        <div key={i} className="flex items-center justify-between text-xs border-b border-green-100 pb-1.5 last:border-0 last:pb-0">
                          <span className="text-gray-500">{label}</span>
                          <span className="font-bold text-gray-800">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Pass banner */}
                {aiDone && (
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 text-center">
                    <div className="text-xl mb-1.5">✅</div>
                    <div className="text-sm font-extrabold text-green-700">{t.vfyAiPassTitle}</div>
                    <div className="text-xs text-gray-500 mt-1">{t.vfyAiPassDesc}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Submit ── */}
        <div className="pt-2">
          <button
            type="button"
            onClick={submitVerify}
            disabled={!canSubmit}
            className="ds-btn-primary w-full py-4 text-base disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t.vfySubmitBtn}
          </button>
          {docsReady && !aiIdPassed && (
            <div className="text-xs text-gray-400 text-center mt-2">{t.vfyNeedAiHint}</div>
          )}
        </div>

      </div>
    </div>
  );
}
