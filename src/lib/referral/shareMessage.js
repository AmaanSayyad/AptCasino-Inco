/**
 * Referral broadcast copy — X, Telegram, WhatsApp, clipboard.
 */

export function getReferralBroadcastBody() {
  return [
    'Found a confidential casino on Base — @aptcasinofun.',
    '',
    'Roulette/mines/plinko/wheel where Inco Lightning seals the outcome until your wager is locked — the house never sees the winning number before you do.',
    '',
    'Every settled round also earns Megapot credits toward a real ticket NFT.',
    '',
    'Sharing my referral link, ape in ↓',
  ].join('\n');
}

/** Full paste-ready message with link once at the bottom. */
export function getReferralBroadcastMessage(link) {
  if (!link) return getReferralBroadcastBody();
  return `${getReferralBroadcastBody()}\n${link}`;
}

/** LinkedIn post body (paste after share opens — preview comes from /r/CODE OG tags). */
export function getReferralLinkedInPost(link) {
  if (!link) return getReferralBroadcastBody();
  return `${getReferralBroadcastBody()}\n\n${link}`;
}

export function getReferralTweetText() {
  return [
    'Found a confidential casino on Base — @aptcasinofun.',
    '',
    'Roulette/mines/plinko/wheel where Inco Lightning seals the outcome until your wager is locked.',
    '',
    'Every settled round earns Megapot credits toward a real ticket NFT.',
    '',
    'gg: open the link, connect a wallet, play with test USDC on Base Sepolia.',
  ].join('\n');
}
