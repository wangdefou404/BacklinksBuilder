import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    // 验证用户是否已登录
    const session = locals.session;
    const user = locals.user;
    
    if (!session || !user) {
      return new Response(JSON.stringify({ error: '未授权访问' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取用户角色
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !userRole || !['admin', 'super'].includes(userRole.role)) {
      return new Response(JSON.stringify({ error: '权限不足' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取URL参数
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const search = url.searchParams.get('search') || '';
    const roleFilter = url.searchParams.get('role') || '';
    const statusFilter = url.searchParams.get('status') || '';
    const sortBy = url.searchParams.get('sortBy') || 'created_at';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';

    // 构建查询
    let query = supabase
      .from('auth.users')
      .select(`
        id,
        email,
        created_at,
        last_sign_in_at,
        user_metadata,
        raw_user_meta_data
      `);

    // 添加搜索条件
    if (search) {
      query = query.ilike('email', `%${search}%`);
    }

    // 获取用户数据
    const { data: users, error: usersError } = await query
      .order(sortBy, { ascending: sortOrder === 'asc' })
      .range((page - 1) * limit, page * limit - 1);

    if (usersError) {
      console.error('获取用户列表失败:', usersError);
      return new Response(JSON.stringify({ error: '获取用户列表失败' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取用户角色信息
    const userIds = users?.map(u => u.id) || [];
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('user_id', userIds);

    // 获取订阅信息
    const { data: subscriptions } = await supabase
      .from('user_subscriptions')
      .select('user_id, status, plan_type')
      .in('user_id', userIds)
      .eq('status', 'active');

    // 合并数据
    const enrichedUsers = users?.map(user => {
      const userRole = roles?.find(r => r.user_id === user.id);
      const subscription = subscriptions?.find(s => s.user_id === user.id);
      
      return {
        ...user,
        role: userRole?.role || 'user',
        subscription_status: subscription?.status || 'inactive',
        plan_type: subscription?.plan_type || null,
        avatar_url: user.user_metadata?.avatar_url || user.raw_user_meta_data?.avatar_url,
        full_name: user.user_metadata?.full_name || user.raw_user_meta_data?.full_name,
        status: user.last_sign_in_at ? 'active' : 'inactive'
      };
    }) || [];

    // 应用角色筛选
    let filteredUsers = enrichedUsers;
    if (roleFilter) {
      filteredUsers = enrichedUsers.filter(user => {
        switch (roleFilter) {
          case 'user':
            return user.role === 'user' && user.subscription_status !== 'active';
          case 'premium':
            return user.subscription_status === 'active';
          case 'admin':
            return user.role === 'admin';
          case 'super':
            return user.role === 'super';
          default:
            return true;
        }
      });
    }

    // 应用状态筛选
    if (statusFilter) {
      filteredUsers = filteredUsers.filter(user => {
        switch (statusFilter) {
          case 'active':
            return user.last_sign_in_at && new Date(user.last_sign_in_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          case 'inactive':
            return !user.last_sign_in_at || new Date(user.last_sign_in_at) <= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          case 'suspended':
            return user.status === 'suspended';
          default:
            return true;
        }
      });
    }

    // 获取总数
    const { count: totalCount } = await supabase
      .from('auth.users')
      .select('*', { count: 'exact', head: true });

    return new Response(JSON.stringify({
      users: filteredUsers,
      total: totalCount || 0,
      page,
      limit,
      totalPages: Math.ceil((totalCount || 0) / limit)
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('用户管理API错误:', error);
    return new Response(JSON.stringify({ error: '服务器内部错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // 验证用户是否已登录
    const session = locals.session;
    const user = locals.user;
    
    if (!session || !user) {
      return new Response(JSON.stringify({ error: '未授权访问' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取用户角色
    const { data: userRole, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || !userRole || !['admin', 'super'].includes(userRole.role)) {
      return new Response(JSON.stringify({ error: '权限不足' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { action, userId, data } = await request.json();

    switch (action) {
      case 'create':
        // 创建新用户
        const { email, password, role } = data;
        
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true
        });

        if (createError) {
          return new Response(JSON.stringify({ error: '创建用户失败: ' + createError.message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 设置用户角色
        if (role && role !== 'user') {
          await supabase
            .from('user_roles')
            .insert({ user_id: newUser.user.id, role });
        }

        return new Response(JSON.stringify({ success: true, user: newUser.user }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      case 'update':
        // 更新用户信息
        const { role: newRole, status } = data;
        
        // 更新用户状态
        if (status !== undefined) {
          const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
            ban_duration: status === 'suspended' ? '876000h' : 'none' // 100年 vs 无限制
          });

          if (updateError) {
            return new Response(JSON.stringify({ error: '更新用户状态失败' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }

        // 更新用户角色
        if (newRole) {
          const { error: roleUpdateError } = await supabase
            .from('user_roles')
            .upsert({ user_id: userId, role: newRole });

          if (roleUpdateError) {
            return new Response(JSON.stringify({ error: '更新用户角色失败' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      case 'delete':
        // 删除用户
        const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

        if (deleteError) {
          return new Response(JSON.stringify({ error: '删除用户失败' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 删除相关数据
        await supabase.from('user_roles').delete().eq('user_id', userId);
        await supabase.from('user_subscriptions').delete().eq('user_id', userId);

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      case 'suspend':
        // 暂停用户
        const { error: suspendError } = await supabase.auth.admin.updateUserById(userId, {
          ban_duration: '876000h' // 100年
        });

        if (suspendError) {
          return new Response(JSON.stringify({ error: '暂停用户失败' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      case 'activate':
        // 激活用户
        const { error: activateError } = await supabase.auth.admin.updateUserById(userId, {
          ban_duration: 'none'
        });

        if (activateError) {
          return new Response(JSON.stringify({ error: '激活用户失败' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      case 'batch':
        // 批量操作
        const { userIds, batchAction } = data;
        const results = [];

        for (const id of userIds) {
          try {
            switch (batchAction) {
              case 'suspend':
                await supabase.auth.admin.updateUserById(id, { ban_duration: '876000h' });
                break;
              case 'activate':
                await supabase.auth.admin.updateUserById(id, { ban_duration: 'none' });
                break;
              case 'delete':
                await supabase.auth.admin.deleteUser(id);
                await supabase.from('user_roles').delete().eq('user_id', id);
                await supabase.from('user_subscriptions').delete().eq('user_id', id);
                break;
            }
            results.push({ userId: id, success: true });
          } catch (error) {
            results.push({ userId: id, success: false, error: error.message });
          }
        }

        return new Response(JSON.stringify({ success: true, results }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      default:
        return new Response(JSON.stringify({ error: '无效的操作' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('用户管理操作错误:', error);
    return new Response(JSON.stringify({ error: '服务器内部错误' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};