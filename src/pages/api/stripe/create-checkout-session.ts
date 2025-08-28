import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase } from '../../../lib/supabase';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const { priceId, planType } = await request.json();

    if (!priceId || !planType) {
      return new Response(
        JSON.stringify({ error: 'Price ID and plan type are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 获取当前用户会话
    const sessionCookie = cookies.get('session');
    if (!sessionCookie) {
      return new Response(
        JSON.stringify({ error: 'User not authenticated' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const session = JSON.parse(sessionCookie.value);
    const userId = session.userId;
    const userEmail = session.email;

    // 获取用户信息
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 检查用户是否已有 Stripe 客户 ID
    let customerId = user.stripe_customer_id;

    if (!customerId) {
      // 创建新的 Stripe 客户
      const customer = await stripe.customers.create({
        email: userEmail,
        name: user.name,
        metadata: {
          userId: userId,
        },
      });
      customerId = customer.id;

      // 更新用户记录中的 Stripe 客户 ID
      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);
    }

    const SITE_URL = import.meta.env.SITE_URL || 'http://localhost:4321';

    // 创建 Stripe 结账会话
    const checkoutSession = await stripe.checkout.sessions.create({
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
      cancel_url: `${SITE_URL}/pricing?canceled=true`,
      metadata: {
        userId: userId,
        planType: planType,
      },
      subscription_data: {
        metadata: {
          userId: userId,
          planType: planType,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
    });

    return new Response(
      JSON.stringify({ 
        sessionId: checkoutSession.id,
        url: checkoutSession.url 
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create checkout session',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
};