import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import dbConnect from '@/lib/mongodb';
import { AdminUser } from '@/models/AdminUser';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret');

async function isMaster(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_session')?.value;
  if (!token) return false;
  
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload.user === (process.env.ADMIN_ID || 'yogico');
  } catch {
    return false;
  }
}

// DELETE: 서브 계정 삭제 (마스터만 가능)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  if (!(await isMaster(req))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const { username } = await params;
    const masterId = process.env.ADMIN_ID || 'yogico';
    
    if (username === masterId) {
      return NextResponse.json({ success: false, error: 'Cannot delete the master account' }, { status: 400 });
    }

    await dbConnect();
    const result = await AdminUser.deleteOne({ username });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
