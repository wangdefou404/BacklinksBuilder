import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    // 验证用户权限
    const session = locals.session;
    const user = locals.user;

    if (!session || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取用户角色
    const userRole = await getUserRole(user.id);
    if (!userRole || !['admin', 'super'].includes(userRole.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const refresh = url.searchParams.get('refresh');
    const timeRange = url.searchParams.get('timeRange') || 'week';
    const status = url.searchParams.get('status') || 'all';
    const method = url.searchParams.get('method') || 'all';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const search = url.searchParams.get('search') || '';

    // 获取支付数据
    const paymentsData = await getPaymentsData({
      timeRange,
      status,
      method,
      page,
      limit,
      search,
      refresh: refresh === 'true'
    });

    return new Response(JSON.stringify({
      success: true,
      data: paymentsData
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Payments API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    // 验证用户权限
    const session = locals.session;
    const user = locals.user;

    if (!session || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取用户角色
    const userRole = await getUserRole(user.id);
    if (!userRole || !['admin', 'super'].includes(userRole.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'process_refund':
        return await processRefund(body);
      
      case 'approve_refund':
        return await approveRefund(body);
      
      case 'cancel_subscription':
        return await cancelSubscription(body);
      
      case 'export_payments':
        return await exportPayments(body);
      
      case 'update_transaction':
        return await updateTransaction(body);
      
      case 'bulk_action':
        return await bulkAction(body);
      
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('Payments POST API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// 获取用户角色
async function getUserRole(userId: string) {
  try {
    // 这里应该从数据库获取用户角色
    // 模拟数据
    const mockRoles = {
      'user123': { role: 'admin', permissions: ['read', 'write', 'delete'] },
      'admin456': { role: 'super', permissions: ['read', 'write', 'delete', 'admin'] }
    };
    
    return mockRoles[userId as keyof typeof mockRoles] || null;
  } catch (error) {
    console.error('Get user role error:', error);
    return null;
  }
}

// 获取支付数据
async function getPaymentsData(params: {
  timeRange: string;
  status: string;
  method: string;
  page: number;
  limit: number;
  search: string;
  refresh: boolean;
}) {
  try {
    // 这里应该从数据库或支付服务提供商API获取真实数据
    // 模拟数据处理
    
    const { timeRange, status, method, page, limit, search } = params;
    
    // 模拟支付概览数据
    const overview = {
      totalRevenue: 125680.50,
      monthlyRevenue: 18750.25,
      totalTransactions: 2847,
      successRate: 98.5,
      pendingRefunds: 12,
      averageOrderValue: 44.15,
      revenueGrowth: 15.3,
      transactionGrowth: 8.7
    };

    // 模拟交易数据
    let transactions = [
      {
        id: 'txn_1234567890',
        orderId: 'ORD-2024-001',
        userId: 'user123',
        userEmail: 'john@example.com',
        amount: 29.99,
        currency: 'USD',
        status: 'completed',
        paymentMethod: 'stripe',
        plan: 'Premium Monthly',
        createdAt: '2024-01-07 14:30:25',
        updatedAt: '2024-01-07 14:30:45',
        stripePaymentId: 'pi_1234567890',
        description: 'Premium subscription upgrade'
      },
      {
        id: 'txn_1234567891',
        orderId: 'ORD-2024-002',
        userId: 'user456',
        userEmail: 'jane@test.com',
        amount: 99.99,
        currency: 'USD',
        status: 'completed',
        paymentMethod: 'stripe',
        plan: 'Premium Annual',
        createdAt: '2024-01-07 13:45:12',
        updatedAt: '2024-01-07 13:45:30',
        stripePaymentId: 'pi_1234567891',
        description: 'Annual subscription purchase'
      },
      {
        id: 'txn_1234567892',
        orderId: 'ORD-2024-003',
        userId: 'user789',
        userEmail: 'admin@site.com',
        amount: 19.99,
        currency: 'USD',
        status: 'pending',
        paymentMethod: 'stripe',
        plan: 'Basic Monthly',
        createdAt: '2024-01-07 12:20:18',
        updatedAt: '2024-01-07 12:20:18',
        stripePaymentId: 'pi_1234567892',
        description: 'Basic subscription renewal'
      },
      {
        id: 'txn_1234567893',
        orderId: 'ORD-2024-004',
        userId: 'user321',
        userEmail: 'test@demo.org',
        amount: 49.99,
        currency: 'USD',
        status: 'failed',
        paymentMethod: 'stripe',
        plan: 'Pro Monthly',
        createdAt: '2024-01-07 11:15:33',
        updatedAt: '2024-01-07 11:15:50',
        stripePaymentId: 'pi_1234567893',
        description: 'Pro subscription upgrade',
        failureReason: 'Insufficient funds'
      }
    ];

    // 应用筛选
    if (status !== 'all') {
      transactions = transactions.filter(t => t.status === status);
    }
    if (method !== 'all') {
      transactions = transactions.filter(t => t.paymentMethod === method);
    }
    if (search) {
      transactions = transactions.filter(t => 
        t.orderId.toLowerCase().includes(search.toLowerCase()) ||
        t.userEmail.toLowerCase().includes(search.toLowerCase()) ||
        t.plan.toLowerCase().includes(search.toLowerCase())
      );
    }

    // 分页
    const startIndex = (page - 1) * limit;
    const paginatedTransactions = transactions.slice(startIndex, startIndex + limit);

    // 模拟退款数据
    const refunds = [
      {
        id: 'ref_1234567890',
        transactionId: 'txn_1234567894',
        orderId: 'ORD-2024-005',
        userId: 'user654',
        userEmail: 'premium@user.net',
        originalAmount: 199.99,
        refundAmount: 199.99,
        currency: 'USD',
        status: 'completed',
        reason: 'Customer request',
        createdAt: '2024-01-07 09:30:15',
        processedAt: '2024-01-07 10:45:12',
        stripeRefundId: 'ref_1234567890',
        notes: 'Customer not satisfied with service'
      },
      {
        id: 'ref_1234567891',
        transactionId: 'txn_1234567895',
        orderId: 'ORD-2024-006',
        userId: 'user987',
        userEmail: 'refund@test.com',
        originalAmount: 29.99,
        refundAmount: 29.99,
        currency: 'USD',
        status: 'pending',
        reason: 'Billing error',
        createdAt: '2024-01-07 08:15:22',
        processedAt: null,
        stripeRefundId: null,
        notes: 'Duplicate charge reported by customer'
      }
    ];

    // 模拟订阅数据
    const subscriptions = [
      {
        id: 'sub_1234567890',
        userId: 'user123',
        userEmail: 'john@example.com',
        plan: 'Premium Monthly',
        status: 'active',
        amount: 29.99,
        currency: 'USD',
        interval: 'month',
        currentPeriodStart: '2024-01-07',
        currentPeriodEnd: '2024-02-07',
        cancelAtPeriodEnd: false,
        createdAt: '2023-12-07 14:30:25',
        stripeSubscriptionId: 'sub_1234567890'
      },
      {
        id: 'sub_1234567891',
        userId: 'user456',
        userEmail: 'jane@test.com',
        plan: 'Premium Annual',
        status: 'active',
        amount: 299.99,
        currency: 'USD',
        interval: 'year',
        currentPeriodStart: '2024-01-07',
        currentPeriodEnd: '2025-01-07',
        cancelAtPeriodEnd: false,
        createdAt: '2024-01-07 13:45:12',
        stripeSubscriptionId: 'sub_1234567891'
      }
    ];

    return {
      overview,
      transactions: paginatedTransactions,
      refunds,
      subscriptions,
      pagination: {
        page,
        limit,
        total: transactions.length,
        totalPages: Math.ceil(transactions.length / limit)
      }
    };

  } catch (error) {
    console.error('Get payments data error:', error);
    throw error;
  }
}

// 处理退款
async function processRefund(body: any) {
  try {
    const { transactionId, refundAmount, reason, notes } = body;
    
    // 这里应该调用支付服务提供商API处理退款
    // 模拟处理
    console.log('Processing refund:', { transactionId, refundAmount, reason, notes });
    
    // 模拟成功响应
    const refundId = `ref_${Date.now()}`;
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        refundId,
        status: 'pending',
        message: 'Refund request submitted successfully'
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Process refund error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to process refund',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 批准退款
async function approveRefund(body: any) {
  try {
    const { refundId } = body;
    
    // 这里应该调用支付服务提供商API批准退款
    // 模拟处理
    console.log('Approving refund:', refundId);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        refundId,
        status: 'completed',
        message: 'Refund approved and processed successfully'
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Approve refund error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to approve refund',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 取消订阅
async function cancelSubscription(body: any) {
  try {
    const { subscriptionId } = body;
    
    // 这里应该调用支付服务提供商API取消订阅
    // 模拟处理
    console.log('Canceling subscription:', subscriptionId);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        subscriptionId,
        status: 'canceled',
        message: 'Subscription canceled successfully'
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Cancel subscription error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to cancel subscription',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 导出支付报表
async function exportPayments(body: any) {
  try {
    const { timeRange, status } = body;
    
    // 这里应该生成CSV报表
    // 模拟CSV数据
    const csvData = [
      'Order ID,User Email,Amount,Currency,Status,Payment Method,Plan,Created At',
      'ORD-2024-001,john@example.com,29.99,USD,completed,stripe,Premium Monthly,2024-01-07 14:30:25',
      'ORD-2024-002,jane@test.com,99.99,USD,completed,stripe,Premium Annual,2024-01-07 13:45:12',
      'ORD-2024-003,admin@site.com,19.99,USD,pending,stripe,Basic Monthly,2024-01-07 12:20:18'
    ].join('\n');
    
    return new Response(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="payments_report_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
    
  } catch (error) {
    console.error('Export payments error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to export payments',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 更新交易
async function updateTransaction(body: any) {
  try {
    const { transactionId, updates } = body;
    
    // 这里应该更新数据库中的交易记录
    // 模拟处理
    console.log('Updating transaction:', transactionId, updates);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        transactionId,
        message: 'Transaction updated successfully'
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Update transaction error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to update transaction',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 批量操作
async function bulkAction(body: any) {
  try {
    const { action, transactionIds } = body;
    
    // 这里应该执行批量操作
    // 模拟处理
    console.log('Bulk action:', action, transactionIds);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        action,
        processedCount: transactionIds.length,
        message: `Bulk ${action} completed successfully`
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Bulk action error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to execute bulk action',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}