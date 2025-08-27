const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 加载环境变量
require('dotenv').config();

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
      break;
    }
  }
  
  Object.assign(process.env, envVars);
  return envVars;
}

loadEnvironmentVariables();

class UltimateSystemDiagnosis {
  constructor() {
    this.issues = [];
    this.fixes = [];
    this.warnings = [];
    this.successes = [];
    this.autoFix = false;
    
    // 初始化 Supabase 客户端
    const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('缺少Supabase配置');
    }
    
    this.supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    
    if (supabaseServiceKey) {
      this.supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    }
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      'info': 'ℹ',
      'success': '✅',
      'warning': '⚠️',
      'error': '❌',
      'fix': '🔧'
    }[type] || 'ℹ';
    
    console.log(`${prefix} ${message}`);
    
    if (type === 'error') {
      this.issues.push({ type: 'error', message, timestamp });
    } else if (type === 'warning') {
      this.warnings.push({ type: 'warning', message, timestamp });
    } else if (type === 'success') {
      this.successes.push({ type: 'success', message, timestamp });
    }
  }

  addFix(sql, description) {
    this.fixes.push({ sql, description, timestamp: new Date().toISOString() });
  }

  async checkEnvironmentVariables() {
    this.log('\n🔍 检查环境变量配置');
    
    const requiredVars = [
      'PUBLIC_SUPABASE_URL',
      'PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL'
    ];
    
    const optionalVars = [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'PUBLIC_STRIPE_PUBLISHABLE_KEY'
    ];
    
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        this.log(`缺少必需环境变量: ${varName}`, 'error');
      } else if (process.env[varName].includes('your-') || process.env[varName].includes('xxx')) {
        this.log(`环境变量 ${varName} 包含占位符值`, 'error');
      } else {
        this.log(`环境变量 ${varName}: 已配置`, 'success');
      }
    }
    
    for (const varName of optionalVars) {
      if (!process.env[varName]) {
        this.log(`可选环境变量未配置: ${varName}`, 'warning');
      } else {
        this.log(`环境变量 ${varName}: 已配置`, 'success');
      }
    }
  }

  async checkSupabaseConnection() {
    this.log('\n🔍 检查Supabase连接');
    
    try {
      const { data, error } = await this.supabaseClient.from('users').select('count').limit(1);
      if (error) {
        this.log(`Supabase连接失败: ${error.message}`, 'error');
        return false;
      }
      this.log('Supabase连接成功', 'success');
      return true;
    } catch (error) {
      this.log(`Supabase连接异常: ${error.message}`, 'error');
      return false;
    }
  }

  async checkDatabaseTables() {
    this.log('\n🔍 检查数据库表结构');
    
    const requiredTables = [
      'users',
      'user_profiles', 
      'user_quotas',
      'backlinks',
      'backlink_requests'
    ];
    
    const missingTables = [];
    
    for (const table of requiredTables) {
      try {
        const { data, error } = await this.supabaseClient.from(table).select('*').limit(1);
        if (error) {
          this.log(`表 ${table} 不存在或无法访问: ${error.message}`, 'error');
          missingTables.push(table);
        } else {
          this.log(`表 ${table}: 存在且可访问`, 'success');
        }
      } catch (error) {
        this.log(`检查表 ${table} 时出错: ${error.message}`, 'error');
        missingTables.push(table);
      }
    }
    
    return missingTables;
  }

  async createMissingTables(missingTables) {
    if (!this.supabaseAdmin) {
      this.log('无法创建缺失的表：缺少服务角色密钥', 'error');
      return;
    }
    
    this.log('\n🔧 创建缺失的数据库表');
    
    const tableDefinitions = {
      'user_profiles': `
        CREATE TABLE IF NOT EXISTS public.user_profiles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          full_name TEXT,
          avatar_url TEXT,
          website TEXT,
          bio TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id)
        );
        
        ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can view own profile" ON public.user_profiles
          FOR SELECT USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can update own profile" ON public.user_profiles
          FOR UPDATE USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can insert own profile" ON public.user_profiles
          FOR INSERT WITH CHECK (auth.uid() = user_id);
        
        GRANT SELECT ON public.user_profiles TO anon;
        GRANT ALL ON public.user_profiles TO authenticated;
      `,
      
      'backlinks': `
        CREATE TABLE IF NOT EXISTS public.backlinks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          source_url TEXT NOT NULL,
          target_url TEXT NOT NULL,
          anchor_text TEXT,
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'removed', 'broken')),
          da_score INTEGER,
          dr_score INTEGER,
          traffic_estimate INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        ALTER TABLE public.backlinks ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can view own backlinks" ON public.backlinks
          FOR SELECT USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can manage own backlinks" ON public.backlinks
          FOR ALL USING (auth.uid() = user_id);
        
        GRANT SELECT ON public.backlinks TO anon;
        GRANT ALL ON public.backlinks TO authenticated;
      `,
      
      'backlink_requests': `
        CREATE TABLE IF NOT EXISTS public.backlink_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
          target_url TEXT NOT NULL,
          target_keywords TEXT[],
          budget_min INTEGER,
          budget_max INTEGER,
          requirements TEXT,
          status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        ALTER TABLE public.backlink_requests ENABLE ROW LEVEL SECURITY;
        
        CREATE POLICY "Users can view own requests" ON public.backlink_requests
          FOR SELECT USING (auth.uid() = user_id);
        
        CREATE POLICY "Users can manage own requests" ON public.backlink_requests
          FOR ALL USING (auth.uid() = user_id);
        
        GRANT SELECT ON public.backlink_requests TO anon;
        GRANT ALL ON public.backlink_requests TO authenticated;
      `
    };
    
    for (const table of missingTables) {
      if (tableDefinitions[table]) {
        try {
          this.log(`创建表 ${table}...`, 'fix');
          const { error } = await this.supabaseAdmin.rpc('exec_sql', {
            sql: tableDefinitions[table]
          });
          
          if (error) {
            this.log(`创建表 ${table} 失败: ${error.message}`, 'error');
            this.addFix(tableDefinitions[table], `创建表 ${table}`);
          } else {
            this.log(`表 ${table} 创建成功`, 'success');
          }
        } catch (error) {
          this.log(`创建表 ${table} 时出错: ${error.message}`, 'error');
          this.addFix(tableDefinitions[table], `创建表 ${table}`);
        }
      }
    }
  }

  async checkTablePermissions() {
    this.log('\n🔍 检查表权限');
    
    if (!this.supabaseAdmin) {
      this.log('无法检查表权限：缺少服务角色密钥', 'warning');
      return;
    }
    
    const tables = ['users', 'user_profiles', 'user_quotas', 'backlinks', 'backlink_requests'];
    
    for (const table of tables) {
      try {
        const { data, error } = await this.supabaseAdmin.rpc('exec_sql', {
          sql: `SELECT grantee, privilege_type FROM information_schema.role_table_grants 
                WHERE table_schema = 'public' AND table_name = '${table}' 
                AND grantee IN ('anon', 'authenticated')`
        });
        
        if (error) {
          this.log(`检查表 ${table} 权限失败: ${error.message}`, 'error');
          continue;
        }
        
        const anonPerms = data.filter(p => p.grantee === 'anon');
        const authPerms = data.filter(p => p.grantee === 'authenticated');
        
        if (anonPerms.length === 0 && authPerms.length === 0) {
          this.log(`表 ${table} 缺少基本权限`, 'error');
          this.addFix(
            `GRANT SELECT ON ${table} TO anon; GRANT ALL ON ${table} TO authenticated;`,
            `为表 ${table} 添加基本权限`
          );
        } else {
          this.log(`表 ${table} 权限配置正常`, 'success');
        }
      } catch (error) {
        this.log(`检查表 ${table} 权限时出错: ${error.message}`, 'error');
      }
    }
  }

  async checkRLSPolicies() {
    this.log('\n🔍 检查RLS策略');
    
    if (!this.supabaseAdmin) {
      this.log('无法检查RLS策略：缺少服务角色密钥', 'warning');
      return;
    }
    
    const tables = ['users', 'user_profiles', 'user_quotas', 'backlinks', 'backlink_requests'];
    
    for (const table of tables) {
      try {
        // 检查RLS是否启用
        const { data: rlsData, error: rlsError } = await this.supabaseAdmin.rpc('exec_sql', {
          sql: `SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = '${table}'`
        });
        
        if (rlsError) {
          this.log(`无法检查表 ${table} 的RLS状态: ${rlsError.message}`, 'error');
          continue;
        }
        
        if (!rlsData || rlsData.length === 0 || !rlsData[0]?.rowsecurity) {
          this.log(`表 ${table} 未启用RLS`, 'warning');
          this.addFix(
            `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`,
            `为表 ${table} 启用RLS`
          );
        } else {
          this.log(`表 ${table} RLS已启用`, 'success');
        }
        
        // 检查RLS策略
        const { data: policies, error: policyError } = await this.supabaseAdmin.rpc('exec_sql', {
          sql: `SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = '${table}'`
        });
        
        if (policyError) {
          this.log(`检查表 ${table} RLS策略失败: ${policyError.message}`, 'error');
          continue;
        }
        
        if (!policies || policies.length === 0) {
          this.log(`表 ${table} 没有RLS策略`, 'warning');
        } else {
          this.log(`表 ${table} 有 ${policies.length} 个RLS策略`, 'success');
        }
      } catch (error) {
        this.log(`检查表 ${table} RLS时出错: ${error.message}`, 'error');
      }
    }
  }

  async checkAuthTriggers() {
    this.log('\n🔍 检查认证触发器');
    
    if (!this.supabaseAdmin) {
      this.log('无法检查触发器：缺少服务角色密钥', 'warning');
      return;
    }
    
    try {
      // 检查 auth.users 表上的触发器
      const { data: authTriggers, error: authError } = await this.supabaseAdmin.rpc('exec_sql', {
        sql: `SELECT trigger_name, event_manipulation FROM information_schema.triggers 
              WHERE event_object_schema = 'auth' AND event_object_table = 'users'`
      });
      
      if (authError) {
        this.log(`检查auth触发器失败: ${authError.message}`, 'error');
      } else if (authTriggers && authTriggers.length > 0) {
        this.log(`⚠️ auth.users表上存在 ${authTriggers.length} 个触发器，可能导致注册问题`, 'warning');
        authTriggers.forEach(trigger => {
          this.log(`  - ${trigger.trigger_name} (${trigger.event_manipulation})`, 'info');
        });
      } else {
        this.log('auth.users表上无触发器', 'success');
      }
      
      // 检查 public.users 表上的触发器
      const { data: publicTriggers, error: publicError } = await this.supabaseAdmin.rpc('exec_sql', {
        sql: `SELECT trigger_name, event_manipulation FROM information_schema.triggers 
              WHERE event_object_schema = 'public' AND event_object_table = 'users'`
      });
      
      if (publicError) {
        this.log(`检查public触发器失败: ${publicError.message}`, 'error');
      } else if (publicTriggers && publicTriggers.length > 0) {
        this.log(`public.users表上存在 ${publicTriggers.length} 个触发器`, 'success');
        publicTriggers.forEach(trigger => {
          this.log(`  - ${trigger.trigger_name} (${trigger.event_manipulation})`, 'info');
        });
      } else {
        this.log('public.users表上无触发器', 'info');
      }
    } catch (error) {
      this.log(`检查触发器时出错: ${error.message}`, 'error');
    }
  }

  async checkUserFunctions() {
    this.log('\n🔍 检查用户相关函数');
    
    if (!this.supabaseAdmin) {
      this.log('无法检查函数：缺少服务角色密钥', 'warning');
      return;
    }
    
    const expectedFunctions = [
      'handle_new_user',
      'update_updated_at_column',
      'get_user_quota',
      'get_user_stats',
      'check_user_permissions'
    ];
    
    try {
      const { data: functions, error } = await this.supabaseAdmin.rpc('exec_sql', {
        sql: `SELECT routine_name FROM information_schema.routines 
              WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'`
      });
      
      if (error) {
        this.log(`检查函数失败: ${error.message}`, 'error');
        return;
      }
      
      const existingFunctions = functions ? functions.map(f => f.routine_name) : [];
      
      for (const func of expectedFunctions) {
        if (existingFunctions.includes(func)) {
          this.log(`函数 ${func}: 存在`, 'success');
        } else {
          this.log(`函数 ${func}: 缺失`, 'warning');
        }
      }
      
      this.log(`总共找到 ${existingFunctions.length} 个用户相关函数`, 'info');
    } catch (error) {
      this.log(`检查函数时出错: ${error.message}`, 'error');
    }
  }

  async testUserRegistration() {
    this.log('\n🔍 测试用户注册流程');
    
    const testEmail = `systemtest${Date.now()}@gmail.com`;
    const testPassword = 'TestPassword123!';
    
    try {
      this.log(`尝试注册测试用户: ${testEmail}`, 'info');
      
      const { data, error } = await this.supabaseClient.auth.signUp({
        email: testEmail,
        password: testPassword
      });
      
      if (error) {
        this.log(`用户注册失败: ${error.message}`, 'error');
        return false;
      }
      
      if (data.user) {
        this.log(`用户注册测试成功`, 'success');
        this.log(`用户ID: ${data.user.id}`, 'info');
        
        // 清理测试数据
        if (this.supabaseAdmin) {
          await this.supabaseAdmin.auth.admin.deleteUser(data.user.id);
          this.log('测试数据已清理', 'info');
        }
        
        return true;
      }
      
      this.log('用户注册返回空数据', 'warning');
      return false;
    } catch (error) {
      this.log(`用户注册测试异常: ${error.message}`, 'error');
      return false;
    }
  }

  async testDatabaseOperations() {
    this.log('\n🔍 测试数据库操作');
    
    const testUserId = crypto.randomUUID();
    const testEmail = `dbtest${Date.now()}@gmail.com`;
    
    try {
      // 测试插入
      const { data: insertData, error: insertError } = await this.supabaseClient
        .from('users')
        .insert({
          id: testUserId,
          email: testEmail,
          provider: 'email',
          password_hash: '$2b$10$test.hash.for.testing.purposes.only'
        })
        .select()
        .single();
      
      if (insertError) {
        this.log(`数据库插入测试失败: ${insertError.message}`, 'error');
        return false;
      }
      
      this.log('数据库插入测试成功', 'success');
      
      // 测试查询
      const { data: selectData, error: selectError } = await this.supabaseClient
        .from('users')
        .select('*')
        .eq('id', testUserId)
        .single();
      
      if (selectError) {
        this.log(`数据库查询测试失败: ${selectError.message}`, 'error');
      } else {
        this.log('数据库查询测试成功', 'success');
      }
      
      // 测试更新
      const { error: updateError } = await this.supabaseClient
        .from('users')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', testUserId);
      
      if (updateError) {
        this.log(`数据库更新测试失败: ${updateError.message}`, 'error');
      } else {
        this.log('数据库更新测试成功', 'success');
      }
      
      // 清理测试数据
      await this.supabaseClient.from('users').delete().eq('id', testUserId);
      this.log('测试数据已清理', 'info');
      
      return true;
    } catch (error) {
      this.log(`数据库操作测试异常: ${error.message}`, 'error');
      return false;
    }
  }

  async checkOAuthConfiguration() {
    this.log('\n🔍 检查OAuth配置');
    
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!googleClientId || !googleClientSecret) {
      this.log('Google OAuth配置不完整', 'error');
      return false;
    }
    
    if (googleClientId.includes('your-') || googleClientSecret.includes('your-')) {
      this.log('Google OAuth配置包含占位符', 'error');
      return false;
    }
    
    this.log('Google OAuth配置完整', 'success');
    
    const nextAuthSecret = process.env.NEXTAUTH_SECRET;
    const nextAuthUrl = process.env.NEXTAUTH_URL;
    
    if (!nextAuthSecret) {
      this.log('NextAuth Secret未配置', 'error');
    } else {
      this.log('NextAuth Secret已配置', 'success');
    }
    
    if (!nextAuthUrl) {
      this.log('NextAuth URL未配置', 'warning');
    } else {
      this.log(`NextAuth URL: ${nextAuthUrl}`, 'success');
    }
    
    return true;
  }

  async applyFixes() {
    if (this.fixes.length === 0) {
      this.log('\n✅ 没有需要修复的问题', 'success');
      return;
    }
    
    this.log('\n🔧 应用自动修复');
    
    if (!this.supabaseAdmin) {
      this.log('无法应用修复：缺少服务角色密钥', 'error');
      this.log('请手动执行以下SQL命令:', 'info');
      this.fixes.forEach((fix, index) => {
        this.log(`${index + 1}. ${fix.description}:`, 'info');
        this.log(fix.sql, 'info');
        this.log('', 'info');
      });
      return;
    }
    
    for (const fix of this.fixes) {
      try {
        this.log(`应用修复: ${fix.description}`, 'fix');
        
        // 对于复杂的SQL，我们需要分别执行
        const sqlStatements = fix.sql.split(';').filter(s => s.trim());
        
        for (const statement of sqlStatements) {
          if (statement.trim()) {
            const { error } = await this.supabaseAdmin.rpc('exec_sql', {
              sql: statement.trim() + ';'
            });
            
            if (error) {
              this.log(`修复失败: ${error.message}`, 'error');
              break;
            }
          }
        }
        
        this.log(`修复完成: ${fix.description}`, 'success');
      } catch (error) {
        this.log(`修复异常: ${error.message}`, 'error');
      }
    }
  }

  generateReport() {
    this.log('\n🔍 生成检查报告');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.issues.length + this.warnings.length,
        errors: this.issues.length,
        warnings: this.warnings.length,
        successes: this.successes.length
      },
      issues: this.issues,
      warnings: this.warnings,
      successes: this.successes,
      fixes: this.fixes,
      environment: process.env
    };
    
    const reportPath = path.join(process.cwd(), 'ultimate-system-diagnosis-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log('\n==================================================');
    console.log('🔍 终极系统诊断报告');
    console.log('==================================================\n');
    
    console.log(`发现问题总数: ${report.summary.total}`);
    console.log(`严重错误: ${report.summary.errors}`);
    console.log(`警告: ${report.summary.warnings}`);
    console.log(`成功检查: ${report.summary.successes}\n`);
    
    if (this.issues.length > 0) {
      console.log('严重错误:');
      this.issues.forEach((issue, index) => {
        console.log(`${index + 1}. ❌ ${issue.message}`);
      });
      console.log('');
    }
    
    if (this.warnings.length > 0) {
      console.log('警告:');
      this.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. ⚠️  ${warning.message}`);
      });
      console.log('');
    }
    
    if (this.fixes.length > 0) {
      console.log('修复建议:');
      this.fixes.forEach((fix, index) => {
        console.log(`${index + 1}. ${fix.description}`);
        console.log(`   SQL: ${fix.sql}`);
      });
      console.log('');
    }
    
    console.log(`📄 详细报告已保存到: ${reportPath}\n`);
    
    return report;
  }

  async runFullDiagnosis(autoFix = false) {
    this.autoFix = autoFix;
    
    console.log('🚀 开始终极系统诊断...\n');
    
    try {
      await this.checkEnvironmentVariables();
      
      const connectionOk = await this.checkSupabaseConnection();
      if (!connectionOk) {
        this.log('Supabase连接失败，跳过后续检查', 'error');
        return this.generateReport();
      }
      
      const missingTables = await this.checkDatabaseTables();
      
      if (autoFix && missingTables.length > 0) {
        await this.createMissingTables(missingTables);
      }
      
      await this.checkTablePermissions();
      await this.checkRLSPolicies();
      await this.checkAuthTriggers();
      await this.checkUserFunctions();
      await this.checkOAuthConfiguration();
      
      await this.testUserRegistration();
      await this.testDatabaseOperations();
      
      if (autoFix) {
        await this.applyFixes();
      }
      
      return this.generateReport();
    } catch (error) {
      this.log(`诊断过程中出现异常: ${error.message}`, 'error');
      return this.generateReport();
    } finally {
      console.log('🏁 终极系统诊断完成！');
    }
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const autoFix = args.includes('--fix') || args.includes('-f');
  
  if (autoFix) {
    console.log('🔧 自动修复模式已启用\n');
  }
  
  try {
    const diagnosis = new UltimateSystemDiagnosis();
    await diagnosis.runFullDiagnosis(autoFix);
  } catch (error) {
    console.error('❌ 诊断初始化失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = UltimateSystemDiagnosis;