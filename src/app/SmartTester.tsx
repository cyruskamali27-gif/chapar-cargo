import { useState } from 'react';
import { CheckCircle, XCircle, PlayCircle, ChevronDown, ChevronRight } from 'lucide-react';

// TODO: Update test cases for new SecurityLevel model (Phase 15)

interface TestCase {
  name: string;
  run: () => boolean;
}

interface TestGroup {
  label: string;
  cases: TestCase[];
}

function runTest(tc: TestCase): { name: string; pass: boolean; error?: string } {
  try {
    const pass = tc.run();
    return { name: tc.name, pass };
  } catch (e) {
    return { name: tc.name, pass: false, error: String(e) };
  }
}

const TEST_GROUPS: TestGroup[] = [
  // TODO: defaultSecurityLevel() tests
  // TODO: SecuritySelector options tests
  // TODO: Demo tracking routes tests
  // TODO: Business logic edge cases
];

// ─── SmartTester UI ───────────────────────────────────────────────────────────
export default function SmartTester({ onClose }: { onClose: () => void }) {
  const [results, setResults] = useState<ReturnType<typeof runTest>[][]>([]);
  const [ran, setRan] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<number, boolean>>({});

  const runAll = () => {
    const res = TEST_GROUPS.map(g => g.cases.map(runTest));
    setResults(res);
    setRan(true);
    const allOpen: Record<number, boolean> = {};
    res.forEach((g, i) => { if (g.some(r => !r.pass)) allOpen[i] = true; });
    setOpenGroups(allOpen);
  };

  const totalTests  = TEST_GROUPS.reduce((s, g) => s + g.cases.length, 0);
  const totalPassed = results.flat().filter(r => r.pass).length;
  const totalFailed = results.flat().filter(r => !r.pass).length;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600 to-blue-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-white font-bold text-lg">Smart Chapar Tester</h2>
            <p className="text-cyan-100 text-xs mt-0.5">{totalTests} test cases across {TEST_GROUPS.length} groups</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center text-white hover:bg-white/30 transition-colors">✕</button>
        </div>

        {/* Run button + summary */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-4 flex-shrink-0 bg-slate-50">
          <button
            onClick={runAll}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
          >
            <PlayCircle className="w-4 h-4" />
            اجرای تمام تست‌ها
          </button>
          {ran && (
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-green-600 font-semibold">
                <CheckCircle className="w-4 h-4" /> {totalPassed} PASS
              </span>
              {totalFailed > 0 && (
                <span className="flex items-center gap-1.5 text-red-500 font-semibold">
                  <XCircle className="w-4 h-4" /> {totalFailed} FAIL
                </span>
              )}
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                totalFailed === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
              }`}>
                {totalFailed === 0 ? '✓ 100% PASS' : `${Math.round(totalPassed / totalTests * 100)}%`}
              </span>
            </div>
          )}
        </div>

        {/* Test groups */}
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {TEST_GROUPS.map((group, gi) => {
            const groupResults = results[gi] ?? [];
            const groupPassed  = groupResults.filter(r => r.pass).length;
            const groupFailed  = groupResults.filter(r => !r.pass).length;
            const isOpen       = openGroups[gi] ?? false;

            return (
              <div key={gi} className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenGroups(o => ({ ...o, [gi]: !o[gi] }))}
                  className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-start"
                >
                  <div className="flex items-center gap-2">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                    <span className="text-sm font-mono font-semibold text-gray-800">{group.label}</span>
                  </div>
                  {ran && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-600 font-semibold">{groupPassed}✓</span>
                      {groupFailed > 0 && <span className="text-xs text-red-500 font-semibold">{groupFailed}✗</span>}
                      <span className={`w-2 h-2 rounded-full ${groupFailed === 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                    </div>
                  )}
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 px-4 py-3 space-y-1.5 bg-slate-50">
                    {group.cases.map((tc, ci) => {
                      const res = groupResults[ci];
                      return (
                        <div key={ci} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                          !res      ? 'bg-white border border-gray-200' :
                          res.pass  ? 'bg-green-50 border border-green-100' :
                                      'bg-red-50 border border-red-100'
                        }`}>
                          <span className={`font-mono text-xs ${
                            !res      ? 'text-gray-500' :
                            res.pass  ? 'text-green-700' :
                                        'text-red-600'
                          }`}>{tc.name}</span>
                          {res && (
                            res.pass
                              ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                              : <XCircle    className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {!ran && (
            <div className="text-center py-12 text-gray-400">
              <PlayCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                {TEST_GROUPS.length === 0
                  ? 'تست‌های جدید به‌زودی اضافه می‌شوند (TODO)'
                  : 'برای اجرای تست‌ها روی دکمه کلیک کنید'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
