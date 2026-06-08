import { useState } from 'react';

export interface TrackingFormValues {
  senderAddress: string;
  senderCity: string;
  senderCountry: string;
  senderPostal: string;
  receiverAddress: string;
  receiverCity: string;
  receiverCountry: string;
  receiverPostal: string;
}

interface TrackingSearchPanelProps {
  onSubmit: (values: TrackingFormValues) => void;
  loading?: boolean;
  error?: string | null;
}

const INPUT_CLASS =
  'w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/60 focus:bg-white/8 transition-all';

const LABEL_CLASS = 'block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider';

export default function TrackingSearchPanel({ onSubmit, loading, error }: TrackingSearchPanelProps) {
  const [form, setForm] = useState<TrackingFormValues>({
    senderAddress: '',
    senderCity: '',
    senderCountry: '',
    senderPostal: '',
    receiverAddress: '',
    receiverCity: '',
    receiverCountry: '',
    receiverPostal: '',
  });

  const set = (key: keyof TrackingFormValues) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.senderCity || !form.senderCountry || !form.receiverCity || !form.receiverCountry) return;
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Sender */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-400/30" />
          <span className="text-sm font-bold text-white">فرستنده</span>
          <span className="text-xs text-gray-500">(Sender)</span>
        </div>
        <div className="space-y-3">
          <div>
            <label className={LABEL_CLASS}>آدرس / Address</label>
            <input
              className={INPUT_CLASS}
              placeholder="123 Main Street"
              value={form.senderAddress}
              onChange={set('senderAddress')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>شهر / City *</label>
              <input
                className={INPUT_CLASS}
                placeholder="Toronto"
                value={form.senderCity}
                onChange={set('senderCity')}
                required
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>کد پستی / Postal</label>
              <input
                className={INPUT_CLASS}
                placeholder="M5V 1A1"
                value={form.senderPostal}
                onChange={set('senderPostal')}
              />
            </div>
          </div>
          <div>
            <label className={LABEL_CLASS}>کشور / Country *</label>
            <input
              className={INPUT_CLASS}
              placeholder="Canada"
              value={form.senderCountry}
              onChange={set('senderCountry')}
              required
            />
          </div>
        </div>
      </div>

      {/* Arrow divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-cyan-500/10 border border-cyan-500/20">
          <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* Receiver */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 ring-2 ring-cyan-400/30" />
          <span className="text-sm font-bold text-white">گیرنده</span>
          <span className="text-xs text-gray-500">(Receiver)</span>
        </div>
        <div className="space-y-3">
          <div>
            <label className={LABEL_CLASS}>آدرس / Address</label>
            <input
              className={INPUT_CLASS}
              placeholder="خیابان ولیعصر، تهران"
              value={form.receiverAddress}
              onChange={set('receiverAddress')}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>شهر / City *</label>
              <input
                className={INPUT_CLASS}
                placeholder="Tehran"
                value={form.receiverCity}
                onChange={set('receiverCity')}
                required
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>کد پستی / Postal</label>
              <input
                className={INPUT_CLASS}
                placeholder="1234567890"
                value={form.receiverPostal}
                onChange={set('receiverPostal')}
              />
            </div>
          </div>
          <div>
            <label className={LABEL_CLASS}>کشور / Country *</label>
            <input
              className={INPUT_CLASS}
              placeholder="Iran"
              value={form.receiverCountry}
              onChange={set('receiverCountry')}
              required
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !form.senderCity || !form.senderCountry || !form.receiverCity || !form.receiverCountry}
        className="w-full py-4 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/35"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            در حال محاسبه مسیر...
          </span>
        ) : (
          'ایجاد مسیر و کد رهگیری'
        )}
      </button>
    </form>
  );
}
