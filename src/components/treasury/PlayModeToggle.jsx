'use client';

/**
 * Explicit segmented control for the two ways to play — replaces a subtle text link
 * that was easy to miss. Both modes are real and independently verified working.
 */
export default function PlayModeToggle({ mode, setMode, disabled }) {
  return (
    <div className="flex overflow-hidden rounded-xl border border-white/10">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setMode('treasury')}
        className={`flex-1 px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${mode === 'treasury' ? 'bg-gradient-to-r from-red-magic to-blue-magic text-white' : 'bg-white/[0.03] text-white/50 hover:text-white'}`}
      >
        <span className="block text-xs font-bold">⚡ House balance</span>
        <span className="block text-[10px] font-medium opacity-80">Instant · no signature, no gas</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setMode('wallet')}
        className={`flex-1 px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${mode === 'wallet' ? 'bg-gradient-to-r from-red-magic to-blue-magic text-white' : 'bg-white/[0.03] text-white/50 hover:text-white'}`}
      >
        <span className="block text-xs font-bold">🔑 Your wallet</span>
        <span className="block text-[10px] font-medium opacity-80">You sign + pay gas · slower</span>
      </button>
    </div>
  );
}
