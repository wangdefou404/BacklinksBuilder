import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const GET: APIRoute = async () => {
  try {
    // 1. 查看所有用户及其角色
    const { data: usersWithRoles, error: usersError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        user_roles!inner(
          role,
          is_active,
          granted_at
        )
      `);

    if (usersError) {
      console.error('Users query error:', usersError);
    }

    // 2. 测试get_user_role函数
    const { data: allUsers, error: allUsersError } = await supabase
      .from('users')
      .select('id, email');

    if (allUsersError) {
      console.error('All users query error:', allUsersError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to get users',
          details: allUsersError.message 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const roleTestResults = [];
    for (const user of allUsers || []) {
      try {
        const { data: roleResult, error: roleError } = await supabase
          .rpc('get_user_role', {
            user_id_param: user.id
          });

        roleTestResults.push({
          email: user.email,
          userId: user.id,
          functionResult: roleResult,
          error: roleError?.message || null
        });
      } catch (error) {
        roleTestResults.push({
          email: user.email,
          userId: user.id,
          functionResult: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // 3. 检查重复的活跃角色
    const { data: duplicateRoles, error: duplicateError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('is_active', true);

    if (duplicateError) {
      console.error('Duplicate roles query error:', duplicateError);
    }

    // 统计重复角色
    const roleCounts = {};
    duplicateRoles?.forEach(role => {
      roleCounts[role.user_id] = (roleCounts[role.user_id] || 0) + 1;
    });
    const duplicates = Object.entries(roleCounts).filter(([_, count]) => count > 1);

    // 4. 查看所有角色记录
    const { data: allRoles, error: allRolesError } = await supabase
      .from('user_roles')
      .select(`
        user_id,
        role,
        is_active,
        granted_at,
        created_at,
        users!inner(email)
      `)
      .order('created_at', { ascending: false });

    if (allRolesError) {
      console.error('All roles query error:', allRolesError);
    }

    const response = {
      timestamp: new Date().toISOString(),
      usersWithActiveRoles: usersWithRoles || [],
      roleTestResults,
      duplicateActiveRoles: duplicates,
      allRoleRecords: allRoles || [],
      errors: {
        usersError: usersError?.message || null,
        duplicateError: duplicateError?.message || null,
        allRolesError: allRolesError?.message || null
      }
    };

    return new Response(
      JSON.stringify(response, null, 2),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Debug API error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};