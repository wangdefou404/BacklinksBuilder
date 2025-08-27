#!/usr/bin/env node

/**
 * 全面系统检查脚本
 * 检查OAuth、数据库、权限、触发器等所有关键组件
 * 作者: SOLO Coding
 * 创建时间: 2025-08-27
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 加载环境变量
dotenv.config();

// 加载 .env.local 文件
function loadEnvironmentVariables() {
  const envFiles = ['.env.local', '.env', '.env.production'];
  const envVars = {};
  
  for (const file of envFiles) {
    const envPath = path.join(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#') && trimmedLine.includes('=')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          envVars[key.trim()] = value.trim();
        }
      }
      break; // 使用找到的第一个文件
    }
  }
  
  // 合并到 process.env
  Object.assign(process.env, envVars);
  return envVars;
}

// 加载环境变量
loadEnvironmentVariables();

class ComprehensiveSystemCheck {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.fixes = [];
    this.log = {
      info: (msg) => console.log(`ℹ ${msg}`),
      success: (msg) => console.log(`✅ ${msg}`),
      warning: (msg) => console.log(`⚠️  ${msg}`),
      error: (msg) => console.log(`❌ ${msg}`),
      section: (msg) => console.log(`\n🔍 ${msg}`)
    };
  }

  addIssue(type, category, message, fix = null) {
    const issue = { type, category, message, timestamp: new Date().toISOString() };
    if (type === 'error') {
      this.issues.push(issue);
      this.log.error(`[${category}] ${message}`);
    } else {
      this.warnings.push(issue);
      this.log.warning(`[${category}] ${message}`);
    }
    if (fix) {
      this.fixes.push(fix);
    }
  }

  async initializeClients() {
    try {
      // 初始化Supabase客户端
      const supabaseUrl = process.env.PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('缺少Supabase配置');
      }

      this.supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
      this.supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
      
      this.log.success('Supabase客户端初始化成功');
      return true;
    } catch (error) {
      this.addIssue('error', '初始化', `客户端初始化失败: ${error.message}`);
      return false;
    }
  }

  async checkEnvironmentVariables() {
    this.log.section('检查环境变量配置');
    
    const requiredVars = [
      'PUBLIC_SUPABASE_URL',
      'PUBLIC_SUPABASE_ANON_KEY', 
      'SUPABASE_SERVICE_ROLE_KEY',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET'
    ];

    const optionalVars = [
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL',
      'STRIPE_SECRET_KEY',
      'STRIPE_PUBLISHABLE_KEY'
    ];

    for (const varName of requiredVars) {
      const value = process.env[varName] || process.env[`NEXT_${varName}`];
      if (!value) {
        this.addIssue('error', '环境变量', `缺少必需的环境变量: ${varName}`);
      } else {
        this.log.success(`${varName}: 已配置`);
      }
    }

    for (const varName of optionalVars) {
      const value = process.env[varName];
      if (!value) {
        this.addIssue('warning', '环境变量', `可选环境变量未配置: ${varName}`);
      } else {
        this.log.success(`${varName}: 已配置`);
      }
    }
  }

  async checkSupabaseConnection() {
    this.log.section('检查Supabase连接');
    
    try {
      // 测试基本连接
      const { data, error } = await this.supabaseClient
        .from('users')
        .select('count')
        .limit(1);
      
      if (error) {
        this.addIssue('error', 'Supabase连接', `连接失败: ${error.message}`);
        return false;
      }
      
      this.log.success('Supabase连接正常');
      return true;
    } catch (error) {
      this.addIssue('error', 'Supabase连接', `连接异常: ${error.message}`);
      return false;
    }
  }

  async checkDatabaseTables() {
    this.log.section('检查数据库表结构');
    
    const requiredTables = [
      'users',
      'user_quotas', 
      'user_access_logs',
      'user_profiles',
      'backlinks',
      'backlink_requests'
    ];

    for (const tableName of requiredTables) {
      try {
        const { data, error } = await this.supabaseAdmin.rpc('exec_sql', {
          sql: `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${tableName}' ORDER BY ordinal_position`
        });
        
        if (error || !data || data.length === 0) {
          this.addIssue('error', '数据库表', `表 ${tableName} 不存在或无法访问`);
        } else {
          this.log.success(`表 ${tableName}: ${data.length} 个字段`);
        }
      } catch (error) {
        this.addIssue('error', '数据库表', `检查表 ${tableName} 时出错: ${error.message}`);
      }
    }
  }

  async checkTablePermissions() {
    this.log.section('检查表权限');
    
    const tables = ['users', 'user_quotas', 'user_profiles', 'backlinks', 'backlink_requests'];
    const roles = ['anon', 'authenticated'];

    for (const tableName of tables) {
      try {
        const { data, error } = await this.supabaseAdmin.rpc('exec_sql', {
          sql: `SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = '${tableName}' AND grantee IN ('anon', 'authenticated')`
        });
        
        if (error) {
          this.addIssue('error', '表权限', `检查表 ${tableName} 权限失败: ${error.message}`);
          continue;
        }
        
        const permissions = data || [];
        const hasAnonAccess = permissions.some(p => p.grantee === 'anon');
        const hasAuthAccess = permissions.some(p => p.grantee === 'authenticated');
        
        if (!hasAnonAccess && !hasAuthAccess) {
          this.addIssue('error', '表权限', `表 ${tableName} 缺少基本权限`, 
            `GRANT SELECT ON ${tableName} TO anon; GRANT ALL ON ${tableName} TO authenticated;`);
        } else {
          this.log.success(`表 ${tableName}: 权限配置正常`);
        }
      } catch (error) {
        this.addIssue('error', '表权限', `检查表 ${tableName} 权限时出错: ${error.message}`);
      }
    }
  }

  async checkRLSPolicies() {
    this.log.section('检查RLS策略');
    
    const tables = ['users', 'user_quotas', 'user_profiles', 'backlinks', 'backlink_requests'];
    
    for (const tableName of tables) {
      try {
        // 检查RLS是否启用
        const { data: rlsData, error: rlsError } = await this.supabaseAdmin.rpc('exec_sql', {
          sql: `SELECT relrowsecurity FROM pg_class WHERE relname = '${tableName}' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')`
        });
        
        if (rlsError || !rlsData || rlsData.length === 0) {
          this.addIssue('error', 'RLS策略', `无法检查表 ${tableName} 的RLS状态`);
          continue;
        }
        
        const rlsEnabled = rlsData[0]?.relrowsecurity;
        if (!rlsEnabled) {
          this.addIssue('warning', 'RLS策略', `表 ${tableName} 未启用RLS`, 
            `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;`);
        }
        
        // 检查策略
        const { data: policies, error: policiesError } = await this.supabaseAdmin.rpc('exec_sql', {
          sql: `SELECT policyname, cmd, roles FROM pg_policies WHERE schemaname = 'public' AND tablename = '${tableName}'`
        });
        
        if (policiesError) {
          this.addIssue('error', 'RLS策略', `检查表 ${tableName} 策略失败: ${policiesError.message}`);
        } else {
          const policyCount = policies?.length || 0;
          if (policyCount === 0) {
            this.addIssue('warning', 'RLS策略', `表 ${tableName} 没有RLS策略`);
          } else {
            this.log.success(`表 ${tableName}: ${policyCount} 个RLS策略`);
          }
        }
      } catch (error) {
        this.addIssue('error', 'RLS策略', `检查表 ${tableName} RLS时出错: ${error.message}`);
      }
    }
  }

  async checkAuthTriggers() {
    this.log.section('检查认证触发器');
    
    try {
      // 检查auth.users表上的触发器
      const { data: authTriggers, error: authError } = await this.supabaseAdmin.rpc('exec_sql', {
        sql: `SELECT trigger_name, event_manipulation FROM information_schema.triggers WHERE event_object_schema = 'auth' AND event_object_table = 'users'`
      });
      
      if (authError) {
        this.addIssue('error', '认证触发器', `检查auth.users触发器失败: ${authError.message}`);
      } else {
        const triggerCount = authTriggers?.length || 0;
        this.log.info(`auth.users表上找到${triggerCount}个触发器`);
        
        // 检查是否有可能导致问题的触发器
        const problematicTriggers = authTriggers?.filter(t => 
          t.trigger_name.includes('handle_new_user') || 
          t.trigger_name.includes('on_auth_user_created')
        ) || [];
        
        if (problematicTriggers.length > 0) {
          this.addIssue('warning', '认证触发器', 
            `发现可能有问题的auth触发器: ${problematicTriggers.map(t => t.trigger_name).join(', ')}`,
            'DROP TRIGGER IF EXISTS handle_new_user ON auth.users;');
        } else {
          this.log.success('auth.users表触发器配置正常');
        }
      }
      
      // 检查public.users表上的触发器
      const { data: publicTriggers, error: publicError } = await this.supabaseAdmin.rpc('exec_sql', {
        sql: `SELECT trigger_name, event_manipulation FROM information_schema.triggers WHERE event_object_schema = 'public' AND event_object_table = 'users'`
      });
      
      if (publicError) {
        this.addIssue('error', '认证触发器', `检查public.users触发器失败: ${publicError.message}`);
      } else {
        const triggerCount = publicTriggers?.length || 0;
        this.log.success(`public.users表上找到${triggerCount}个触发器`);
      }
    } catch (error) {
      this.addIssue('error', '认证触发器', `检查触发器时出错: ${error.message}`);
    }
  }

  async checkUserFunctions() {
    this.log.section('检查用户相关函数');
    
    const requiredFunctions = [
      'handle_new_user',
      'initialize_user_quota',
      'get_user_stats',
      'check_user_permissions'
    ];
    
    try {
      const { data: functions, error } = await this.supabaseAdmin.rpc('exec_sql', {
        sql: `SELECT routine_name, routine_type FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name LIKE '%user%'`
      });
      
      if (error) {
        this.addIssue('error', '用户函数', `检查函数失败: ${error.message}`);
        return;
      }
      
      const functionNames = functions?.map(f => f.routine_name) || [];
      this.log.info(`找到${functionNames.length}个用户相关函数`);
      
      for (const funcName of requiredFunctions) {
        if (functionNames.includes(funcName)) {
          this.log.success(`函数 ${funcName}: 存在`);
        } else {
          this.addIssue('warning', '用户函数', `缺少函数: ${funcName}`);
        }
      }
    } catch (error) {
      this.addIssue('error', '用户函数', `检查函数时出错: ${error.message}`);
    }
  }

  async testUserRegistration() {
    this.log.section('测试用户注册流程');
    
    try {
      const testEmail = `systemcheck${Date.now()}@gmail.com`;
      const testPassword = 'TestPassword123!';
      
      this.log.info(`尝试注册测试用户: ${testEmail}`);
      
      const { data, error: signUpError } = await this.supabaseClient.auth.signUp({
        email: testEmail,
        password: testPassword
      });
      
      if (signUpError) {
        if (signUpError.message.includes('rate limit')) {
          this.addIssue('warning', '注册测试', '注册速率限制，稍后重试');
        } else if (signUpError.message.includes('Database error')) {
          this.addIssue('error', '注册测试', `数据库错误: ${signUpError.message}`);
        } else {
          this.addIssue('error', '注册测试', `注册失败: ${signUpError.message}`);
        }
        return false;
      }
      
      if (data?.user) {
        this.log.success('用户注册测试成功');
        this.log.info(`用户ID: ${data.user.id}`);
        
        // 清理测试数据
        try {
          await this.supabaseAdmin
            .from('users')
            .delete()
            .eq('email', testEmail);
          this.log.info('测试数据已清理');
        } catch (cleanupError) {
          this.log.warning('清理测试数据失败');
        }
        
        return true;
      }
      
      this.addIssue('warning', '注册测试', '注册返回空数据');
      return false;
    } catch (error) {
      this.addIssue('error', '注册测试', `注册测试异常: ${error.message}`);
      return false;
    }
  }

  async testDatabaseOperations() {
    this.log.section('测试数据库操作');
    
    try {
      const testUserId = crypto.randomUUID();
      const testEmail = `dbtest${Date.now()}@gmail.com`;
      
      // 测试插入
      const { data: insertData, error: insertError } = await this.supabaseAdmin
        .from('users')
        .insert({
          id: testUserId,
          email: testEmail,
          full_name: 'Database Test User',
          provider: 'email',
          password_hash: '$2b$10$test.hash.for.testing.purposes.only'
        })
        .select()
        .single();
      
      if (insertError) {
        this.addIssue('error', '数据库操作', `插入失败: ${insertError.message}`);
        return false;
      }
      
      this.log.success('数据库插入测试成功');
      
      // 测试查询
      const { data: selectData, error: selectError } = await this.supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', testUserId)
        .single();
      
      if (selectError) {
        this.addIssue('error', '数据库操作', `查询失败: ${selectError.message}`);
      } else {
        this.log.success('数据库查询测试成功');
      }
      
      // 测试更新
      const { error: updateError } = await this.supabaseAdmin
        .from('users')
        .update({ full_name: 'Updated Test User' })
        .eq('id', testUserId);
      
      if (updateError) {
        this.addIssue('error', '数据库操作', `更新失败: ${updateError.message}`);
      } else {
        this.log.success('数据库更新测试成功');
      }
      
      // 清理测试数据
      const { error: deleteError } = await this.supabaseAdmin
        .from('users')
        .delete()
        .eq('id', testUserId);
      
      if (deleteError) {
        this.log.warning('清理测试数据失败');
      } else {
        this.log.info('测试数据已清理');
      }
      
      return true;
    } catch (error) {
      this.addIssue('error', '数据库操作', `数据库操作测试异常: ${error.message}`);
      return false;
    }
  }

  async checkOAuthConfiguration() {
    this.log.section('检查OAuth配置');
    
    // 检查Google OAuth配置
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!googleClientId || !googleClientSecret) {
      this.addIssue('error', 'OAuth配置', 'Google OAuth配置不完整');
    } else {
      this.log.success('Google OAuth配置完整');
      
      // 验证Client ID格式
      if (!googleClientId.includes('.apps.googleusercontent.com')) {
        this.addIssue('warning', 'OAuth配置', 'Google Client ID格式可能不正确');
      }
    }
    
    // 检查NextAuth配置
    const nextAuthSecret = process.env.NEXTAUTH_SECRET;
    const nextAuthUrl = process.env.NEXTAUTH_URL;
    
    if (!nextAuthSecret) {
      this.addIssue('warning', 'OAuth配置', '缺少NEXTAUTH_SECRET');
    } else {
      this.log.success('NextAuth Secret已配置');
    }
    
    if (!nextAuthUrl) {
      this.addIssue('warning', 'OAuth配置', '缺少NEXTAUTH_URL');
    } else {
      this.log.success(`NextAuth URL: ${nextAuthUrl}`);
    }
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.issues.length + this.warnings.length,
        errors: this.issues.length,
        warnings: this.warnings.length
      },
      issues: this.issues,
      warnings: this.warnings,
      fixes: this.fixes,
      environment: process.env
    };
    
    const reportPath = path.join(process.cwd(), 'comprehensive-system-check-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    return { report, reportPath };
  }

  async run() {
    console.log('🚀 开始全面系统检查...');
    console.log('=' .repeat(50));
    
    // 初始化
    const initialized = await this.initializeClients();
    if (!initialized) {
      console.log('\n❌ 初始化失败，无法继续检查');
      process.exit(1);
    }
    
    // 执行所有检查
    await this.checkEnvironmentVariables();
    await this.checkSupabaseConnection();
    await this.checkDatabaseTables();
    await this.checkTablePermissions();
    await this.checkRLSPolicies();
    await this.checkAuthTriggers();
    await this.checkUserFunctions();
    await this.checkOAuthConfiguration();
    await this.testUserRegistration();
    await this.testDatabaseOperations();
    
    // 生成报告
    this.log.section('生成检查报告');
    const { report, reportPath } = await this.generateReport();
    
    console.log('\n' + '=' .repeat(50));
    console.log('🔍 系统检查报告');
    console.log('=' .repeat(50));
    console.log(`\n发现问题总数: ${report.summary.total}`);
    console.log(`严重错误: ${report.summary.errors}`);
    console.log(`警告: ${report.summary.warnings}`);
    
    if (report.summary.total > 0) {
      console.log('\n问题详情:');
      [...this.issues, ...this.warnings].forEach((issue, index) => {
        const icon = issue.type === 'error' ? '❌' : '⚠️ ';
        console.log(`${index + 1}. ${icon} [${issue.category}] ${issue.message}`);
      });
      
      if (this.fixes.length > 0) {
        console.log('\n修复建议:');
        this.fixes.forEach((fix, index) => {
          console.log(`${index + 1}. ${fix}`);
        });
      }
    } else {
      console.log('\n✅ 所有检查都通过了！系统状态良好。');
    }
    
    console.log(`\n📄 详细报告已保存到: ${reportPath}`);
    console.log('\n🏁 全面系统检查完成！');
    
    // 根据结果设置退出码
    process.exit(report.summary.errors > 0 ? 1 : 0);
  }
}

// 运行检查
const checker = new ComprehensiveSystemCheck();
checker.run().catch(error => {
  console.error('\n❌ 系统检查过程中发生错误:', error);
  process.exit(1);
});