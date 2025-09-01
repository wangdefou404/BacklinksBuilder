import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { supabase } from '../../../lib/supabase';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

const endpointSecret = import.meta.env.STRIPE_WEBHOOK_SECRET!;

export const POST: APIRoute = async ({ request }) => {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return new Response(
      JSON.stringify({ error: 'Webhook signature verification failed' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCanceled(subscription);
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const planType = session.metadata?.planType;

  if (!userId || !planType) {
    console.error('Missing userId or planType in session metadata');
    return;
  }

  // 更新用户订阅状态
  const { error } = await supabase
    .from('users')
    .update({
      role: planType === 'pro' ? 'Pro' : planType === 'super' ? 'super' : 'free',
      stripe_subscription_id: session.subscription as string,
      subscription_status: 'active',
      subscription_plan: planType,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('Error updating user subscription:', error);
    return;
  }

  // 更新用户配额
  await updateUserQuotas(userId, planType);

  console.log(`Subscription activated for user ${userId} with plan ${planType}`);
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  const planType = subscription.metadata?.planType;

  if (!userId) {
    console.error('Missing userId in subscription metadata');
    return;
  }

  const status = subscription.status;
  const isActive = status === 'active' || status === 'trialing';

  // 更新用户订阅状态
  const { error } = await supabase
    .from('users')
    .update({
      role: isActive && planType ? (planType === 'pro' ? 'Pro' : planType === 'super' ? 'super' : 'free') : 'free',
      stripe_subscription_id: subscription.id,
      subscription_status: status,
      subscription_plan: isActive ? planType : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('Error updating user subscription:', error);
    return;
  }

  // 如果订阅激活，更新配额
  if (isActive && planType) {
    await updateUserQuotas(userId, planType);
  }

  console.log(`Subscription updated for user ${userId}: ${status}`);
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error('Missing userId in subscription metadata');
    return;
  }

  // 将用户降级为免费用户
  const { error } = await supabase
    .from('users')
    .update({
      role: 'free',
      subscription_status: 'canceled',
      subscription_plan: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('Error updating user after subscription cancellation:', error);
    return;
  }

  // 重置为免费配额
  await updateUserQuotas(userId, 'free');

  console.log(`Subscription canceled for user ${userId}`);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice.lines?.data?.[0]?.subscription as string) || null;
  
  if (!subscriptionId) {
    return;
  }

  // 获取订阅信息
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error('Missing userId in subscription metadata');
    return;
  }

  // 确保用户订阅状态为活跃
  const { error } = await supabase
    .from('users')
    .update({
      subscription_status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('Error updating user after payment success:', error);
  }

  console.log(`Payment succeeded for user ${userId}`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice.lines?.data?.[0]?.subscription as string) || null;
  
  if (!subscriptionId) {
    return;
  }

  // 获取订阅信息
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.userId;

  if (!userId) {
    console.error('Missing userId in subscription metadata');
    return;
  }

  // 更新用户订阅状态
  const { error } = await supabase
    .from('users')
    .update({
      subscription_status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    console.error('Error updating user after payment failure:', error);
  }

  console.log(`Payment failed for user ${userId}`);
}

async function updateUserQuotas(userId: string, planType: string) {
  try {
    // 调用数据库函数更新用户配额
    const { error } = await supabase.rpc('update_user_plan_quotas', {
      p_user_id: userId,
      p_plan_type: planType
    });

    if (error) {
      console.error('Error updating user quotas:', error);
    } else {
      console.log(`Quotas updated for user ${userId} with plan ${planType}`);
    }
  } catch (error) {
    console.error('Error calling update_user_plan_quotas:', error);
  }
}