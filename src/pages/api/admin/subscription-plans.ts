import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

export const GET: APIRoute = async ({ request }) => {
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

    // 获取所有订阅计划
    const { data: plans, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching subscription plans:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch subscription plans' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(plans || []), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in subscription plans API:', error);
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

    const planData = await request.json();
    const { name, display_name, role, billing_cycle, price, features, description, is_active } = planData;

    // 验证必填字段
    if (!name || !display_name || !role || !billing_cycle || price === undefined) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 验证角色
    const validRoles = ['user', 'Pro', 'super'];
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: 'Invalid role' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 验证计费周期
    const validBillingCycles = ['monthly', 'yearly'];
    if (!validBillingCycles.includes(billing_cycle)) {
      return new Response(JSON.stringify({ error: 'Invalid billing cycle' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 验证价格
    if (price < 0) {
      return new Response(JSON.stringify({ error: 'Price must be non-negative' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查计划名称是否已存在
    const { data: existingPlan, error: checkError } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('name', name)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing plan:', checkError);
      return new Response(JSON.stringify({ error: 'Failed to check existing plan' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (existingPlan) {
      return new Response(JSON.stringify({ error: 'Plan name already exists' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 创建新计划
    const { data: newPlan, error: createError } = await supabase
      .from('subscription_plans')
      .insert({
        name,
        display_name,
        role,
        billing_cycle,
        price,
        features: features || null,
        description: description || null,
        is_active: is_active !== undefined ? is_active : true
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating subscription plan:', createError);
      return new Response(JSON.stringify({ error: 'Failed to create subscription plan' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(newPlan), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in create subscription plan API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};