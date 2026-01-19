/**
 * Admin Content API - Courses
 *
 * CRUD operations for courses in the native schema.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/admin/content/courses
 * List all courses
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: courses, error } = await supabaseAdmin
      .from('courses')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      courses: courses.map((c) => ({
        id: c.id,
        title: c.title,
        slug: c.slug,
        description: c.description,
        thumbnailUrl: c.thumbnail_url,
        isPublished: c.is_published,
        isGated: c.is_gated,
        sortOrder: c.sort_order,
        version: c.version,
        complianceRequired: c.compliance_required,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching courses:', error);
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 });
  }
}

/**
 * POST /api/admin/content/courses
 * Create a new course
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId || !session.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, slug, description, isPublished, isGated, complianceRequired, thumbnailUrl } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Get max sort order
    const { data: maxOrder } = await supabaseAdmin
      .from('courses')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();

    const sortOrder = (maxOrder?.sort_order || 0) + 1;

    const { data: course, error } = await supabaseAdmin
      .from('courses')
      .insert({
        title,
        slug: slug || title.toLowerCase().replace(/\s+/g, '-'),
        description: description || null,
        thumbnail_url: thumbnailUrl || null,
        is_published: isPublished ?? false,
        is_gated: isGated ?? false,
        compliance_required: complianceRequired ?? false,
        sort_order: sortOrder,
        version: '1.0',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        isPublished: course.is_published,
        isGated: course.is_gated,
        sortOrder: course.sort_order,
        complianceRequired: course.compliance_required,
        createdAt: course.created_at,
      },
    });
  } catch (error) {
    console.error('Error creating course:', error);
    return NextResponse.json({ error: 'Failed to create course' }, { status: 500 });
  }
}
