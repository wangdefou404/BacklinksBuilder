import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const endpointSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

export async function POST({ request }) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');

  let event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return new Response(
      JSON.stringify({ error: 'Webhook signature verification failed' }),
      { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    // 处理不同类型的事件
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Webhook handler error:', error);
    return new Response(
      JSON.stringify({ error: 'Webhook handler failed' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// 处理结账会话完成
async function handleCheckoutSessionCompleted(session) {
  console.log('Checkout session completed:', session.id);
  
  const userId = session.metadata.user_id;
  const plan = session.metadata.plan;
  const billingCycle = session.metadata.billing_cycle;
  
  if (!userId) {
    console.error('No user_id in session metadata');
    return;
  }

  try {
    // 获取订阅信息
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    
    // 更新用户计划
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ 
        plan: plan === 'super' ? 'super' : 'pro'
      })
      .eq('id', userId);

    if (userUpdateError) {
      console.error('Error updating user plan:', userUpdateError);
      return;
    }

    // 创建或更新订阅记录
    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        stripe_subscription_id: subscription.id,
        plan_id: plan,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'stripe_subscription_id'
      });

    if (subscriptionError) {
      console.error('Error creating/updating subscription:', subscriptionError);
      return;
    }

    // 更新用户配额
    await updateUserQuotas(userId, plan);
    
    console.log(`Successfully processed checkout for user ${userId}, plan: ${plan}`);
  } catch (error) {
    console.error('Error handling checkout session completed:', error);
  }
}

// 处理发票支付成功（续费）
async function handleInvoicePaymentSucceeded(invoice) {
  console.log('Invoice payment succeeded:', invoice.id);
  
  if (invoice.subscription) {
    try {
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      const userId = subscription.metadata.user_id;
      const plan = subscription.metadata.plan;
      
      if (!userId) {
        console.error('No user_id in subscription metadata');
        return;
      }

      // 更新订阅记录
      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .update({
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('stripe_subscription_id', subscription.id);

      if (subscriptionError) {
        console.error('Error updating subscription:', subscriptionError);
        return;
      }

      // 重置用户配额（续费时）
      await updateUserQuotas(userId, plan);
      
      console.log(`Successfully processed invoice payment for user ${userId}`);
    } catch (error) {
      console.error('Error handling invoice payment succeeded:', error);
    }
  }
}

// 处理订阅更新
async function handleSubscriptionUpdated(subscription) {
  console.log('Subscription updated:', subscription.id);
  
  const userId = subscription.metadata.user_id;
  
  if (!userId) {
    console.error('No user_id in subscription metadata');
    return;
  }

  try {
    // 更新订阅记录
    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .update({
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id);

    if (subscriptionError) {
      console.error('Error updating subscription:', subscriptionError);
      return;
    }

    // 如果订阅被取消或暂停，更新用户计划为免费
    if (['canceled', 'unpaid', 'past_due'].includes(subscription.status)) {
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ plan: 'free' })
        .eq('id', userId);

      if (userUpdateError) {
        console.error('Error updating user plan to free:', userUpdateError);
      }

      // 重置为免费配额
      await updateUserQuotas(userId, 'free');
    }
    
    console.log(`Successfully updated subscription for user ${userId}`);
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
}

// 处理订阅删除
async function handleSubscriptionDeleted(subscription) {
  console.log('Subscription deleted:', subscription.id);
  
  const userId = subscription.metadata.user_id;
  
  if (!userId) {
    console.error('No user_id in subscription metadata');
    return;
  }

  try {
    // 更新订阅状态
    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .update({
        status: 'canceled',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id);

    if (subscriptionError) {
      console.error('Error updating subscription status:', subscriptionError);
    }

    // 将用户计划降级为免费
    const { error: userUpdateError } = await supabase
      .from('users')
      .update({ plan: 'free' })
      .eq('id', userId);

    if (userUpdateError) {
      console.error('Error downgrading user to free plan:', userUpdateError);
      return;
    }

    // 重置为免费配额
    await updateUserQuotas(userId, 'free');
    
    console.log(`Successfully downgraded user ${userId} to free plan`);
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}

// 处理发票支付失败
async function handleInvoicePaymentFailed(invoice) {
  console.log('Invoice payment failed:', invoice.id);
  
  if (invoice.subscription) {
    try {
      const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
      const userId = subscription.metadata.user_id;
      
      if (!userId) {
        console.error('No user_id in subscription metadata');
        return;
      }

      // 更新订阅状态
      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .update({
          status: subscription.status,
          updated_at: new Date().toISOString()
        })
        .eq('stripe_subscription_id', subscription.id);

      if (subscriptionError) {
        console.error('Error updating subscription status:', subscriptionError);
      }
      
      console.log(`Payment failed for user ${userId}, subscription status: ${subscription.status}`);
    } catch (error) {
      console.error('Error handling invoice payment failed:', error);
    }
  }
}

// 更新用户配额
async function updateUserQuotas(userId, plan) {
  let quotas;
  
  switch (plan) {
    case 'pro':
      quotas = {
        dr_checks_remaining: 1000,
        traffic_checks_remaining: 1000,
        backlink_checks_remaining: 1000,
        backlink_views_remaining: 200
      };
      break;
    case 'super':
      quotas = {
        dr_checks_remaining: 5000,
        traffic_checks_remaining: 5000,
        backlink_checks_remaining: 5000,
        backlink_views_remaining: 200
      };
      break;
    default: // free
      quotas = {
        dr_checks_remaining: 10,
        traffic_checks_remaining: 10,
        backlink_checks_remaining: 10,
        backlink_views_remaining: 50
      };
  }

  // 计算下次重置日期（一个月后）
  const resetDate = new Date();
  resetDate.setMonth(resetDate.getMonth() + 1);

  const { error } = await supabase
    .from('user_quotas')
    .upsert({
      user_id: userId,
      ...quotas,
      reset_date: resetDate.toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    });

  if (error) {
    console.error('Error updating user quotas:', error);
  } else {
    console.log(`Updated quotas for user ${userId}, plan: ${plan}`);
  }
}