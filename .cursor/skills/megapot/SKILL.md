---
name: megapot
description: >
  Megapot on-chain lottery on Base (USDC tickets as NFTs). Use when buying tickets,
  claiming winnings/referrals, LP, subscriptions, reading jackpot state, or wiring
  AptCasino MegapotRewardVault → JackpotRandomTicketBuyer. Prefer live ABIs from
  llms.megapot.io. TRIGGER: Megapot, JackpotRandomTicketBuyer, jackpot tickets,
  lottery NFT, referralFee, buyTickets on Base.
---

# Megapot Integration

Canonical entry: https://llms.megapot.io/
Protocol reference: https://docs.megapot.io/build-on-megapot/build/protocol-reference
Addresses/ABIs: https://llms.megapot.io/contracts/reference · https://llms.megapot.io/abi/

## AptCasino context

This repo awards gameplay credits then redeems via `MegapotRewardVault` calling Sepolia:

- Live website: https://aptcasino-inco-gamma.vercel.app/
- GitHub: https://github.com/AmaanSayyad/AptCasino-Inco
- Deck: https://www.figma.com/deck/vcXvmRFqhTN5Sj85ZrYf1i/AptCasino-Inco-x-Megapot
- Contact: amaansayyad2001@gmail.com
- `MegapotRewardVault` (deployed): `0x7Ec9088C4A9Bf88dC38FEdb649FD7303E5391ea9`
- `JackpotRandomTicketBuyer` = `0x53c04e7e5044B28Ea8A4F9c4b26E3Ac1aeb63746`

Mainnet RandomTicketBuyer (when promoting): `0xb9560b43b91dE2c1DaF5dfbb76b2CFcDaFc13aBd`

Credits accrue on settle (`AptCasino._award` / treasury ledger mirror). At 1000 credits, UI claims via `claimTicket` (wallet) or `claimTicketFor` (treasury operator).

## Rules

1. Fetch ABIs from `https://llms.megapot.io/abi/<Name>.json` — do not rely on stale copied ABIs.
2. Always include operator `_referrers` / `_referralSplit` on ticket buys for integrator revenue.
3. Approve USDC to the contract you call (`Jackpot` vs `JackpotRandomTicketBuyer` vs batch facilitator).
4. For quick-pick 1–10 tickets: `JackpotRandomTicketBuyer.buyTickets`. For custom picks: `Jackpot.buyTickets`. For 11+: batch facilitator.
5. Live drawing UI → RPC `getDrawingState`. History/tickets/wins → `https://api.megapot.io/v1` (see https://llms.megapot.io/data-api).

## Task skills

| Intent | URL |
|---|---|
| Random tickets | https://llms.megapot.io/tasks/buy-random |
| Custom tickets | https://llms.megapot.io/tasks/buy-tickets |
| Bulk 11+ | https://llms.megapot.io/tasks/buy-bulk |
| Subscribe | https://llms.megapot.io/tasks/subscribe |
| Claim winnings | https://llms.megapot.io/tasks/claim-winnings |
| Claim referral fees | https://llms.megapot.io/tasks/claim-referral-fees |
| Read state | https://llms.megapot.io/tasks/read-state |
| React setup | https://llms.megapot.io/tasks/react-setup |
| Starter kit | https://llms.megapot.io/starter-kit |
