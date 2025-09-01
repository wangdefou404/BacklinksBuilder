import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabase';

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

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'createBackup':
        return await handleCreateBackup(user.id);
      case 'getBackupHistory':
        return await handleGetBackupHistory();
      case 'deleteBackup':
        return await handleDeleteBackup(body.backupId, user.id);
      case 'restoreBackup':
        return await handleRestoreBackup(body.backupId, user.id);
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('Error in backup API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// 创建备份
async function handleCreateBackup(adminId: string) {
  try {
    // 检查是否有正在进行的备份
    const { data: ongoingBackup, error: checkError } = await supabase
      .from('system_backups')
      .select('id')
      .eq('status', 'in_progress')
      .single();

    if (ongoingBackup) {
      return new Response(JSON.stringify({ 
        error: '已有备份任务正在进行中，请稍后再试' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 创建备份记录
    const backupId = `backup_${Date.now()}`;
    const { data: backup, error: insertError } = await supabase
      .from('system_backups')
      .insert({
        id: backupId,
        name: `手动备份_${new Date().toLocaleString('zh-CN')}`,
        type: 'manual',
        status: 'in_progress',
        created_by: adminId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // 异步执行备份任务
    performBackup(backupId).catch(error => {
      console.error('Backup failed:', error);
      // 更新备份状态为失败
      supabase
        .from('system_backups')
        .update({
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', backupId)
        .then(() => {});
    });

    // 记录管理员操作
    await logAdminAction(adminId, 'create_backup', {
      backupId,
      timestamp: new Date().toISOString()
    });

    return new Response(JSON.stringify({
      success: true,
      message: '备份任务已开始，请稍后查看备份状态',
      backupId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error creating backup:', error);
    return new Response(JSON.stringify({ error: '创建备份失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 获取备份历史
async function handleGetBackupHistory() {
  try {
    const { data: backups, error } = await supabase
      .from('system_backups')
      .select(`
        id,
        name,
        type,
        status,
        file_size,
        file_path,
        error_message,
        created_at,
        completed_at,
        created_by,
        users!system_backups_created_by_fkey(username)
      `)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    const formattedBackups = backups?.map(backup => ({
      ...backup,
      fileSizeFormatted: formatFileSize(backup.file_size),
      createdAtFormatted: formatDateTime(new Date(backup.created_at)),
      completedAtFormatted: backup.completed_at ? formatDateTime(new Date(backup.completed_at)) : null,
      duration: backup.completed_at ? 
        calculateDuration(new Date(backup.created_at), new Date(backup.completed_at)) : null
    })) || [];

    return new Response(JSON.stringify({
      success: true,
      backups: formattedBackups
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error getting backup history:', error);
    return new Response(JSON.stringify({ error: '获取备份历史失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 删除备份
async function handleDeleteBackup(backupId: string, adminId: string) {
  try {
    if (!backupId) {
      return new Response(JSON.stringify({ error: '备份ID不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查备份是否存在
    const { data: backup, error: fetchError } = await supabase
      .from('system_backups')
      .select('id, status, file_path')
      .eq('id', backupId)
      .single();

    if (fetchError || !backup) {
      return new Response(JSON.stringify({ error: '备份不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (backup.status === 'in_progress') {
      return new Response(JSON.stringify({ error: '无法删除正在进行的备份' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 删除备份文件（如果存在）
    if (backup.file_path) {
      await deleteBackupFile(backup.file_path);
    }

    // 删除备份记录
    const { error: deleteError } = await supabase
      .from('system_backups')
      .delete()
      .eq('id', backupId);

    if (deleteError) {
      throw deleteError;
    }

    // 记录管理员操作
    await logAdminAction(adminId, 'delete_backup', {
      backupId,
      timestamp: new Date().toISOString()
    });

    return new Response(JSON.stringify({
      success: true,
      message: '备份删除成功'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error deleting backup:', error);
    return new Response(JSON.stringify({ error: '删除备份失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 恢复备份
async function handleRestoreBackup(backupId: string, adminId: string) {
  try {
    if (!backupId) {
      return new Response(JSON.stringify({ error: '备份ID不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 检查备份是否存在且可用
    const { data: backup, error: fetchError } = await supabase
      .from('system_backups')
      .select('id, status, file_path, name')
      .eq('id', backupId)
      .single();

    if (fetchError || !backup) {
      return new Response(JSON.stringify({ error: '备份不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (backup.status !== 'completed') {
      return new Response(JSON.stringify({ error: '只能恢复已完成的备份' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!backup.file_path) {
      return new Response(JSON.stringify({ error: '备份文件不存在' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 创建恢复任务记录
    const restoreId = `restore_${Date.now()}`;
    await supabase
      .from('system_restores')
      .insert({
        id: restoreId,
        backup_id: backupId,
        status: 'in_progress',
        created_by: adminId,
        created_at: new Date().toISOString()
      });

    // 异步执行恢复任务
    performRestore(restoreId, backup.file_path).catch(error => {
      console.error('Restore failed:', error);
      // 更新恢复状态为失败
      supabase
        .from('system_restores')
        .update({
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', restoreId)
        .then(() => {});
    });

    // 记录管理员操作
    await logAdminAction(adminId, 'restore_backup', {
      backupId,
      restoreId,
      backupName: backup.name,
      timestamp: new Date().toISOString()
    });

    return new Response(JSON.stringify({
      success: true,
      message: '恢复任务已开始，系统将在恢复完成后重启',
      restoreId
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error restoring backup:', error);
    return new Response(JSON.stringify({ error: '恢复备份失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 执行备份任务
async function performBackup(backupId: string) {
  try {
    // 更新备份状态
    await supabase
      .from('system_backups')
      .update({ status: 'in_progress' })
      .eq('id', backupId);

    // 获取需要备份的表
    const tables = [
      'users', 'user_subscriptions', 'subscription_plans', 
      'user_quotas', 'quota_definitions', 'system_settings'
    ];

    const backupData: any = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      tables: {}
    };

    // 备份每个表的数据
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*');

        if (error) {
          console.error(`Error backing up table ${table}:`, error);
          continue;
        }

        backupData.tables[table] = data;
      } catch (error) {
        console.error(`Error backing up table ${table}:`, error);
      }
    }

    // 计算备份文件大小
    const backupJson = JSON.stringify(backupData);
    const fileSize = Buffer.byteLength(backupJson, 'utf8');
    const filePath = `backups/${backupId}.json`;

    // 在实际项目中，这里应该将备份数据保存到文件系统或云存储
    // 目前我们只是模拟保存过程
    await new Promise(resolve => setTimeout(resolve, 2000)); // 模拟备份时间

    // 更新备份记录
    await supabase
      .from('system_backups')
      .update({
        status: 'completed',
        file_size: fileSize,
        file_path: filePath,
        completed_at: new Date().toISOString()
      })
      .eq('id', backupId);

    // 更新最后备份时间设置
    await supabase
      .from('system_settings')
      .upsert({
        key: 'backup.lastBackupTime',
        value: new Date().toISOString(),
        category: 'backup'
      });

    console.log(`Backup ${backupId} completed successfully`);

  } catch (error) {
    console.error(`Backup ${backupId} failed:`, error);
    throw error;
  }
}

// 执行恢复任务
async function performRestore(restoreId: string, filePath: string) {
  try {
    // 在实际项目中，这里应该从文件系统或云存储读取备份数据
    // 目前我们只是模拟恢复过程
    await new Promise(resolve => setTimeout(resolve, 3000)); // 模拟恢复时间

    // 更新恢复状态
    await supabase
      .from('system_restores')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', restoreId);

    console.log(`Restore ${restoreId} completed successfully`);

  } catch (error) {
    console.error(`Restore ${restoreId} failed:`, error);
    throw error;
  }
}

// 删除备份文件
async function deleteBackupFile(filePath: string) {
  try {
    // 在实际项目中，这里应该删除文件系统或云存储中的备份文件
    console.log(`Deleting backup file: ${filePath}`);
  } catch (error) {
    console.error('Error deleting backup file:', error);
  }
}

// 记录管理员操作日志
async function logAdminAction(adminId: string, action: string, details: any) {
  try {
    await supabase
      .from('admin_logs')
      .insert({
        admin_id: adminId,
        action,
        details,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error logging admin action:', error);
  }
}

// 格式化文件大小
function formatFileSize(bytes: number | null): string {
  if (!bytes) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

// 格式化日期时间
function formatDateTime(date: Date): string {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// 计算持续时间
function calculateDuration(start: Date, end: Date): string {
  const diffMs = end.getTime() - start.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  
  if (diffHours > 0) {
    return `${diffHours}小时${diffMinutes % 60}分钟`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes}分钟${diffSeconds % 60}秒`;
  } else {
    return `${diffSeconds}秒`;
  }
}