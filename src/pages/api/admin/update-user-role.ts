import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { adminUserId, userId, newRole, reason } = body;
    
    if (!adminUserId || !userId || !newRole || !reason) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查操作者权限
    const { data: adminRole, error: adminRoleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', adminUserId)
      .single();

    if (adminRoleError || !adminRole || adminRole.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Unauthorized: Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 验证新角色有效性
    const validRoles = ['free', 'user', 'Pro', 'super', 'admin'];
    if (!validRoles.includes(newRole)) {
      return new Response(JSON.stringify({ error: 'Invalid role specified' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取目标用户当前角色和用户信息
    const { data: currentUserData, error: currentUserError } = await supabase
      .from('user_roles')
      .select(`
        role,
        users!inner(
          id,
          username,
          email
        )
      `)
      .eq('user_id', userId)
      .single();

    if (currentUserError || !currentUserData) {
      return new Response(JSON.stringify({ error: 'Target user not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const currentRole = currentUserData.role;
    const userData = currentUserData.users;

    // 检查是否真的需要更新（角色相同则跳过）
    if (currentRole === newRole) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'User already has the specified role',
        noChange: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 防止管理员降级自己
    if (adminUserId === userId && newRole !== 'admin') {
      return new Response(JSON.stringify({ error: 'Cannot demote yourself from admin role' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 开始事务：更新用户角色
    const { error: updateError } = await supabase
      .from('user_roles')
      .update({ 
        role: newRole,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating user role:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update user role' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 如果角色升级到付费角色，需要初始化用户配额
    if (['user', 'Pro', 'super'].includes(newRole) && currentRole === 'free') {
      try {
        // 调用初始化用户配额函数
        const { error: quotaError } = await supabase.rpc('initialize_user_quotas', {
          p_user_id: userId,
          p_role: newRole
        });

        if (quotaError) {
          console.error('Error initializing user quotas:', quotaError);
          // 不阻止角色更新，只记录错误
        }
      } catch (quotaInitError) {
        console.error('Error calling initialize_user_quotas:', quotaInitError);
      }
    }

    // 记录角色变更日志
    const logData = {
      user_id: userId,
      activity_type: 'role_change',
      description: `Role changed from ${currentRole} to ${newRole} by admin`,
      details: JSON.stringify({
        oldRole: currentRole,
        newRole: newRole,
        reason: reason,
        changedBy: adminUserId,
        changedByRole: 'admin',
        targetUser: {
          id: userId,
          username: userData.username,
          email: userData.email
        },
        timestamp: new Date().toISOString()
      }),
      ip_address: request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown'
    };

    const { error: logError } = await supabase
      .from('user_access_logs')
      .insert(logData);

    if (logError) {
      console.error('Error logging role change:', logError);
      // 不阻止操作，只记录错误
    }

    // 同时为管理员记录操作日志
    const adminLogData = {
      user_id: adminUserId,
      activity_type: 'admin_action',
      description: `Changed user ${userData.username || userData.email} role from ${currentRole} to ${newRole}`,
      details: JSON.stringify({
        action: 'role_change',
        targetUserId: userId,
        targetUsername: userData.username,
        targetEmail: userData.email,
        oldRole: currentRole,
        newRole: newRole,
        reason: reason,
        timestamp: new Date().toISOString()
      }),
      ip_address: request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown'
    };

    const { error: adminLogError } = await supabase
      .from('user_access_logs')
      .insert(adminLogData);

    if (adminLogError) {
      console.error('Error logging admin action:', adminLogError);
    }

    // 获取角色显示名称
    const getRoleDisplayName = (role: string) => {
      const roleNames = {
        free: '免费用户',
        user: '普通用户',
        Pro: 'Pro用户',
        super: 'Super用户',
        admin: '管理员'
      };
      return roleNames[role] || role;
    };

    return new Response(JSON.stringify({ 
      success: true, 
      message: `用户角色已成功从 ${getRoleDisplayName(currentRole)} 更新为 ${getRoleDisplayName(newRole)}`,
      data: {
        userId: userId,
        username: userData.username,
        email: userData.email,
        oldRole: currentRole,
        newRole: newRole,
        oldRoleDisplay: getRoleDisplayName(currentRole),
        newRoleDisplay: getRoleDisplayName(newRole),
        reason: reason,
        updatedAt: new Date().toISOString()
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in update user role API:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// 获取角色变更历史
export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const adminUserId = url.searchParams.get('adminUserId');
    const targetUserId = url.searchParams.get('userId');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    
    if (!adminUserId) {
      return new Response(JSON.stringify({ error: 'Missing adminUserId parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查管理员权限
    const { data: adminRole, error: adminRoleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', adminUserId)
      .single();

    if (adminRoleError || !adminRole || adminRole.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 构建查询
    let query = supabase
      .from('user_access_logs')
      .select('*')
      .eq('activity_type', 'role_change')
      .order('created_at', { ascending: false })
      .limit(limit);

    // 如果指定了目标用户，只查询该用户的记录
    if (targetUserId) {
      query = query.eq('user_id', targetUserId);
    }

    const { data: roleChanges, error: changesError } = await query;

    if (changesError) {
      console.error('Error fetching role changes:', changesError);
      return new Response(JSON.stringify({ error: 'Failed to fetch role change history' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 格式化数据
    const formattedChanges = roleChanges?.map(change => {
      let details = {};
      try {
        details = JSON.parse(change.details || '{}');
      } catch (e) {
        console.error('Error parsing change details:', e);
      }

      return {
        id: change.id,
        userId: change.user_id,
        description: change.description,
        details: details,
        createdAt: change.created_at,
        ipAddress: change.ip_address
      };
    }) || [];

    return new Response(JSON.stringify({
      changes: formattedChanges,
      total: formattedChanges.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in role change history API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};