import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fmkekjlsfnvubnvurhbt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZta2VramxzZm52dWJudnVyaGJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzI2NzU0NCwiZXhwIjoyMDY4ODQzNTQ0fQ.fcRzWgH972dC5r65kSKQbTBWlvE-L3Osk2UQgvsjYn0';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugNewUser() {
  try {
    console.log('=== 查询新用户信息 ===');
    
    // 先尝试通过API获取用户信息
    console.log('尝试通过现有用户查找新用户...');
    
    // 查询所有用户角色，看看是否有新用户
    const { data: allRoles, error: allRolesError } = await supabase
      .from('user_roles')
      .select('user_id, role, granted_at')
      .order('granted_at', { ascending: false })
      .limit(10);
    
    if (allRolesError) {
      console.error('查询所有角色失败:', allRolesError);
    } else {
      console.log('最近的用户角色:', allRoles);
    }
    
    // 假设我们知道用户ID，让我们测试一个已知的用户ID
    // 这里我们需要从日志或其他方式获取实际的用户ID
    console.log('\n=== 测试角色获取功能 ===');
    
    // 如果有角色记录，使用第一个用户ID进行测试
    if (allRoles && allRoles.length > 0) {
      const testUserId = allRoles[0].user_id;
      console.log('测试用户ID:', testUserId);
    
      // 查询该用户的详细角色信息
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', testUserId);
      
      if (rolesError) {
        console.error('查询用户角色失败:', rolesError);
      } else {
        console.log('用户角色详情:', roles);
      }
      
      // 测试get_user_active_role函数
      const { data: activeRole, error: activeRoleError } = await supabase
        .rpc('get_user_active_role', {
          p_user_id: testUserId
        });
      
      if (activeRoleError) {
        console.error('获取活跃角色失败:', activeRoleError);
      } else {
        console.log('活跃角色:', activeRole);
      }
      
      // 查询用户配额
      const { data: quotas, error: quotasError } = await supabase
        .from('user_quotas')
        .select('*')
        .eq('user_id', testUserId);
      
      if (quotasError) {
        console.error('查询用户配额失败:', quotasError);
      } else {
        console.log('用户配额:', quotas);
      }
    } else {
      console.log('没有找到任何用户角色记录');
    }
    
  } catch (error) {
    console.error('调试过程中出错:', error);
  }
}

debugNewUser();