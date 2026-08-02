'use client';

import { useMemo, useState } from 'react';
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import Link from 'next/link';
import Image from 'next/image';
import ConnectWalletButton from '@/components/ConnectWalletButton';
import { runConfidentialGame } from '@/lib/inco/gameEngine';
import { rewardVaultAbi, rewardVaultAddress } from '@/lib/contracts/aptCasino';
import { isContractConfigured } from '@/lib/baseSepolia';

const COPY = {
  roulette: { title: 'Confidential Roulette', intro: 'Pick a bet. Inco seals the winning number until your wager is locked.', accent: 'from-red-500 to-rose-700', image: '/images/games/roulette.png' },
  wheel: { title: 'Confidential Wheel', intro: 'The landing segment is encrypted before the wheel starts moving.', accent: 'from-violet-500 to-fuchsia-700', image: '/images/games/spin_the_wheel.png' },
  plinko: { title: 'Confidential Plinko', intro: 'Inco chooses the hidden path; the board replays the verified bucket.', accent: 'from-cyan-500 to-blue-700', image: '/images/games/plinko.png' },
  mines: { title: 'Confidential Mines', intro: 'Select tiles before the encrypted board is revealed. No browser-generated bombs.', accent: 'from-amber-400 to-orange-700', image: '/images/games/mines.png' },
};

const stageCopy = {
  idle: 'Ready', betting: 'Locking wager on Base', revealing: 'Waiting for Inco covalidators', settling: 'Verifying attestation on-chain', done: 'Settled', error: 'Action needed',
};

export default function ConfidentialGame({ game }) {
  const copy = COPY[game];
  const { address, isConnected } = useAccount();
  const [wager, setWager] = useState('0.0001');
  const [stage, setStage] = useState('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [risk, setRisk] = useState(1);
  const [selection, setSelection] = useState(7);
  const [betType, setBetType] = useState(0);
  const [segments, setSegments] = useState(20);
  const [rows, setRows] = useState(12);
  const [mineCount, setMineCount] = useState(5);
  const [tiles, setTiles] = useState([0, 6, 12]);

  const vaultConfigured = isContractConfigured(rewardVaultAddress);
  const creditsRead = useReadContract({
    address: rewardVaultAddress,
    abi: rewardVaultAbi,
    functionName: 'credits',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address && vaultConfigured), refetchInterval: 15_000 },
  });
  const { writeContract: claim, data: claimHash, isPending: claimPending } = useWriteContract();
  const claimReceipt = useWaitForTransactionReceipt({ hash: claimHash });

  const credits = Number(creditsRead.data ?? 0n);
  const selectedTiles = useMemo(() => new Set(tiles), [tiles]);

  function toggleTile(index) {
    setTiles((current) => current.includes(index) ? current.filter((value) => value !== index) : current.length < 10 ? [...current, index] : current);
  }

  async function play() {
    if (!address) return;
    setError('');
    setResult(null);
    try {
      const wagerWei = parseEther(wager);
      let functionName;
      let args;
      let outcomeEvent;
      if (game === 'roulette') { functionName = 'playRoulette'; args = [betType, selection, wagerWei]; outcomeEvent = 'RouletteOutcome'; }
      if (game === 'wheel') { functionName = 'playWheel'; args = [risk, segments, wagerWei]; outcomeEvent = 'WheelOutcome'; }
      if (game === 'plinko') { functionName = 'playPlinko'; args = [risk, rows, wagerWei]; outcomeEvent = 'PlinkoOutcome'; }
      if (game === 'mines') { functionName = 'playMines'; args = [tiles, mineCount, wagerWei]; outcomeEvent = 'MinesOutcome'; }
      const response = await runConfidentialGame({ account: address, functionName, args, wager: wagerWei, outcomeEvent, onStage: setStage });
      setResult(response);
      creditsRead.refetch();
    } catch (playError) {
      setStage('error');
      setError(playError instanceof Error ? playError.message : 'The round could not be completed.');
    }
  }

  const outcome = result?.outcome;
  const payout = outcome?.payout != null ? formatEther(outcome.payout) : null;

  return (
    <main className="site-game-page min-h-screen bg-gradient-to-b from-sharp-black to-[#150012] px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/game" className="text-sm font-semibold text-white/55 hover:text-white">← All games</Link>
          <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">Inco Lightning · Base Sepolia</span>
        </div>
        <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-red-magic to-blue-magic p-[1px] shadow-2xl shadow-fuchsia-950/30">
          <div className="rounded-3xl bg-[#10000d]">
          <div className={`relative overflow-hidden bg-gradient-to-r ${copy.accent} px-6 py-10 sm:px-10`}>
            <div className="relative z-10 max-w-2xl"><p className="text-xs font-black uppercase tracking-[0.24em] text-white/70">AptCasino · Inco Lightning</p><h1 className="mt-3 font-display text-4xl font-black sm:text-5xl">{copy.title}</h1><p className="mt-3 max-w-xl text-white/80">{copy.intro}</p></div>
            <Image src={copy.image} alt="" fill className="object-cover opacity-20 mix-blend-screen" priority />
          </div>
          <div className="grid gap-8 p-6 lg:grid-cols-[1fr_340px] lg:p-10">
            <div>
              {game === 'roulette' && <div className="grid gap-4 sm:grid-cols-2"><Field label="Bet type"><select value={betType} onChange={(e) => setBetType(Number(e.target.value))} className="game-input"><option value="0">Straight number</option><option value="1">Color (0 red / 1 black)</option><option value="2">Parity (0 even / 1 odd)</option><option value="3">Range (0 low / 1 high)</option><option value="4">Dozen (0–2)</option><option value="5">Column (0–2)</option></select></Field><Field label="Selection"><input className="game-input" type="number" min="0" max={betType === 0 ? 36 : betType >= 4 ? 2 : 1} value={selection} onChange={(e) => setSelection(Number(e.target.value))} /></Field></div>}
              {(game === 'wheel' || game === 'plinko') && <div className="grid gap-4 sm:grid-cols-2"><Field label="Risk"><select className="game-input" value={risk} onChange={(e) => setRisk(Number(e.target.value))}><option value="0">Low</option><option value="1">Medium</option><option value="2">High</option></select></Field>{game === 'wheel' ? <Field label="Segments"><select className="game-input" value={segments} onChange={(e) => setSegments(Number(e.target.value))}>{[10,20,30,40].map((n) => <option key={n}>{n}</option>)}</select></Field> : <Field label="Rows"><input className="game-input" type="range" min="8" max="16" value={rows} onChange={(e) => setRows(Number(e.target.value))} /><span className="text-sm text-white/60">{rows} rows</span></Field>}</div>}
              {game === 'mines' && <><Field label="Mine count"><input className="game-input" type="number" min="1" max="10" value={mineCount} onChange={(e) => setMineCount(Number(e.target.value))} /></Field><div className="mt-5 grid max-w-lg grid-cols-5 gap-2">{Array.from({ length: 25 }, (_, index) => <button key={index} type="button" onClick={() => toggleTile(index)} className={`aspect-square rounded-xl border text-sm font-black transition ${selectedTiles.has(index) ? 'border-amber-300 bg-amber-400 text-black' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>{selectedTiles.has(index) ? '◆' : index + 1}</button>)}</div><p className="mt-3 text-sm text-white/50">Choose 1–10 tiles. The mine map is generated only after the wager is locked.</p></>}
              <div className="mt-6"><Field label="Wager (test ETH)"><input className="game-input" type="number" min="0.000001" max="0.001" step="0.00005" value={wager} onChange={(e) => setWager(e.target.value)} /></Field></div>
              <div className="mt-6">
                {!isConnected ? <ConnectWalletButton /> : <button onClick={play} disabled={['betting','revealing','settling'].includes(stage)} className="rounded-xl bg-white px-7 py-3 font-black text-black transition hover:bg-white/85 disabled:cursor-wait disabled:opacity-50">{stage === 'idle' || stage === 'done' || stage === 'error' ? 'Play confidential round' : stageCopy[stage]}</button>}
              </div>
              {error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">{error}</p>}
              {outcome && <div className="mt-7 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-5"><p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Verified result</p><p className="mt-2 text-2xl font-black">{resultLabel(game, outcome)}</p><p className="mt-1 text-white/65">Payout: {payout} ETH</p><a className="mt-3 inline-block text-xs text-emerald-300 hover:underline" href={`https://sepolia.basescan.org/tx/${result.settleHash}`} target="_blank" rel="noreferrer">View settlement on BaseScan ↗</a></div>}
            </div>
            <aside className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5"><p className="text-xs font-bold uppercase tracking-widest text-white/45">Round status</p><p className="mt-2 font-black">{stageCopy[stage]}</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full bg-gradient-to-r ${copy.accent} transition-all`} style={{ width: `${{idle:0,betting:28,revealing:62,settling:84,done:100,error:100}[stage]}%` }} /></div></div>
              <div className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-400/10 p-5"><p className="text-xs font-bold uppercase tracking-widest text-fuchsia-200">Megapot progress</p><p className="mt-2 text-3xl font-black">{credits} <span className="text-base text-white/50">/ 1000</span></p><p className="mt-2 text-sm leading-6 text-white/60">Every settled round earns credits. Winning rounds earn a bonus. 1,000 credits redeem one real Megapot testnet ticket NFT.</p><button disabled={!vaultConfigured || credits < 1000 || claimPending || claimReceipt.isLoading} onClick={() => claim({ address: rewardVaultAddress, abi: rewardVaultAbi, functionName: 'claimTicket' })} className="mt-4 w-full rounded-xl bg-fuchsia-500 px-4 py-3 text-sm font-black disabled:opacity-40">{claimPending || claimReceipt.isLoading ? 'Claiming…' : 'Claim Megapot ticket'}</button></div>
              <Link href="/docs" className="block rounded-2xl border border-white/10 p-5 text-sm text-white/65 transition hover:bg-white/5 hover:text-white"><strong className="block text-white">How privacy works</strong><span className="mt-1 block">Read the Inco + Megapot architecture →</span></Link>
            </aside>
          </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }) { return <label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-wider text-white/45">{label}</span>{children}</label>; }
function resultLabel(game, outcome) {
  if (game === 'roulette') return `Winning number: ${outcome.winningNumber}`;
  if (game === 'wheel') return `Segment ${Number(outcome.segment) + 1} · ${(Number(outcome.multiplierBps) / 10000).toFixed(2)}×`;
  if (game === 'plinko') return `Bucket ${outcome.bucket} · ${(Number(outcome.multiplierBps) / 10000).toFixed(2)}×`;
  return outcome.hitMine ? 'Mine hit' : `Safe · mines at ${outcome.minePositions.map((n) => Number(n) + 1).join(', ')}`;
}
