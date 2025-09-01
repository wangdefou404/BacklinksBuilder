import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase } from '../../../lib/supabase';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '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', {
  apiVersion: '2023-10-16',
});

  // 价格 ID 映射
  const priceIdMap: Record<string, string> = {
    'pro-monthly': 'price_1S0YgNLfVOp3GFo8rqOekw7W',
    'pro-annual': 'price_1S0YsELfVOp3GFo8wRyraxeF',
    'super-monthly': 'price_1S0YhqLfVOp3GFo8Z9HUV9QQ',
    'super-annual': 'price_1S0YqfLfVOp3GFo8o6fZ7k6k',
  };

export const POST: APIRoute = async ({ request, cookies }) => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    console.log(`[${requestId}] === CREATE CHECKOUT API START ===`);
    console.log(`[${requestId}] Request URL:`, request.url);
    console.log(`[${requestId}] Request method:`, request.method);
    console.log(`[${requestId}] Request headers:`, Object.fromEntries(request.headers.entries()));
    
    // 解析请求体
    let requestData;
    try {
      requestData = await request.json();
      console.log(`[${requestId}] Request data:`, JSON.stringify(requestData, null, 2));
    } catch (parseError) {
      console.error('Failed to parse request JSON:', parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON in request body',
          details: parseError instanceof Error ? parseError.message : 'Unknown parsing error'
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    const { plan, billing_cycle, user_id } = requestData;

    // 验证必需参数
    if (!plan || !billing_cycle || !user_id) {
      const errorMsg = 'Missing required parameters';
      console.error(`[${requestId}] ${errorMsg}:`, { plan, billing_cycle, user_id, receivedKeys: Object.keys(requestData) });
      return new Response(
        JSON.stringify({ 
          error: errorMsg,
          required: ['plan', 'billing_cycle', 'user_id'],
          received: { plan, billing_cycle, user_id },
          requestId
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // 验证计划类型
    if (!['pro', 'super'].includes(plan)) {
      const errorMsg = 'Invalid plan type. Must be "pro" or "super"';
      console.error(`[${requestId}] ${errorMsg}:`, { plan, validPlans: ['pro', 'super'] });
      return new Response(
        JSON.stringify({ 
          error: errorMsg,
          validPlans: ['pro', 'super'],
          received: plan,
          requestId
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // 验证计费周期
    if (!['monthly', 'yearly'].includes(billing_cycle)) {
      const errorMsg = 'Invalid billing cycle. Must be "monthly" or "yearly"';
      console.error(`[${requestId}] ${errorMsg}:`, { billing_cycle, validCycles: ['monthly', 'yearly'] });
      return new Response(
        JSON.stringify({ 
          error: errorMsg,
          validCycles: ['monthly', 'yearly'],
          received: billing_cycle,
          requestId
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // 获取用户信息
    console.log(`[${requestId}] Getting user info for user_id:`, user_id);
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user_id)
      .single();

    if (userError || !userData) {
      console.error(`[${requestId}] User not found:`, { userError, user_id });
      return new Response(JSON.stringify({
        success: false,
        error: 'User not found',
        requestId
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    console.log(`[${requestId}] User found:`, { id: userData.id, email: userData.email, stripe_customer_id: userData.stripe_customer_id });

    // 创建或获取 Stripe 客户
    let customerId = userData.stripe_customer_id;
    if (!customerId) {
      console.log(`[${requestId}] Creating new Stripe customer for user:`, userData.email);
      try {
        const customer = await stripe.customers.create({
          email: userData.email,
          metadata: {
            user_id: userData.id
          }
        });
        customerId = customer.id;
        console.log(`[${requestId}] Stripe customer created:`, { customerId, email: userData.email });
        
        // 更新用户的 stripe_customer_id
        const { error: updateError } = await supabase
          .from('users')
          .update({ stripe_customer_id: customerId })
          .eq('id', userData.id);
          
        if (updateError) {
          console.error(`[${requestId}] Failed to update user stripe_customer_id:`, updateError);
        } else {
          console.log(`[${requestId}] User stripe_customer_id updated successfully`);
        }
      } catch (stripeError) {
        console.error(`[${requestId}] Failed to create Stripe customer:`, stripeError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Failed to create Stripe customer',
          requestId
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    } else {
      console.log(`[${requestId}] Using existing Stripe customer:`, customerId);
    }

    // 获取价格 ID
    const planKey = `${plan}-${billing_cycle === 'yearly' ? 'annual' : 'monthly'}`;
    const priceId = priceIdMap[planKey];
    console.log(`[${requestId}] Price mapping:`, { plan, billing_cycle, planKey, priceId, availableKeys: Object.keys(priceIdMap) });
    
    if (!priceId) {
      console.error(`[${requestId}] Invalid plan configuration:`, { plan, billing_cycle, planKey, availableKeys: Object.keys(priceIdMap) });
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid plan configuration',
        requestId
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    console.log(`[${requestId}] Using price ID:`, priceId);

    // 获取站点 URL
    const SITE_URL = import.meta.env.SITE_URL || 'http://localhost:4321';
    console.log('Site URL:', SITE_URL);

    // 创建 Stripe 结账会话
    console.log(`[${requestId}] Creating Stripe checkout session...`);
    console.log(`[${requestId}] Session parameters:`, {
      customer: customerId,
      priceId,
      siteUrl: SITE_URL,
      metadata: { user_id: userData.id, plan, billing_cycle }
    });
    
    try {
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${SITE_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${SITE_URL}/pricing`,
        metadata: {
          user_id: userData.id,
          plan: plan,
          billing_cycle: billing_cycle
        }
      });

      const executionTime = Date.now() - startTime;
      console.log(`[${requestId}] Checkout session created successfully:`, {
        sessionId: session.id,
        url: session.url,
        executionTime: `${executionTime}ms`
      });

      return new Response(JSON.stringify({
        success: true,
        sessionId: session.id,
        url: session.url,
        requestId
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (stripeError) {
      const executionTime = Date.now() - startTime;
      console.error(`[${requestId}] Failed to create Stripe checkout session:`, {
        error: stripeError,
        executionTime: `${executionTime}ms`
      });
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to create checkout session',
        details: stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error',
        requestId
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`[${requestId}] Payment API error:`, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      executionTime: `${executionTime}ms`
    });
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};