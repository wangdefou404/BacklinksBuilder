import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase } from '../../../lib/supabase';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
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

    // 获取用户信息
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!user.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: 'No Stripe customer found for this user' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const SITE_URL = import.meta.env.SITE_URL || 'http://localhost:4321';

    // 创建客户门户会话
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${SITE_URL}/dashboard`,
    });

    return new Response(
      JSON.stringify({ 
        url: portalSession.url 
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error creating customer portal session:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to create customer portal session',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
};