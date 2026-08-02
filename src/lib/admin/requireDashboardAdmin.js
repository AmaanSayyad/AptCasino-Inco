import { NextResponse } from 'next/server';

export function getDashboardAdminToken(request) {
  return (
    request.headers.get('x-admin-token') ||
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    ''
  ).trim();
}

/** Returns a 401/503 NextResponse to short-circuit the handler, or null if authorized. */
export function requireDashboardAdmin(request) {
  const expected = process.env.DASHBOARD_ADMIN_TOKEN?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: 'Set DASHBOARD_ADMIN_TOKEN in server env to use admin APIs.' },
      { status: 503 },
    );
  }
  const provided = getDashboardAdminToken(request);
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
