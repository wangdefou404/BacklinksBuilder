import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const GET: APIRoute = async ({ url, request }) => {
  try {
    // 验证管理员权限
    const session = request.headers.get('cookie')?.match(/session=([^;]+)/)?.[1];
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let user;
    try {
      user = JSON.parse(decodeURIComponent(session));
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (user.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取查询参数
    const searchParams = url.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const planId = searchParams.get('planId') || '';
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    const offset = (page - 1) * limit;

    // 构建查询
    let query = supabase
      .from('user_subscriptions')
      .select(`
        *,
        users:user_id (
          id,
          username,
          email
        ),
        subscription_plans:plan_id (
          id,
          name,
          display_name,
          price,
          billing_cycle
        )
      `);

    // 应用筛选条件
    if (search) {
      query = query.or(`users.username.ilike.%${search}%,users.email.ilike.%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    if (planId) {
      query = query.eq('plan_id', planId);
    }

    // 应用排序
    const validSortFields = ['created_at', 'updated_at', 'start_date', 'end_date', 'status'];
    if (validSortFields.includes(sortBy)) {
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    // 应用分页
    query = query.range(offset, offset + limit - 1);

    const { data: subscriptions, error, count } = await query;

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch subscriptions' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取总数
    let countQuery = supabase
      .from('user_subscriptions')
      .select('*', { count: 'exact', head: true });

    if (search) {
      countQuery = countQuery.or(`users.username.ilike.%${search}%,users.email.ilike.%${search}%`);
    }
    if (status) {
      countQuery = countQuery.eq('status', status);
    }
    if (planId) {
      countQuery = countQuery.eq('plan_id', planId);
    }

    const { count: totalCount, error: countError } = await countQuery;

    if (countError) {
      console.error('Error counting subscriptions:', countError);
      return new Response(JSON.stringify({ error: 'Failed to count subscriptions' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const totalPages = Math.ceil((totalCount || 0) / limit);

    return new Response(JSON.stringify({
      subscriptions: subscriptions || [],
      pagination: {
        page,
        limit,
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
    console.error('Error in subscriptions API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    // 验证管理员权限
    const session = request.headers.get('cookie')?.match(/session=([^;]+)/)?.[1];
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let user;
    try {
      user = JSON.parse(decodeURIComponent(session));
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (user.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const requestData = await request.json();
    const { action } = requestData;

    switch (action) {
      case 'cancelSubscription': {
        const { subscriptionId, reason } = requestData;
        
        if (!subscriptionId) {
          return new Response(JSON.stringify({ error: 'Subscription ID is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 获取订阅信息
        const { data: subscription, error: fetchError } = await supabase
          .from('user_subscriptions')
          .select('*')
          .eq('id', subscriptionId)
          .single();

        if (fetchError || !subscription) {
          return new Response(JSON.stringify({ error: 'Subscription not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        if (subscription.status === 'cancelled') {
          return new Response(JSON.stringify({ error: 'Subscription is already cancelled' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 取消订阅
        const { data: updatedSubscription, error: updateError } = await supabase
          .from('user_subscriptions')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancellation_reason: reason || 'Cancelled by admin',
            updated_at: new Date().toISOString()
          })
          .eq('id', subscriptionId)
          .select()
          .single();

        if (updateError) {
          console.error('Error cancelling subscription:', updateError);
          return new Response(JSON.stringify({ error: 'Failed to cancel subscription' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 更新用户角色为 free
        const { error: roleUpdateError } = await supabase
          .from('users')
          .update({ role: 'free' })
          .eq('id', subscription.user_id);

        if (roleUpdateError) {
          console.error('Error updating user role:', roleUpdateError);
          // 不返回错误，因为订阅已经取消成功
        }

        return new Response(JSON.stringify({
          message: 'Subscription cancelled successfully',
          subscription: updatedSubscription
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      case 'getSubscriptionDetails': {
        const { subscriptionId } = requestData;
        
        if (!subscriptionId) {
          return new Response(JSON.stringify({ error: 'Subscription ID is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 获取订阅详细信息
        const { data: subscription, error } = await supabase
          .from('user_subscriptions')
          .select(`
            *,
            users:user_id (
              id,
              username,
              email,
              role,
              created_at
            ),
            subscription_plans:plan_id (
              id,
              name,
              display_name,
              role,
              price,
              billing_cycle,
              features,
              description
            )
          `)
          .eq('id', subscriptionId)
          .single();

        if (error || !subscription) {
          return new Response(JSON.stringify({ error: 'Subscription not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 获取用户的配额信息
        const { data: quotas, error: quotaError } = await supabase
          .from('user_quotas')
          .select(`
            *,
            quota_definitions:quota_type (
              name,
              display_name,
              description,
              unit
            )
          `)
          .eq('user_id', subscription.user_id);

        if (quotaError) {
          console.error('Error fetching user quotas:', quotaError);
        }

        return new Response(JSON.stringify({
          subscription,
          quotas: quotas || []
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      case 'updateSubscription': {
        const { subscriptionId, updates } = requestData;
        
        if (!subscriptionId) {
          return new Response(JSON.stringify({ error: 'Subscription ID is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        if (!updates || Object.keys(updates).length === 0) {
          return new Response(JSON.stringify({ error: 'No updates provided' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        // 验证更新字段
        const allowedFields = ['status', 'end_date', 'auto_renew', 'payment_method'];
        const updateData: any = { updated_at: new Date().toISOString() };
        
        for (const [key, value] of Object.entries(updates)) {
          if (allowedFields.includes(key)) {
            updateData[key] = value;
          }
        }

        // 更新订阅
        const { data: updatedSubscription, error: updateError } = await supabase
          .from('user_subscriptions')
          .update(updateData)
          .eq('id', subscriptionId)
          .select()
          .single();

        if (updateError) {
          console.error('Error updating subscription:', updateError);
          return new Response(JSON.stringify({ error: 'Failed to update subscription' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }

        return new Response(JSON.stringify({
          message: 'Subscription updated successfully',
          subscription: updatedSubscription
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('Error in subscriptions POST API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};