'use client';

import { FaBookOpen, FaCheckCircle } from 'react-icons/fa';

const TIPS = [
  { title: 'Low risk, more rows', body: 'More rows plus low risk gives the flattest, most predictable spread of outcomes — good for grinding steady rounds.' },
  { title: 'High risk rewards patience', body: 'High risk concentrates payout at the two edge buckets. Most drops land in the middle and lose — only bet what you can shrug off.' },
  { title: 'Rows change the shape, not the house edge', body: 'Every row/risk combination on AptCasino carries the same 3% house edge baked into the settlement math — rows just change the variance.' },
  { title: 'Every bucket is settled on-chain', body: 'The bucket a ball lands in comes from Inco Lightning’s attested randomness and AptCasino.sol’s payout table — verifiable on BaseScan after every round.' },
];

export default function PlinkoStrategyGuide() {
  return (
    <div className="relative bg-gradient-to-br from-[#1A0015]/95 to-[#0d0008]/90 rounded-xl border border-purple-700/30 p-6 overflow-hidden h-full">
      <div className="absolute top-0 left-0 right-0 h-[5px] bg-gradient-to-r from-pink-500 via-fuchsia-500 to-blue-500" />
      <div className="flex items-center gap-3 mb-5 pt-1">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500/30 to-purple-600/20 border border-purple-500/40 flex items-center justify-center">
          <FaBookOpen className="text-pink-300" size={18} />
        </div>
        <h3 className="text-lg font-semibold bg-gradient-to-r from-white to-pink-300 bg-clip-text text-transparent">Strategy Guide</h3>
      </div>
      <div className="space-y-3 text-sm leading-relaxed">
        {TIPS.map((tip) => (
          <div key={tip.title} className="flex gap-3 p-3 rounded-lg bg-black/20 border border-purple-500/10 hover:border-purple-500/30 transition-colors">
            <FaCheckCircle className="text-pink-400 mt-1 flex-shrink-0" size={14} />
            <div>
              <p className="font-semibold text-white">{tip.title}</p>
              <p className="text-gray-300">{tip.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
