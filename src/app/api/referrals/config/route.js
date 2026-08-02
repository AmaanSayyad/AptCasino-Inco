import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// No on-chain referral reward mechanism exists yet for the Base Sepolia product;
// this returns the program's display copy only.
export async function GET() {
  return NextResponse.json({
    programActive: true,
    chain: 'base-sepolia',
    description: 'Share your link. Referral rewards are tracked here and paid out manually while the on-chain reward path is built.',
  });
}
