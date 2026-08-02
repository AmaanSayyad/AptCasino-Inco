import Image from 'next/image';
import MermaidDiagram from '@/components/docs/MermaidDiagram';
import { Code, DocPage, H2, Note, P } from '@/components/docs/DocPage';

const sequence = `sequenceDiagram
  actor Player
  participant UI as AptCasino UI
  participant Game as AptCasino.sol
  participant Inco as Inco Lightning
  Player->>UI: Choose wager and parameters
  UI->>Game: play*(params) + wager + fee
  Game->>Inco: e.rand()
  Inco-->>Game: encrypted seed handle
  Game->>Inco: e.reveal(handle)
  UI->>Inco: attestedReveal(handle)
  Inco-->>UI: plaintext + covalidator signatures
  UI->>Game: settle(gameId, attestation, signatures)
  Game->>Game: verify handle + signatures
  Game-->>Player: payout + reward credits`;

export default function IncoDocs() {
  return (
    <DocPage eyebrow="Inco Lightning" title="Privacy inside every round" lead="The random outcome is not generated in React, a browser physics engine or an AptCasino backend. It begins as a sealed Inco handle on Base Sepolia.">
      <MermaidDiagram title="Two-transaction confidential round" chart={sequence} />
      <Image src="/docs/inco-confidential-round.svg" width={1200} height={640} alt="Inco confidential round lifecycle" className="my-7 h-auto w-full rounded-2xl border border-white/10" />
      <H2>The three required operations</H2>
      <P><Code>e.rand()</Code> creates the encrypted seed and charges the current Inco executor fee. <Code>e.allowThis(seed)</Code> preserves contract access. <Code>e.reveal(seed)</Code> requests a public, attested reveal for later settlement.</P>
      <H2>Settlement checks</H2>
      <P>The contract first checks that the attestation handle exactly matches the handle stored for that game. It then verifies the covalidator signatures through the Inco verifier. Only after those checks does it release liability, calculate the outcome and transfer a payout.</P>
      <Note>A valid attestation for a different encrypted handle must never be accepted. Handle binding and signature verification are separate mandatory checks.</Note>
      <H2>Game mapping</H2>
      <P><strong>Roulette</strong> maps the seed to 0–36. <strong>Wheel</strong> maps it to the configured segment count. <strong>Plinko</strong> derives left/right decisions from seed bits. <strong>Mines</strong> uses a deterministic Fisher–Yates shuffle to place unique mines after the player’s tile selection is locked.</P>
      <H2>Liveness</H2>
      <P>If covalidator settlement does not complete within twenty minutes, the stored wager can be refunded with <Code>expireGame(gameId)</Code>. Reserved maximum payouts cannot be withdrawn while rounds are active.</P>
    </DocPage>
  );
}
