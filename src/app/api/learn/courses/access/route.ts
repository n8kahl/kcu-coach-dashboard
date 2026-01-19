import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth';

// GET - Check user's access to a course or lesson
export async function GET(request: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser();

    if (!sessionUser?.discordId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: user } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('discord_id', sessionUser.discordId)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const moduleId = searchParams.get('moduleId');
    const lessonId = searchParams.get('lessonId');

    // Check course access
    if (courseId) {
      const { data: access } = await supabaseAdmin
        .from('user_course_access')
        .select('*')
        .eq('user_id', user.id)
        .eq('course_id', courseId)
        .single();

      if (!access) {
        // Check if course is gated
        const { data: course } = await supabaseAdmin
          .from('courses')
          .select('is_gated, is_published')
          .eq('id', courseId)
          .single();

        if (!course?.is_published) {
          return NextResponse.json({ hasAccess: false, reason: 'Course not published' });
        }

        if (course?.is_gated) {
          return NextResponse.json({ hasAccess: false, reason: 'Enrollment required' });
        }

        return NextResponse.json({ hasAccess: true, accessType: 'public' });
      }

      // Check if access is expired
      if (access.expires_at && new Date(access.expires_at) < new Date()) {
        return NextResponse.json({
          hasAccess: false,
          reason: 'Access expired',
          expiredAt: access.expires_at,
        });
      }

      return NextResponse.json({
        hasAccess: true,
        accessType: access.access_type,
        enrolledAt: access.enrolled_at,
        expiresAt: access.expires_at,
        complianceStatus: access.compliance_status,
        completionDeadline: access.completion_deadline,
      });
    }

    // Check module access
    if (moduleId) {
      const { data: canAccess } = await supabaseAdmin.rpc('can_access_module', {
        p_user_id: user.id,
        p_module_id: moduleId,
      });

      if (!canAccess) {
        // Get unlock reason
        const { data: module } = await supabaseAdmin
          .from('course_modules')
          .select('*, unlock_module:course_modules!unlock_after_module_id(title)')
          .eq('id', moduleId)
          .single();

        let reason = 'Module locked';
        if (module?.unlock_after_module_id) {
          const unlockModule = module.unlock_module as { title: string } | null;
          reason = `Complete "${unlockModule?.title || 'previous module'}" first`;
          if (module.requires_quiz_pass) {
            reason += ` and pass the quiz with ${module.min_quiz_score}%`;
          }
        } else if (module?.unlock_after_days) {
          reason = `Unlocks ${module.unlock_after_days} days after enrollment`;
        }

        return NextResponse.json({ hasAccess: false, reason });
      }

      return NextResponse.json({ hasAccess: true });
    }

    // Check lesson access
    if (lessonId) {
      const { data: lesson } = await supabaseAdmin
        .from('course_lessons')
        .select(`
          is_preview,
          is_published,
          module:course_modules(
            id,
            course_id
          )
        `)
        .eq('id', lessonId)
        .single();

      if (!lesson) {
        return NextResponse.json({ hasAccess: false, reason: 'Lesson not found' });
      }

      if (!lesson.is_published) {
        return NextResponse.json({ hasAccess: false, reason: 'Lesson not published' });
      }

      // Preview lessons are always accessible
      if (lesson.is_preview) {
        return NextResponse.json({ hasAccess: true, accessType: 'preview' });
      }

      // Check module access
      const moduleData = lesson.module as unknown as { id: string; course_id: string }[] | { id: string; course_id: string };
      const module = Array.isArray(moduleData) ? moduleData[0] : moduleData;
      const { data: canAccess } = await supabaseAdmin.rpc('can_access_module', {
        p_user_id: user.id,
        p_module_id: module.id,
      });

      if (!canAccess) {
        return NextResponse.json({ hasAccess: false, reason: 'Module locked' });
      }

      return NextResponse.json({ hasAccess: true });
    }

    return NextResponse.json({ error: 'courseId, moduleId, or lessonId required' }, { status: 400 });
  } catch (error) {
    console.error('Error checking access:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Grant or revoke course access (admin only)
export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser();

    if (!sessionUser?.discordId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if admin
    const { data: currentUser } = await supabaseAdmin
      .from('user_profiles')
      .select(`
        id,
        user_role_assignments(
          user_roles(name)
        )
      `)
      .eq('discord_id', sessionUser.discordId)
      .single();

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userRoles = (currentUser.user_role_assignments as unknown as Array<{ user_roles: { name: string }[] }>)
      ?.flatMap(ura => ura.user_roles?.map(r => r.name) || []) || [];
    const isAdmin = userRoles.some(role => ['admin', 'super_admin'].includes(role));

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      action, // 'grant' or 'revoke'
      userId,
      courseId,
      accessType = 'full',
      expiresAt,
      completionDeadline,
    } = body;

    if (!action || !userId || !courseId) {
      return NextResponse.json(
        { error: 'action, userId, and courseId are required' },
        { status: 400 }
      );
    }

    if (action === 'grant') {
      const { data, error } = await supabaseAdmin
        .from('user_course_access')
        .upsert({
          user_id: userId,
          course_id: courseId,
          access_type: accessType,
          granted_at: new Date().toISOString(),
          granted_by: currentUser.id,
          expires_at: expiresAt || null,
          enrolled_at: new Date().toISOString(),
          completion_deadline: completionDeadline || null,
          compliance_status: 'not_started',
        }, { onConflict: 'user_id,course_id' })
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ success: true, access: data });
    }

    if (action === 'revoke') {
      const { error } = await supabaseAdmin
        .from('user_course_access')
        .update({ access_type: 'expired' })
        .eq('user_id', userId)
        .eq('course_id', courseId);

      if (error) throw error;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error managing access:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Bulk grant access (admin only)
export async function PUT(request: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser();

    if (!sessionUser?.discordId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if admin
    const { data: currentUser } = await supabaseAdmin
      .from('user_profiles')
      .select(`
        id,
        user_role_assignments(
          user_roles(name)
        )
      `)
      .eq('discord_id', sessionUser.discordId)
      .single();

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userRoles = (currentUser.user_role_assignments as unknown as Array<{ user_roles: { name: string }[] }>)
      ?.flatMap(ura => ura.user_roles?.map(r => r.name) || []) || [];
    const isAdmin = userRoles.some(role => ['admin', 'super_admin'].includes(role));

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      userIds,
      courseId,
      accessType = 'full',
      expiresAt,
      completionDeadline,
    } = body;

    if (!userIds || !Array.isArray(userIds) || !courseId) {
      return NextResponse.json(
        { error: 'userIds array and courseId are required' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const accessRecords = userIds.map(userId => ({
      user_id: userId,
      course_id: courseId,
      access_type: accessType,
      granted_at: now,
      granted_by: currentUser.id,
      expires_at: expiresAt || null,
      enrolled_at: now,
      completion_deadline: completionDeadline || null,
      compliance_status: 'not_started',
    }));

    const { data, error } = await supabaseAdmin
      .from('user_course_access')
      .upsert(accessRecords, { onConflict: 'user_id,course_id' })
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      granted: data?.length || 0,
    });
  } catch (error) {
    console.error('Error bulk granting access:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
