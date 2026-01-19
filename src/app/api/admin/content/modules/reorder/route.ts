/**
 * Admin Content API - Reorder Modules
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * POST /api/admin/content/modules/reorder
 * Update sort order for modules
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { courseId, moduleIds } = body;

    if (!courseId || !moduleIds || !Array.isArray(moduleIds)) {
      return NextResponse.json({ error: 'courseId and moduleIds array are required' }, { status: 400 });
    }

    // Update sort order for each module
    const updates = moduleIds.map((id: string, index: number) =>
      supabaseAdmin
        .from('course_modules')
        .update({ sort_order: index + 1 })
        .eq('id', id)
        .eq('course_id', courseId)
    );

    await Promise.all(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error reordering modules:', error);
    return NextResponse.json({ error: 'Failed to reorder modules' }, { status: 500 });
  }
}
