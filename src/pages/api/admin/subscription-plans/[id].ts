import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const GET: APIRoute = async ({ params, request }) => {
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

    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Plan ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取指定订阅计划
    const { data: plan, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return new Response(JSON.stringify({ error: 'Plan not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      console.error('Error fetching subscription plan:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch subscription plan' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(plan), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in get subscription plan API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
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

    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Plan ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const updateData = await request.json();
    const { name, display_name, role, billing_cycle, price, features, description, is_active } = updateData;

    // 构建更新对象，只包含提供的字段
    const updates: any = {};
    
    if (name !== undefined) {
      // 检查名称是否已被其他计划使用
      const { data: existingPlan, error: checkError } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('name', name)
        .neq('id', id)
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
      
      updates.name = name;
    }
    
    if (display_name !== undefined) updates.display_name = display_name;
    
    if (role !== undefined) {
      const validRoles = ['user', 'Pro', 'super'];
      if (!validRoles.includes(role)) {
        return new Response(JSON.stringify({ error: 'Invalid role' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      updates.role = role;
    }
    
    if (billing_cycle !== undefined) {
      const validBillingCycles = ['monthly', 'yearly'];
      if (!validBillingCycles.includes(billing_cycle)) {
        return new Response(JSON.stringify({ error: 'Invalid billing cycle' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      updates.billing_cycle = billing_cycle;
    }
    
    if (price !== undefined) {
      if (price < 0) {
        return new Response(JSON.stringify({ error: 'Price must be non-negative' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      updates.price = price;
    }
    
    if (features !== undefined) updates.features = features;
    if (description !== undefined) updates.description = description;
    if (is_active !== undefined) updates.is_active = is_active;

    // 如果没有提供任何更新字段
    if (Object.keys(updates).length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 添加更新时间
    updates.updated_at = new Date().toISOString();

    // 更新订阅计划
    const { data: updatedPlan, error: updateError } = await supabase
      .from('subscription_plans')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') {
        return new Response(JSON.stringify({ error: 'Plan not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      console.error('Error updating subscription plan:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update subscription plan' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(updatedPlan), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in update subscription plan API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
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

    const { id } = params;
    if (!id) {
      return new Response(JSON.stringify({ error: 'Plan ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查是否有活跃的订阅使用此计划
    const { data: activeSubscriptions, error: checkError } = await supabase
      .from('user_subscriptions')
      .select('id')
      .eq('plan_id', id)
      .eq('status', 'active')
      .limit(1);

    if (checkError) {
      console.error('Error checking active subscriptions:', checkError);
      return new Response(JSON.stringify({ error: 'Failed to check active subscriptions' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (activeSubscriptions && activeSubscriptions.length > 0) {
      return new Response(JSON.stringify({ error: 'Cannot delete plan with active subscriptions' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 删除订阅计划
    const { error: deleteError } = await supabase
      .from('subscription_plans')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting subscription plan:', deleteError);
      return new Response(JSON.stringify({ error: 'Failed to delete subscription plan' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ message: 'Plan deleted successfully' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in delete subscription plan API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};