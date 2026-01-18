import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

// GET - Fetch all roles
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: roles, error } = await supabaseAdmin
      .from('user_roles')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching roles:', error);
      return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
    }

    return NextResponse.json({ roles });
  } catch (error) {
    console.error('Error in roles GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create a new role
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, description, permissions } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Role name required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('user_roles')
      .insert({
        name,
        description: description || '',
        permissions: permissions || {}
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating role:', error);
      return NextResponse.json({ error: 'Failed to create role' }, { status: 500 });
    }

    return NextResponse.json({ success: true, role: data });
  } catch (error) {
    console.error('Error in roles POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update a role
export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id, name, description, permissions } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Role ID required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('user_roles')
      .update({
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(permissions && { permissions })
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating role:', error);
      return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
    }

    return NextResponse.json({ success: true, role: data });
  } catch (error) {
    console.error('Error in roles PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
