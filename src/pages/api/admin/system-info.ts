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

    // 获取系统信息
    const systemInfo = await getSystemInfo();

    return new Response(JSON.stringify(systemInfo), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in system info API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// 获取系统信息
async function getSystemInfo() {
  const info: any = {
    version: '1.0.0',
    uptime: getUptime(),
    databaseSize: await getDatabaseSize(),
    storageUsed: await getStorageUsed(),
    lastBackupTime: await getLastBackupTime(),
    systemHealth: await getSystemHealth(),
    performance: await getPerformanceMetrics()
  };

  return info;
}

// 获取系统运行时间
function getUptime(): string {
  const uptime = process.uptime();
  const days = Math.floor(uptime / 86400);
  const hours = Math.floor((uptime % 86400) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  
  if (days > 0) {
    return `${days}天 ${hours}小时`;
  } else if (hours > 0) {
    return `${hours}小时 ${minutes}分钟`;
  } else {
    return `${minutes}分钟`;
  }
}

// 获取数据库大小
async function getDatabaseSize(): Promise<string> {
  try {
    // 获取主要表的行数统计
    const tables = ['users', 'user_subscriptions', 'subscription_plans', 'user_quotas', 'quota_definitions'];
    let totalRows = 0;
    
    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (!error && count !== null) {
          totalRows += count;
        }
      } catch (error) {
        console.error(`Error counting ${table}:`, error);
      }
    }
    
    // 估算数据库大小（简化计算）
    const estimatedSizeMB = Math.round(totalRows * 0.001); // 假设每行约1KB
    
    if (estimatedSizeMB < 1) {
      return '< 1 MB';
    } else if (estimatedSizeMB < 1024) {
      return `${estimatedSizeMB} MB`;
    } else {
      return `${(estimatedSizeMB / 1024).toFixed(1)} GB`;
    }
  } catch (error) {
    console.error('Error getting database size:', error);
    return '未知';
  }
}

// 获取存储使用情况
async function getStorageUsed(): Promise<string> {
  try {
    // 这里可以实现实际的存储使用情况检查
    // 目前返回模拟数据
    return '125 MB';
  } catch (error) {
    console.error('Error getting storage usage:', error);
    return '未知';
  }
}

// 获取最后备份时间
async function getLastBackupTime(): Promise<string> {
  try {
    // 从系统设置或备份日志中获取最后备份时间
    const { data: backupSetting, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'backup.lastBackupTime')
      .single();
    
    if (error || !backupSetting) {
      return '从未备份';
    }
    
    const lastBackupTime = new Date(backupSetting.value);
    return formatDateTime(lastBackupTime);
  } catch (error) {
    console.error('Error getting last backup time:', error);
    return '未知';
  }
}

// 获取系统健康状态
async function getSystemHealth(): Promise<any> {
  const health = {
    database: 'healthy',
    api: 'healthy',
    storage: 'healthy',
    overall: 'healthy'
  };
  
  try {
    // 测试数据库连接
    const { error: dbError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
    
    if (dbError) {
      health.database = 'error';
      health.overall = 'warning';
    }
    
    // 这里可以添加更多健康检查
    
  } catch (error) {
    console.error('Error checking system health:', error);
    health.overall = 'error';
  }
  
  return health;
}

// 获取性能指标
async function getPerformanceMetrics(): Promise<any> {
  try {
    const metrics = {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      activeConnections: await getActiveConnections(),
      requestsPerMinute: await getRequestsPerMinute()
    };
    
    return {
      memoryUsed: `${Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024)} MB`,
      memoryTotal: `${Math.round(metrics.memoryUsage.heapTotal / 1024 / 1024)} MB`,
      activeConnections: metrics.activeConnections,
      requestsPerMinute: metrics.requestsPerMinute
    };
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    return {
      memoryUsed: '未知',
      memoryTotal: '未知',
      activeConnections: 0,
      requestsPerMinute: 0
    };
  }
}

// 获取活跃连接数
async function getActiveConnections(): Promise<number> {
  try {
    // 获取最近5分钟内活跃的用户数
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('last_activity', fiveMinutesAgo);
    
    if (error) {
      console.error('Error getting active connections:', error);
      return 0;
    }
    
    return count || 0;
  } catch (error) {
    console.error('Error getting active connections:', error);
    return 0;
  }
}

// 获取每分钟请求数
async function getRequestsPerMinute(): Promise<number> {
  try {
    // 这里可以实现实际的请求统计
    // 目前返回模拟数据
    return Math.floor(Math.random() * 100) + 50;
  } catch (error) {
    console.error('Error getting requests per minute:', error);
    return 0;
  }
}

// 格式化日期时间
function formatDateTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffDays > 0) {
    return `${diffDays}天前`;
  } else if (diffHours > 0) {
    return `${diffHours}小时前`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes}分钟前`;
  } else {
    return '刚刚';
  }
}