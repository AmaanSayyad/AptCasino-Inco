import MermaidDiagram from '@/components/docs/MermaidDiagram';
import { Code, DocPage, H2, Note, P } from '@/components/docs/DocPage';

const loop = `stateDiagram-v2
  [*] --> Play
  Play --> Settled: Inco attestation valid
  Settled --> Credits: volume + win bonus
  Credits --> Credits: fewer than 1,000
  Credits --> Claim: 1,000 or more
  Claim --> TicketNFT: Reward vault buys quick-pick
  TicketNFT --> Drawing: Megapot lifecycle
  Drawing --> Play: continue progression`;

export default function MegapotDocs() { return <DocPage eyebrow="Megapot" title="Jackpot tickets earned through play" lead="Megapot is not a link in the navbar. Its ticket NFT is the reward object at the end of the verified game loop."><MermaidDiagram title="Ticket progression state" chart={loop} /><H2>Credit policy</H2><P>Every settled round receives a base amount derived from wager size, capped per round. A payout greater than the wager adds a win bonus. Demo play and failed settlements produce no credits.</P><H2>Claim transaction</H2><P>At 1,000 credits the player calls <Code>claimTicket()</Code>. The reward vault reads the live Megapot ticket price, spends its Base Sepolia USDC and calls <Code>JackpotRandomTicketBuyer.buyTickets(1, player, [], [], SOURCE)</Code>.</P><Note>Both referral arrays are deliberately empty. AptCasino does not collect Megapot purchase referral fees or a share of player winnings.</Note><H2>Failure isolation</H2><P>The Megapot vault is separate from the ETH casino bankroll. A paused drawing, missing test USDC or a Megapot revert cannot undo a completed casino payout. Credits remain visible and claimable when the vault is funded again.</P><H2>Ownership</H2><P>The Megapot ticket is minted to the player’s connected Base wallet, not held by AptCasino. Winning claims therefore remain under the player’s wallet control.</P></DocPage>; }
