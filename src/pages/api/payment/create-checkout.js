import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST({ request }) {
  try {
    const { plan, billing_cycle, user_id } = await request.json();

    // 验证必需参数
    if (!plan || !billing_cycle || !user_id) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required parameters: plan, billing_cycle, user_id' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 验证计划类型
    if (!['pro', 'super'].includes(plan)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid plan. Must be "pro" or "super"' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 验证计费周期
    if (!['monthly', 'annual'].includes(billing_cycle)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid billing_cycle. Must be "monthly" or "annual"' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 验证用户是否存在
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', user_id)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ 
          error: 'User not found' 
        }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 获取价格ID
    let priceId;
    if (plan === 'pro') {
      priceId = billing_cycle === 'monthly' 
        ? import.meta.env.STRIPE_PRO_PRICE_ID 
        : import.meta.env.STRIPE_PRO_ANNUAL_PRICE_ID;
    } else if (plan === 'super') {
      priceId = billing_cycle === 'monthly' 
        ? import.meta.env.STRIPE_SUPERPRO_PRICE_ID 
        : import.meta.env.STRIPE_SUPERPRO_ANNUAL_PRICE_ID;
    }

    if (!priceId) {
      return new Response(
        JSON.stringify({ 
          error: 'Price ID not configured for this plan and billing cycle' 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 创建或获取Stripe客户
    let customer;
    try {
      // 首先尝试通过邮箱查找现有客户
      const existingCustomers = await stripe.customers.list({
        email: user.email,
        limit: 1
      });

      if (existingCustomers.data.length > 0) {
        customer = existingCustomers.data[0];
      } else {
        // 创建新客户
        customer = await stripe.customers.create({
          email: user.email,
          name: user.name || user.email,
          metadata: {
            user_id: user_id
          }
        });
      }
    } catch (stripeError) {
      console.error('Stripe customer error:', stripeError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create or retrieve customer' 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // 创建Checkout会话
    try {
      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${request.headers.get('origin')}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${request.headers.get('origin')}/payment/cancel`,
        metadata: {
          user_id: user_id,
          plan: plan,
          billing_cycle: billing_cycle
        },
        subscription_data: {
          metadata: {
            user_id: user_id,
            plan: plan,
            billing_cycle: billing_cycle
          }
        },
        allow_promotion_codes: true,
        billing_address_collection: 'required',
        customer_update: {
          address: 'auto',
          name: 'auto'
        }
      });

      return new Response(
        JSON.stringify({ 
          checkout_url: session.url,
          session_id: session.id
        }),
        { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    } catch (stripeError) {
      console.error('Stripe checkout session error:', stripeError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create checkout session',
          details: stripeError.message
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error) {
    console.error('Create checkout error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}