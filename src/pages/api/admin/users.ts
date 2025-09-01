import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10');
    const search = url.searchParams.get('search') || '';
    const roleFilter = url.searchParams.get('role') || '';
    const statusFilter = url.searchParams.get('status') || '';
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查用户角色
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (roleError || !userRole || userRole.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 构建查询
    let query = supabase
      .from('user_roles')
      .select(`
        user_id,
        role,
        created_at,
        updated_at,
        users!inner(
          id,
          username,
          email,
          created_at
        )
      `);

    // 应用角色筛选
    if (roleFilter) {
      query = query.eq('role', roleFilter);
    }

    // 应用搜索条件
    if (search) {
      query = query.or(`users.username.ilike.%${search}%,users.email.ilike.%${search}%`);
    }

    // 获取总数
    const { count: totalCount, error: countError } = await supabase
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .eq(roleFilter ? 'role' : 'user_id', roleFilter || userId, { foreignTable: roleFilter ? undefined : 'users' });

    if (countError) {
      console.error('Error getting user count:', countError);
    }

    // 应用分页
    const offset = (page - 1) * pageSize;
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    const { data: users, error: usersError } = await query;

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return new Response(JSON.stringify({ error: 'Failed to fetch users' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取用户最后活动时间
    const userIds = users?.map(u => u.user_id) || [];
    const { data: lastActivities, error: activityError } = await supabase
      .from('user_access_logs')
      .select('user_id, created_at')
      .in('user_id', userIds)
      .order('created_at', { ascending: false });

    // 创建最后活动时间映射
    const lastActivityMap = {};
    if (lastActivities) {
      lastActivities.forEach(activity => {
        if (!lastActivityMap[activity.user_id]) {
          lastActivityMap[activity.user_id] = activity.created_at;
        }
      });
    }

    // 格式化用户数据
    const formattedUsers = users?.map(userRole => {
      const user = userRole.users;
      const lastActivity = lastActivityMap[userRole.user_id];
      
      // 判断用户状态（7天内有活动为活跃）
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const isActive = lastActivity && new Date(lastActivity) > sevenDaysAgo;
      
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: userRole.role,
        created_at: user.created_at,
        role_created_at: userRole.created_at,
        role_updated_at: userRole.updated_at,
        last_activity: lastActivity,
        status: isActive ? 'active' : 'inactive'
      };
    }) || [];

    // 应用状态筛选（在内存中筛选，因为状态是计算出来的）
    let filteredUsers = formattedUsers;
    if (statusFilter) {
      filteredUsers = formattedUsers.filter(user => user.status === statusFilter);
    }

    const totalPages = Math.ceil((totalCount || 0) / pageSize);

    return new Response(JSON.stringify({
      users: filteredUsers,
      pagination: {
        page,
        pageSize,
        total: totalCount || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in users API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { userId, targetUserId, action, data } = body;
    
    if (!userId || !targetUserId || !action) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查操作者权限
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (roleError || !userRole || userRole.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    switch (action) {
      case 'updateRole':
        const { newRole, reason } = data;
        
        if (!newRole || !reason) {
          return new Response(JSON.stringify({ error: 'Missing role or reason' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 验证角色有效性
        const validRoles = ['free', 'user', 'Pro', 'super', 'admin'];
        if (!validRoles.includes(newRole)) {
          return new Response(JSON.stringify({ error: 'Invalid role' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 获取目标用户当前角色
        const { data: currentRole, error: currentRoleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', targetUserId)
          .single();

        if (currentRoleError) {
          return new Response(JSON.stringify({ error: 'Target user not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 更新用户角色
        const { error: updateError } = await supabase
          .from('user_roles')
          .update({ 
            role: newRole,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', targetUserId);

        if (updateError) {
          console.error('Error updating user role:', updateError);
          return new Response(JSON.stringify({ error: 'Failed to update user role' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 记录角色变更日志
        const { error: logError } = await supabase
          .from('user_access_logs')
          .insert({
            user_id: targetUserId,
            activity_type: 'role_change',
            description: `Role changed from ${currentRole.role} to ${newRole}`,
            details: JSON.stringify({
              oldRole: currentRole.role,
              newRole: newRole,
              reason: reason,
              changedBy: userId
            }),
            ip_address: request.headers.get('x-forwarded-for') || 'unknown',
            user_agent: request.headers.get('user-agent') || 'unknown'
          });

        if (logError) {
          console.error('Error logging role change:', logError);
        }

        return new Response(JSON.stringify({ 
          success: true, 
          message: 'User role updated successfully',
          oldRole: currentRole.role,
          newRole: newRole
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      case 'getUserDetails':
        // 获取用户详细信息
        const { data: userDetails, error: detailsError } = await supabase
          .from('user_roles')
          .select(`
            user_id,
            role,
            created_at,
            updated_at,
            users!inner(
              id,
              username,
              email,
              created_at
            )
          `)
          .eq('user_id', targetUserId)
          .single();

        if (detailsError) {
          return new Response(JSON.stringify({ error: 'User not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 获取用户订阅信息
        const { data: subscriptions, error: subError } = await supabase
          .from('user_subscriptions')
          .select(`
            *,
            subscription_plans(*)
          `)
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false });

        // 获取用户配额信息
        const { data: quotas, error: quotaError } = await supabase
          .from('user_quotas')
          .select('*')
          .eq('user_id', targetUserId);

        // 获取用户最近活动
        const { data: recentActivities, error: activitiesError } = await supabase
          .from('user_access_logs')
          .select('*')
          .eq('user_id', targetUserId)
          .order('created_at', { ascending: false })
          .limit(10);

        return new Response(JSON.stringify({
          user: userDetails,
          subscriptions: subscriptions || [],
          quotas: quotas || [],
          recentActivities: recentActivities || []
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('Error in users POST API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};