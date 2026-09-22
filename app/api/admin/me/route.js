export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAuthorizedAdmin } from '../../../../lib/adminAuth';

export async function GET() {
  const admin = await getAuthorizedAdmin();
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ admin });
}
