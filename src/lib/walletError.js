/** Turns a viem/wagmi wallet error into a short, user-facing message instead of the raw RPC dump. */
export function friendlyWalletError(error, fallback = 'Something went wrong.') {
  if (!error) return fallback;
  const text = `${error.shortMessage || ''} ${error.message || ''}`.toLowerCase();
  if (text.includes('user rejected') || text.includes('user denied')) {
    return 'You cancelled the transaction in your wallet.';
  }
  if (error.shortMessage) return error.shortMessage;
  if (error instanceof Error) return error.message.split('\n')[0];
  return fallback;
}
