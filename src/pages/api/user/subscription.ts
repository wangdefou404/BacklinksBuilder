import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('🔍 Subscription API - Request received');
    const { userId } = await request.json();
    console.log('🔍 Subscription API - UserId:', userId);

    if (!userId) {
      console.error('❌ Subscription API - No userId provided');
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 获取用户当前有效订阅 - 暂时不JOIN其他表避免RLS问题
    console.log('🔍 Subscription API - Querying user_subscriptions for userId:', userId);
    const { data: currentSubscription, error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'pending'])
      .or('expires_at.gte.' + new Date().toISOString() + ',expires_at.is.null')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // 如果有订阅，单独获取计划信息
    let planInfo = null;
    if (currentSubscription && !subscriptionError) {
      console.log('🔍 Subscription API - Fetching plan info for plan_id:', currentSubscription.plan_id);
      const { data: plan, error: planError } = await supabase
        .from('subscription_plans')
        .select('id, name, display_name, price, billing_cycle, features, role')
        .eq('id', currentSubscription.plan_id)
        .single();
      
      if (!planError) {
        planInfo = plan;
        console.log('🔍 Subscription API - Plan info retrieved:', planInfo);
      } else {
        console.log('🔍 Subscription API - Plan info error:', planError);
      }
    }

    console.log('🔍 Subscription API - Subscription query result:', { currentSubscription, subscriptionError });

    if (subscriptionError && subscriptionError.code !== 'PGRST116') {
      console.error('❌ Subscription API - Error fetching subscription:', subscriptionError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscription data' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 获取用户角色信息 - 直接查询避免RLS递归问题
    console.log('🔍 Subscription API - Querying user role for userId:', userId);
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log('🔍 Subscription API - User role query result:', { roleData, roleError });

    const userRole = roleData?.role || 'free';
    console.log('🔍 Subscription API - Final user role:', userRole);

    // 如果查询角色出错但不是找不到记录的错误，则返回错误
    if (roleError && roleError.code !== 'PGRST116') {
      console.error('❌ Subscription API - Error fetching user role:', roleError);
      // 不返回错误，使用默认角色 'free'
      console.log('🔍 Subscription API - Using default role: free');
    }

    // 构建响应数据 - 匹配UserSubscriptionStatus.astro组件期望的结构
    const responseData = {
      userId,
      currentRole: userRole || 'free',
      hasActiveSubscription: !!currentSubscription,
      subscription: currentSubscription ? {
        id: currentSubscription.id,
        plan_id: currentSubscription.plan_id,
        plan_name: planInfo?.display_name || planInfo?.name || 'Unknown Plan',
        status: currentSubscription.status,
        starts_at: currentSubscription.starts_at,
        expires_at: currentSubscription.expires_at,
        auto_renew: currentSubscription.auto_renew,
        price: planInfo?.price,
        billing_cycle: planInfo?.billing_cycle,
        features: planInfo?.features,
        role: planInfo?.role,
        created_at: currentSubscription.created_at,
        updated_at: currentSubscription.updated_at
      } : null
    }

    console.log('✅ Subscription API - Sending response data:', responseData);

    return new Response(
      JSON.stringify(responseData),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Subscription API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// 获取用户所有订阅历史
export const GET: APIRoute = async ({ url }) => {
  try {
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 获取用户所有订阅记录
    const { data: subscriptions, error } = await supabase
      .from('user_subscriptions')
      .select(`
        *,
        subscription_plans (
          id,
          name,
          display_name,
          price,
          billing_cycle,
          features,
          role
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching subscription history:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch subscription history' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ subscriptions: subscriptions || [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Subscription history API error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};