# AptCasino

AptCasino is a Base Sepolia testnet casino built around two protocols:

- **Inco Lightning** creates sealed game randomness and covalidator-attested settlement.
- **Megapot** turns verified gameplay into quick-pick ticket NFTs.

The name AptCasino is a standalone brand. The project has no Aptos, Solana, multichain switcher, referral program, OTC lottery, staking product, or token sale.

## Games

- Roulette — confidential number, color, parity, range, dozen, and column bets.
- Wheel — confidential landing segment with low, medium, and high risk tables.
- Plinko — confidential left/right path, replayed as a verified bucket.
- Mines — player-selected tiles against a board shuffled from the sealed seed.

Each round uses two Base Sepolia transactions:

```text
play*(parameters) + wager + Inco fee
  -> encrypted seed handle
  -> Inco attested reveal
settle(gameId, attestation, signatures)
  -> verified result + payout + Megapot credits
```

## Local development

```bash
npm install
npm run dev
```

Copy the variables from `.env.example` into `.env.local`. Until contracts are deployed, the UI runs in an explicit unconfigured state and does not fake game results.

## Contracts

```bash
npm --prefix contracts install
npm run contracts:compile
```

Deployment requires a funded Base Sepolia private key:

```bash
copy contracts\.env.example contracts\.env
npm run contracts:deploy:testnet
```

The deployer needs test ETH for gas, Inco execution fees, and the casino bankroll. `MegapotRewardVault` separately needs Base Sepolia test USDC before ticket claims can succeed.

## Megapot Base Sepolia

| Contract | Address |
| --- | --- |
| AptCasino | `0xD75b282f87a00856FBF4Aa06bf65833d4AB4b5D7` |
| MegapotRewardVault | `0xccec75B83b3Ee3FBAED9a65Da59DBfd585F82943` |
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Jackpot | `0x465dA3c859f193A3807386387bEE941B2A4c3279` |
| Random Ticket Buyer | `0x53c04e7e5044B28Ea8A4F9c4b26E3Ac1aeb63746` |

Ticket purchases deliberately pass empty referrer and referral-split arrays.

The deployed integration has been smoke-tested with an attested Roulette, Wheel,
Plinko and Mines settlement plus a real Megapot Base Sepolia ticket NFT claim.

## Documentation

The GitBook-style documentation is served from `/docs` and includes Mermaid plus standalone SVG diagrams for Inco settlement, Megapot progression, architecture, and deployment.

- Inco games: https://docs.inco.org/games/overview
- Megapot protocol: https://docs.megapot.io/developers/contract-overview
