#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// 日志工具
const log = {
  info: (msg) => console.log(`${colors.blue}ℹ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  section: (title) => console.log(`\n${colors.cyan}=== ${title} ===${colors.reset}`),
  title: (title) => console.log(`\n${colors.magenta}🔍 ${title}${colors.reset}`)
};

// 加载环境变量
function loadEnvironmentVariables() {
  const envPath = path.join(process.cwd(), '.env.local');
  const envVars = {};
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      }
    });
  }
  
  // 合并 process.env
  Object.assign(envVars, process.env);
  
  return envVars;
}

// 标准化环境变量
function normalizeEnvironmentVariables(envVars) {
  const normalized = { ...envVars };
  
  // 映射 PUBLIC_ 前缀到 NEXT_PUBLIC_
  if (envVars.PUBLIC_SUPABASE_URL && !envVars.NEXT_PUBLIC_SUPABASE_URL) {
    normalized.NEXT_PUBLIC_SUPABASE_URL = envVars.PUBLIC_SUPABASE_URL;
  }
  if (envVars.PUBLIC_SUPABASE_ANON_KEY && !envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    normalized.NEXT_PUBLIC_SUPABASE_ANON_KEY = envVars.PUBLIC_SUPABASE_ANON_KEY;
  }
  if (envVars.PUBLIC_STRIPE_PUBLISHABLE_KEY && !envVars.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    normalized.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = envVars.PUBLIC_STRIPE_PUBLISHABLE_KEY;
  }
  
  return normalized;
}

// 深度认证诊断类
class DeepAuthDiagnosis {
  constructor() {
    this.envVars = normalizeEnvironmentVariables(loadEnvironmentVariables());
    this.issues = [];
    this.fixes = [];
    this.supabaseClient = null;
    this.adminClient = null;
  }
  
  addIssue(category, message, severity = 'error', details = null) {
    this.issues.push({ category, message, severity, details });
    if (severity === 'error') {
      log.error(`${category}: ${message}`);
    } else {
      log.warning(`${category}: ${message}`);
    }
  }
  
  addFix(description, command = null, sql = null) {
    this.fixes.push({ description, command, sql });
  }
  
  // 1. 初始化Supabase客户端
  async initializeClients() {
    log.title('初始化Supabase客户端');
    
    if (!this.envVars.NEXT_PUBLIC_SUPABASE_URL || !this.envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      this.addIssue('客户端初始化', '缺少基本的Supabase配置');
      return false;
    }
    
    try {
      // 普通客户端（anon key）
      this.supabaseClient = createClient(
        this.envVars.NEXT_PUBLIC_SUPABASE_URL,
        this.envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      log.success('Supabase客户端初始化成功');
      
      // 管理员客户端（service role key）
      if (this.envVars.SUPABASE_SERVICE_ROLE_KEY) {
        this.adminClient = createClient(
          this.envVars.NEXT_PUBLIC_SUPABASE_URL,
          this.envVars.SUPABASE_SERVICE_ROLE_KEY
        );
        log.success('Supabase管理员客户端初始化成功');
      } else {
        this.addIssue('客户端初始化', '缺少SERVICE_ROLE_KEY，无法进行深度检查', 'warning');
      }
      
      return true;
    } catch (error) {
      this.addIssue('客户端初始化', `初始化失败: ${error.message}`);
      return false;
    }
  }
  
  // 2. 检查用户表结构
  async checkUsersTableStructure() {
    log.title('检查用户表结构');
    
    if (!this.adminClient) {
      this.addIssue('表结构检查', '需要管理员权限检查表结构', 'warning');
      return;
    }
    
    try {
      // 检查users表是否存在
      const { data: tableExists, error: tableError } = await this.adminClient
        .rpc('exec_sql', {
          sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'"
        });
        
      if (tableError) {
        this.addIssue('表结构检查', `检查users表失败: ${tableError.message}`);
        return;
      }
      
      if (!tableExists || tableExists.length === 0) {
        this.addIssue('表结构检查', 'users表不存在');
        this.addFix('创建users表', null, `
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
`);
        return;
      }
      
      log.success('users表存在');
      
      // 检查users表的列结构
      const { data: columns, error: columnsError } = await this.adminClient
        .rpc('exec_sql', {
          sql: "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users'"
        });
        
      if (columnsError) {
        this.addIssue('表结构检查', `检查users表列失败: ${columnsError.message}`);
        return;
      }
      
      const columnNames = columns.map(col => col.column_name);
      const requiredColumns = ['id', 'email', 'created_at'];
      const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
      
      if (missingColumns.length > 0) {
        this.addIssue('表结构检查', `users表缺少必需列: ${missingColumns.join(', ')}`);
        missingColumns.forEach(col => {
          let sql = '';
          switch (col) {
            case 'id':
              sql = 'ALTER TABLE public.users ADD COLUMN id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY;';
              break;
            case 'email':
              sql = 'ALTER TABLE public.users ADD COLUMN email TEXT UNIQUE NOT NULL;';
              break;
            case 'created_at':
              sql = 'ALTER TABLE public.users ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();';
              break;
          }
          this.addFix(`添加${col}列`, null, sql);
        });
      } else {
        log.success('users表结构完整');
      }
      
    } catch (error) {
      this.addIssue('表结构检查', `检查失败: ${error.message}`);
    }
  }
  
  // 3. 检查用户表权限
  async checkUsersTablePermissions() {
    log.title('检查用户表权限');
    
    if (!this.adminClient) {
      this.addIssue('权限检查', '需要管理员权限检查表权限', 'warning');
      return;
    }
    
    try {
      // 检查表权限
      const { data: permissions, error: permError } = await this.adminClient
        .rpc('exec_sql', {
          sql: "SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'users' AND grantee IN ('anon', 'authenticated')"
        });
        
      if (permError) {
        this.addIssue('权限检查', `检查权限失败: ${permError.message}`);
        return;
      }
      
      const anonPerms = permissions.filter(p => p.grantee === 'anon').map(p => p.privilege_type);
      const authPerms = permissions.filter(p => p.grantee === 'authenticated').map(p => p.privilege_type);
      
      log.info(`anon角色权限: ${anonPerms.join(', ') || '无'}`);
      log.info(`authenticated角色权限: ${authPerms.join(', ') || '无'}`);
      
      if (!anonPerms.includes('SELECT')) {
        this.addIssue('权限检查', 'anon角色缺少SELECT权限');
        this.addFix('授予anon角色SELECT权限', null, 'GRANT SELECT ON public.users TO anon;');
      }
      
      if (!authPerms.includes('SELECT') || !authPerms.includes('INSERT') || !authPerms.includes('UPDATE')) {
        this.addIssue('权限检查', 'authenticated角色缺少必要权限');
        this.addFix('授予authenticated角色完整权限', null, 'GRANT ALL PRIVILEGES ON public.users TO authenticated;');
      }
      
      if (anonPerms.includes('SELECT') && authPerms.includes('SELECT')) {
        log.success('用户表权限配置正确');
      }
      
    } catch (error) {
      this.addIssue('权限检查', `检查失败: ${error.message}`);
    }
  }
  
  // 4. 检查RLS策略
  async checkRLSPolicies() {
    log.title('检查RLS策略');
    
    if (!this.adminClient) {
      this.addIssue('RLS检查', '需要管理员权限检查RLS策略', 'warning');
      return;
    }
    
    try {
      // 检查RLS是否启用
      const { data: rlsStatus, error: rlsError } = await this.adminClient
        .rpc('exec_sql', {
          sql: "SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'users' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')"
        });
        
      if (rlsError) {
        this.addIssue('RLS检查', `检查RLS状态失败: ${rlsError.message}`);
        return;
      }
      
      if (rlsStatus && rlsStatus.length > 0) {
        const isRLSEnabled = rlsStatus[0].relrowsecurity;
        log.info(`users表RLS状态: ${isRLSEnabled ? '启用' : '禁用'}`);
        
        if (isRLSEnabled) {
          // 检查RLS策略
          const { data: policies, error: policiesError } = await this.adminClient
            .rpc('exec_sql', {
              sql: "SELECT policyname, permissive, roles, cmd, qual FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users'"
            });
            
          if (policiesError) {
            this.addIssue('RLS检查', `检查RLS策略失败: ${policiesError.message}`);
            return;
          }
          
          log.info(`找到${policies.length}个RLS策略`);
          policies.forEach(policy => {
            log.info(`策略: ${policy.policyname} (${policy.cmd}) - 角色: ${policy.roles}`);
          });
          
          // 检查是否有允许插入的策略
          const insertPolicies = policies.filter(p => p.cmd === 'INSERT');
          if (insertPolicies.length === 0) {
            this.addIssue('RLS检查', '缺少INSERT策略，可能导致用户注册失败');
            this.addFix('添加INSERT策略', null, `
CREATE POLICY "users_insert_policy" ON public.users
  FOR INSERT
  WITH CHECK (true);
`);
          }
        } else {
          log.warning('users表RLS未启用，所有操作都被允许');
        }
      }
      
    } catch (error) {
      this.addIssue('RLS检查', `检查失败: ${error.message}`);
    }
  }
  
  // 5. 测试用户注册流程
  async testUserRegistration() {
    log.title('测试用户注册流程');
    
    if (!this.supabaseClient) {
      this.addIssue('注册测试', 'Supabase客户端未初始化');
      return;
    }
    
    try {
      const testEmail = `testuser${Date.now()}@gmail.com`;
      const testPassword = 'TestPassword123!';
      
      log.info(`尝试注册测试用户: ${testEmail}`);
      
      // 尝试注册
      const { data: signUpData, error: signUpError } = await this.supabaseClient.auth.signUp({
        email: testEmail,
        password: testPassword,
        options: {
          data: {
            full_name: 'Test User'
          }
        }
      });
      
      if (signUpError) {
        log.error(`注册错误详情: ${JSON.stringify(signUpError, null, 2)}`);
        if (signUpError.message.includes('rate limit') || signUpError.message.includes('too many')) {
          log.warning('注册受到速率限制（这是正常的）');
        } else if (signUpError.message.includes('Database error')) {
          this.addIssue('注册测试', `数据库错误: ${signUpError.message}`);
          this.addFix('检查数据库权限和RLS策略', 'pnpm fix:permissions');
          this.addFix('检查auth.users表上的触发器', 'SELECT * FROM information_schema.triggers WHERE event_object_schema = \'auth\' AND event_object_table = \'users\'');
        } else if (signUpError.message.includes('Invalid email')) {
          this.addIssue('注册测试', '邮箱验证配置问题');
        } else {
          this.addIssue('注册测试', `注册失败: ${signUpError.message}`);
        }
      } else {
        log.success('用户注册测试成功');
        if (signUpData.user) {
          log.info(`用户ID: ${signUpData.user.id}`);
          log.info(`邮箱: ${signUpData.user.email}`);
        }
      }
      
    } catch (error) {
      this.addIssue('注册测试', `测试失败: ${error.message}`);
    }
  }
  
  // 6. 测试数据库直接插入
  async testDirectDatabaseInsert() {
    log.title('测试数据库直接插入');
    
    if (!this.supabaseClient) {
      this.addIssue('数据库插入测试', 'Supabase客户端未初始化');
      return;
    }
    
    try {
      const testUserId = crypto.randomUUID();
      const testEmail = `directtest${Date.now()}@gmail.com`;
      
      log.info(`尝试直接插入测试用户: ${testEmail}`);
      
      // 尝试直接插入users表
      const { data: insertData, error: insertError } = await this.supabaseClient
        .from('users')
        .insert({
          id: testUserId,
          email: testEmail,
          full_name: 'Direct Test User',
          provider: 'email',
          password_hash: '$2b$10$test.hash.for.testing.purposes.only'
        })
        .select();
        
      if (insertError) {
        this.addIssue('数据库插入测试', `直接插入失败: ${insertError.message}`);
        if (insertError.message.includes('permission denied')) {
          this.addFix('修复表权限', 'pnpm fix:permissions');
        }
      } else {
        log.success('数据库直接插入成功');
        if (insertData && insertData.length > 0) {
          log.info(`插入的用户: ${JSON.stringify(insertData[0], null, 2)}`);
          
          // 清理测试数据
          await this.supabaseClient
            .from('users')
            .delete()
            .eq('id', testUserId);
          log.info('测试数据已清理');
        }
      }
      
    } catch (error) {
      this.addIssue('数据库插入测试', `测试失败: ${error.message}`);
    }
  }
  
  // 7. 检查触发器和函数
  async checkTriggersAndFunctions() {
    log.title('检查触发器和函数');
    
    if (!this.adminClient) {
      this.addIssue('触发器检查', '需要管理员权限检查触发器', 'warning');
      return;
    }
    
    try {
      // 检查auth.users表上的触发器（这可能导致注册失败）
      const { data: authTriggers, error: authTriggersError } = await this.adminClient
        .rpc('exec_sql', {
          sql: "SELECT trigger_name, event_manipulation, action_statement FROM information_schema.triggers WHERE event_object_schema = 'auth' AND event_object_table = 'users'"
        });
        
      if (authTriggersError) {
        this.addIssue('Auth触发器检查', `检查auth.users触发器失败: ${authTriggersError.message}`);
      } else {
        log.info(`auth.users表上找到${authTriggers.length}个触发器`);
        authTriggers.forEach(trigger => {
          log.info(`Auth触发器: ${trigger.trigger_name} (${trigger.event_manipulation})`);
          if (trigger.action_statement.includes('handle_new_user')) {
            log.warning('发现可能有问题的触发器: handle_new_user');
            this.addIssue('Auth触发器', 'auth.users表上的handle_new_user触发器可能导致注册失败');
            this.addFix('移除有问题的触发器', 'DROP TRIGGER IF EXISTS handle_new_user ON auth.users;');
          }
        });
      }
      
      // 检查与public.users表相关的触发器
      const { data: triggers, error: triggersError } = await this.adminClient
        .rpc('exec_sql', {
          sql: "SELECT trigger_name, event_manipulation, action_statement FROM information_schema.triggers WHERE event_object_schema = 'public' AND event_object_table = 'users'"
        });
        
      if (triggersError) {
        this.addIssue('触发器检查', `检查触发器失败: ${triggersError.message}`);
        return;
      }
      
      log.info(`public.users表上找到${triggers.length}个触发器`);
      triggers.forEach(trigger => {
        log.info(`触发器: ${trigger.trigger_name} (${trigger.event_manipulation})`);
      });
      
      // 检查handle_new_user函数
      const { data: functions, error: functionsError } = await this.adminClient
        .rpc('exec_sql', {
          sql: "SELECT routine_name, routine_type FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE '%user%'"
        });
        
      if (functionsError) {
        this.addIssue('函数检查', `检查函数失败: ${functionsError.message}`);
        return;
      }
      
      log.info(`找到${functions.length}个用户相关函数`);
      functions.forEach(func => {
        log.info(`函数: ${func.routine_name} (${func.routine_type})`);
      });
      
    } catch (error) {
      this.addIssue('触发器检查', `检查失败: ${error.message}`);
    }
  }
  
  // 生成报告
  generateReport() {
    log.title('诊断报告');
    
    const errorCount = this.issues.filter(i => i.severity === 'error').length;
    const warningCount = this.issues.filter(i => i.severity === 'warning').length;
    
    console.log(`\n发现问题总数: ${this.issues.length}`);
    console.log(`严重错误: ${errorCount}`);
    console.log(`警告: ${warningCount}`);
    
    if (this.issues.length > 0) {
      console.log('\n问题详情:');
      this.issues.forEach((issue, index) => {
        const icon = issue.severity === 'error' ? '❌' : '⚠️';
        console.log(`${index + 1}. ${icon} [${issue.category}] ${issue.message}`);
      });
    }
    
    if (this.fixes.length > 0) {
      console.log('\n修复建议:');
      this.fixes.forEach((fix, index) => {
        console.log(`${index + 1}. ${fix.description}`);
        if (fix.command) {
          console.log(`   命令: ${fix.command}`);
        }
        if (fix.sql) {
          console.log(`   SQL: ${fix.sql}`);
        }
      });
    }
    
    // 保存详细报告
    const reportPath = path.join(process.cwd(), 'deep-auth-diagnosis-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.issues.length,
        errors: errorCount,
        warnings: warningCount
      },
      issues: this.issues,
      fixes: this.fixes,
      environment: this.envVars
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 详细报告已保存到: ${reportPath}`);
    
    return errorCount;
  }
  
  // 运行所有诊断
  async runDiagnosis() {
    log.title('开始深度认证诊断');
    
    const initialized = await this.initializeClients();
    if (!initialized) {
      return this.generateReport();
    }
    
    await this.checkUsersTableStructure();
    await this.checkUsersTablePermissions();
    await this.checkRLSPolicies();
    await this.testUserRegistration();
    await this.testDirectDatabaseInsert();
    await this.checkTriggersAndFunctions();
    
    return this.generateReport();
  }
}

// 主函数
async function main() {
  console.log(`${colors.magenta}🔍 深度认证诊断开始...${colors.reset}\n`);
  
  const diagnosis = new DeepAuthDiagnosis();
  const errorCount = await diagnosis.runDiagnosis();
  
  console.log(`\n${colors.magenta}🏁 深度认证诊断完成！${colors.reset}`);
  
  // 退出码
  process.exit(errorCount > 0 ? 1 : 0);
}

// 错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的 Promise 拒绝:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

// 运行主函数
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { DeepAuthDiagnosis };