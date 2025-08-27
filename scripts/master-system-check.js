#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 彩色日志
const log = {
  info: (msg) => console.log(`\x1b[36mℹ\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m✓\x1b[0m ${msg}`),
  warning: (msg) => console.log(`\x1b[33m⚠\x1b[0m ${msg}`),
  error: (msg) => console.log(`\x1b[31m❌\x1b[0m ${msg}`),
  title: (msg) => console.log(`\n\x1b[1m\x1b[44m === ${msg} === \x1b[0m`),
  subtitle: (msg) => console.log(`\n\x1b[1m\x1b[46m --- ${msg} --- \x1b[0m`),
  debug: (msg) => console.log(`\x1b[90m🔍 ${msg}\x1b[0m`)
};

class MasterSystemCheck {
  constructor() {
    this.issues = [];
    this.fixes = [];
    this.successes = [];
    this.projectRoot = process.cwd();
    this.verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
    this.autoFix = process.argv.includes('--fix') || process.argv.includes('-f');
    this.reportFile = 'master-system-check-report.json';
    
    // 加载环境变量
    this.loadEnvironmentVariables();
    
    // 初始化Supabase客户端
    this.initSupabaseClients();
  }

  loadEnvironmentVariables() {
    const envFiles = ['.env.local', '.env', '.env.production'];
    
    for (const envFile of envFiles) {
      const envPath = path.join(this.projectRoot, envFile);
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n');
        
        for (const line of lines) {
          const match = line.match(/^([^=]+)=(.*)$/);
          if (match) {
            const [, key, value] = match;
            const cleanKey = key.trim();
            const cleanValue = value.trim().replace(/^["']|["']$/g, '');
            if (!process.env[cleanKey]) {
              process.env[cleanKey] = cleanValue;
            }
          }
        }
      }
    }
  }

  initSupabaseClients() {
    try {
      const { createClient } = require('@supabase/supabase-js');
      
      this.supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
      this.supabaseAnonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
      this.supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      
      if (this.supabaseUrl && this.supabaseAnonKey) {
        this.supabaseAnon = createClient(this.supabaseUrl, this.supabaseAnonKey);
      }
      
      if (this.supabaseUrl && this.supabaseServiceKey) {
        this.supabaseAdmin = createClient(this.supabaseUrl, this.supabaseServiceKey);
      }
    } catch (error) {
      this.addIssue('初始化', `Supabase客户端初始化失败: ${error.message}`, 'error');
    }
  }

  addIssue(category, description, severity = 'warning', details = null) {
    this.issues.push({ 
      category, 
      description, 
      severity, 
      details,
      timestamp: new Date().toISOString() 
    });
  }

  addSuccess(category, description, details = null) {
    this.successes.push({ 
      category, 
      description, 
      details,
      timestamp: new Date().toISOString() 
    });
  }

  addFix(description, sql = null, command = null, priority = 'medium') {
    this.fixes.push({ 
      description, 
      sql, 
      command, 
      priority,
      timestamp: new Date().toISOString() 
    });
  }

  async run() {
    console.log('🚀 Master System Check - 全面系统诊断\n');
    
    try {
      // 基础检查
      await this.checkEnvironmentVariables();
      await this.checkSupabaseConnection();
      await this.checkDatabaseTables();
      await this.checkTablePermissions();
      await this.checkRLSPolicies();
      
      // OAuth和认证检查
      await this.checkOAuthConfiguration();
      await this.checkAuthFlow();
      await this.checkAuthTriggers();
      await this.checkAuthFunctions();
      
      // 代码检查
      await this.checkCodeIntegrity();
      await this.checkMigrationFiles();
      
      // 实际功能测试
      await this.testDatabaseOperations();
      await this.testUserRegistration();
      
      // 生成报告
      await this.generateReport();
      
      // 自动修复（如果启用）
      if (this.autoFix) {
        await this.applyFixes();
      }
      
    } catch (error) {
      log.error(`检查过程中出现严重错误: ${error.message}`);
      if (this.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  async checkEnvironmentVariables() {
    log.title('环境变量检查');
    
    const requiredVars = {
      'PUBLIC_SUPABASE_URL': { required: true, description: 'Supabase项目URL' },
      'PUBLIC_SUPABASE_ANON_KEY': { required: true, description: 'Supabase匿名密钥' },
      'SUPABASE_SERVICE_ROLE_KEY': { required: true, description: 'Supabase服务角色密钥' },
      'GOOGLE_CLIENT_ID': { required: true, description: 'Google OAuth客户端ID' },
      'GOOGLE_CLIENT_SECRET': { required: true, description: 'Google OAuth客户端密钥' },
      'NEXTAUTH_SECRET': { required: true, description: 'NextAuth密钥' },
      'NEXTAUTH_URL': { required: true, description: 'NextAuth URL' },
      'STRIPE_SECRET_KEY': { required: false, description: 'Stripe密钥' },
      'PUBLIC_STRIPE_PUBLISHABLE_KEY': { required: false, description: 'Stripe公开密钥' }
    };

    for (const [varName, config] of Object.entries(requiredVars)) {
      const value = process.env[varName];
      
      if (!value) {
        if (config.required) {
          this.addIssue('环境变量', `缺少必需的环境变量: ${varName} (${config.description})`, 'error');
          this.addFix(`配置环境变量 ${varName}`, null, null, 'high');
        } else {
          this.addIssue('环境变量', `可选环境变量未配置: ${varName} (${config.description})`, 'warning');
        }
      } else {
        // 检查是否为占位符值
        if (value.includes('your-') || value.includes('xxx') || value.includes('placeholder')) {
          this.addIssue('环境变量', `${varName} 似乎是占位符值: ${value.substring(0, 20)}...`, 'warning');
        } else {
          this.addSuccess('环境变量', `${varName}: 已正确配置`);
          if (this.verbose) {
            log.success(`${varName}: ${value.substring(0, 20)}...`);
          } else {
            log.success(`${varName}: 已配置`);
          }
        }
      }
    }
  }

  async checkSupabaseConnection() {
    log.title('Supabase连接检查');
    
    if (!this.supabaseAnon || !this.supabaseAdmin) {
      this.addIssue('Supabase连接', 'Supabase客户端未正确初始化', 'error');
      return;
    }

    try {
      // 测试匿名连接
      const { data: anonData, error: anonError } = await this.supabaseAnon
        .from('users')
        .select('count')
        .limit(1);
      
      if (anonError) {
        this.addIssue('Supabase连接', `匿名连接失败: ${anonError.message}`, 'error');
      } else {
        this.addSuccess('Supabase连接', '匿名连接正常');
        log.success('匿名连接测试通过');
      }

      // 测试管理员连接
      const { data: adminData, error: adminError } = await this.supabaseAdmin
        .from('users')
        .select('count')
        .limit(1);
      
      if (adminError) {
        this.addIssue('Supabase连接', `管理员连接失败: ${adminError.message}`, 'error');
      } else {
        this.addSuccess('Supabase连接', '管理员连接正常');
        log.success('管理员连接测试通过');
      }

    } catch (error) {
      this.addIssue('Supabase连接', `连接测试异常: ${error.message}`, 'error');
    }
  }

  async checkDatabaseTables() {
    log.title('数据库表结构检查');
    
    const requiredTables = {
      'users': {
        required: true,
        description: '用户主表',
        expectedColumns: ['id', 'email', 'full_name', 'avatar_url', 'provider']
      },
      'user_profiles': {
        required: false,
        description: '用户配置表（可选）',
        expectedColumns: ['id', 'user_id', 'bio', 'website']
      },
      'user_quotas': {
        required: true,
        description: '用户配额表',
        expectedColumns: ['id', 'user_id', 'plan_type', 'monthly_limit']
      },
      'backlinks': {
        required: true,
        description: '外链表',
        expectedColumns: ['id', 'user_id', 'source_url', 'target_url']
      },
      'backlink_requests': {
        required: true,
        description: '外链请求表',
        expectedColumns: ['id', 'user_id', 'target_url', 'status']
      }
    };

    for (const [tableName, config] of Object.entries(requiredTables)) {
      try {
        const { data, error } = await this.supabaseAdmin
          .from(tableName)
          .select('*')
          .limit(1);
        
        if (error) {
          if (config.required) {
            this.addIssue('数据库表', `必需表 ${tableName} 不存在或无法访问: ${error.message}`, 'error');
            this.addFix(`创建表 ${tableName}`, this.generateCreateTableSQL(tableName, config), null, 'high');
          } else {
            this.addIssue('数据库表', `可选表 ${tableName} 不存在: ${error.message}`, 'warning');
          }
        } else {
          this.addSuccess('数据库表', `表 ${tableName}: 存在且可访问`);
          log.success(`表 ${tableName} 检查通过`);
          
          // 检查表结构
          await this.checkTableStructure(tableName, config.expectedColumns);
        }
      } catch (error) {
        this.addIssue('数据库表', `检查表 ${tableName} 时出错: ${error.message}`, 'error');
      }
    }
  }

  async checkTableStructure(tableName, expectedColumns) {
    if (!expectedColumns || expectedColumns.length === 0) return;
    
    try {
      const { data, error } = await this.supabaseAdmin.rpc('exec_sql', {
        sql: `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${tableName}' ORDER BY ordinal_position`
      });
      
      if (error) {
        if (this.verbose) {
          log.debug(`无法检查表 ${tableName} 结构: ${error.message}`);
        }
        return;
      }
      
      const actualColumns = data.map(col => col.column_name);
      const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));
      
      if (missingColumns.length > 0) {
        this.addIssue('表结构', `表 ${tableName} 缺少列: ${missingColumns.join(', ')}`, 'warning');
      } else {
        this.addSuccess('表结构', `表 ${tableName} 结构完整`);
      }
      
    } catch (error) {
      if (this.verbose) {
        log.debug(`检查表 ${tableName} 结构时出错: ${error.message}`);
      }
    }
  }

  generateCreateTableSQL(tableName, config) {
    const tableDefinitions = {
      'user_profiles': `
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  bio TEXT,
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
      `,
      'backlinks': `
CREATE TABLE IF NOT EXISTS public.backlinks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  anchor_text TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.backlinks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own backlinks" ON public.backlinks
  FOR ALL USING (auth.uid() = user_id);
      `,
      'backlink_requests': `
CREATE TABLE IF NOT EXISTS public.backlink_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  target_url TEXT NOT NULL,
  anchor_text TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.backlink_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own requests" ON public.backlink_requests
  FOR ALL USING (auth.uid() = user_id);
      `
    };
    
    return tableDefinitions[tableName] || `-- 请手动创建表 ${tableName}`;
  }

  async checkTablePermissions() {
    log.title('表权限检查');
    
    const tables = ['users', 'user_profiles', 'user_quotas', 'backlinks', 'backlink_requests'];
    
    for (const tableName of tables) {
      try {
        const { data, error } = await this.supabaseAdmin.rpc('exec_sql', {
          sql: `SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = '${tableName}' AND grantee IN ('anon', 'authenticated') ORDER BY grantee, privilege_type`
        });
        
        if (error) {
          this.addIssue('表权限', `无法检查表 ${tableName} 权限: ${error.message}`, 'warning');
          continue;
        }
        
        const permissions = data || [];
        const anonPerms = permissions.filter(p => p.grantee === 'anon');
        const authPerms = permissions.filter(p => p.grantee === 'authenticated');
        
        if (anonPerms.length === 0) {
          this.addIssue('表权限', `表 ${tableName} 缺少anon角色权限`, 'warning');
          this.addFix(`为表 ${tableName} 添加anon权限`, `GRANT SELECT ON ${tableName} TO anon;`);
        }
        
        if (authPerms.length === 0) {
          this.addIssue('表权限', `表 ${tableName} 缺少authenticated角色权限`, 'error');
          this.addFix(`为表 ${tableName} 添加authenticated权限`, `GRANT ALL ON ${tableName} TO authenticated;`, null, 'high');
        } else {
          this.addSuccess('表权限', `表 ${tableName} 权限配置正常`);
          log.success(`表 ${tableName} 权限检查通过`);
        }
        
      } catch (error) {
        this.addIssue('表权限', `检查表 ${tableName} 权限时出错: ${error.message}`, 'error');
      }
    }
  }

  async checkRLSPolicies() {
    log.title('RLS策略检查');
    
    const tables = ['users', 'user_profiles', 'user_quotas', 'backlinks', 'backlink_requests'];
    
    for (const tableName of tables) {
      try {
        // 检查RLS是否启用
        const { data: rlsData, error: rlsError } = await this.supabaseAdmin.rpc('exec_sql', {
          sql: `SELECT rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename = '${tableName}'`
        });
        
        if (rlsError) {
          this.addIssue('RLS检查', `无法检查表 ${tableName} RLS状态: ${rlsError.message}`, 'warning');
          continue;
        }
        
        if (!rlsData || rlsData.length === 0 || !rlsData[0]?.rowsecurity) {
          this.addIssue('RLS策略', `表 ${tableName} 未启用RLS`, 'warning');
          this.addFix(`为表 ${tableName} 启用RLS`, `ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;`);
          continue;
        }
        
        this.addSuccess('RLS策略', `表 ${tableName} RLS已启用`);
        
        // 检查RLS策略
        const { data: policies, error: policiesError } = await this.supabaseAdmin.rpc('exec_sql', {
          sql: `SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename = '${tableName}'`
        });
        
        if (policiesError) {
          this.addIssue('RLS策略', `无法检查表 ${tableName} RLS策略: ${policiesError.message}`, 'warning');
        } else if (!policies || policies.length === 0) {
          this.addIssue('RLS策略', `表 ${tableName} 没有RLS策略`, 'warning');
          this.addFix(`为表 ${tableName} 创建RLS策略`, this.generateRLSPolicySQL(tableName));
        } else {
          this.addSuccess('RLS策略', `表 ${tableName} 有 ${policies.length} 个RLS策略`);
          log.success(`表 ${tableName} 有 ${policies.length} 个RLS策略`);
        }
        
      } catch (error) {
        this.addIssue('RLS策略', `检查表 ${tableName} RLS时出错: ${error.message}`, 'error');
      }
    }
  }

  generateRLSPolicySQL(tableName) {
    const policyDefinitions = {
      'users': `
CREATE POLICY "Users can view own data" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON public.users
  FOR UPDATE USING (auth.uid() = id);
      `,
      'user_profiles': `
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);
      `,
      'user_quotas': `
CREATE POLICY "Users can view own quota" ON public.user_quotas
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own quota" ON public.user_quotas
  FOR UPDATE USING (auth.uid() = user_id);
      `,
      'backlinks': `
CREATE POLICY "Users can manage own backlinks" ON public.backlinks
  FOR ALL USING (auth.uid() = user_id);
      `,
      'backlink_requests': `
CREATE POLICY "Users can manage own requests" ON public.backlink_requests
  FOR ALL USING (auth.uid() = user_id);
      `
    };
    
    return policyDefinitions[tableName] || `-- 请手动为表 ${tableName} 创建RLS策略`;
  }

  async checkOAuthConfiguration() {
    log.title('OAuth配置检查');
    
    // 检查Google OAuth配置
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const nextAuthSecret = process.env.NEXTAUTH_SECRET;
    const nextAuthUrl = process.env.NEXTAUTH_URL;
    
    if (!clientId || !clientSecret) {
      this.addIssue('OAuth配置', 'Google OAuth凭据未完整配置', 'error');
      this.addFix('配置Google OAuth凭据', null, null, 'high');
    } else {
      this.addSuccess('OAuth配置', 'Google OAuth配置完整');
      log.success('Google OAuth配置检查通过');
    }
    
    if (!nextAuthSecret) {
      this.addIssue('OAuth配置', 'NextAuth Secret未配置', 'error');
      this.addFix('配置NextAuth Secret', null, 'openssl rand -base64 32', 'high');
    } else {
      this.addSuccess('OAuth配置', 'NextAuth Secret已配置');
      log.success('NextAuth Secret配置正常');
    }
    
    if (!nextAuthUrl) {
      this.addIssue('OAuth配置', 'NextAuth URL未配置', 'warning');
    } else {
      this.addSuccess('OAuth配置', `NextAuth URL: ${nextAuthUrl}`);
      log.success(`NextAuth URL: ${nextAuthUrl}`);
    }
  }

  async checkAuthFlow() {
    log.title('认证流程检查');
    
    // 检查认证相关文件
    const authFiles = [
      'src/pages/api/auth/[...nextauth].ts',
      'src/pages/auth/signin.astro',
      'src/pages/auth/callback.astro',
      'src/lib/auth.ts',
      'src/lib/supabase.ts'
    ];
    
    for (const file of authFiles) {
      const filePath = path.join(this.projectRoot, file);
      if (fs.existsSync(filePath)) {
        this.addSuccess('认证文件', `${file} 存在`);
        log.success(`认证文件 ${file} 存在`);
        
        // 检查文件内容
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('user_profiles') && !content.includes('// TODO: remove user_profiles')) {
          this.addIssue('认证文件', `${file} 仍然引用user_profiles表`, 'warning');
          this.addFix(`更新 ${file} 移除user_profiles引用`);
        }
      } else {
        this.addIssue('认证文件', `${file} 不存在`, 'warning');
      }
    }
  }

  async checkAuthTriggers() {
    log.title('认证触发器检查');
    
    try {
      // 检查auth.users表上的触发器
      const { data: authTriggers, error: authTriggersError } = await this.supabaseAdmin.rpc('exec_sql', {
        sql: `SELECT trigger_name, event_manipulation, action_statement FROM information_schema.triggers WHERE event_object_schema = 'auth' AND event_object_table = 'users'`
      });
      
      if (authTriggersError) {
        this.addIssue('认证触发器', `无法检查auth.users触发器: ${authTriggersError.message}`, 'warning');
      } else if (!authTriggers || authTriggers.length === 0) {
        this.addSuccess('认证触发器', 'auth.users表上无触发器');
        log.success('auth.users表触发器检查通过');
      } else {
        this.addSuccess('认证触发器', `auth.users表上存在 ${authTriggers.length} 个触发器`);
        log.success(`auth.users表上存在 ${authTriggers.length} 个触发器`);
      }
      
      // 检查public.users表上的触发器
      const { data: publicTriggers, error: publicTriggersError } = await this.supabaseAdmin.rpc('exec_sql', {
        sql: `SELECT trigger_name, event_manipulation, action_statement FROM information_schema.triggers WHERE event_object_schema = 'public' AND event_object_table = 'users'`
      });
      
      if (publicTriggersError) {
        this.addIssue('认证触发器', `无法检查public.users触发器: ${publicTriggersError.message}`, 'warning');
      } else if (!publicTriggers || publicTriggers.length === 0) {
        this.addIssue('认证触发器', 'public.users表上没有触发器', 'warning');
        this.addFix('为public.users表创建更新时间触发器', this.generateTriggerSQL());
      } else {
        this.addSuccess('认证触发器', `public.users表上存在 ${publicTriggers.length} 个触发器`);
        log.success(`public.users表上存在 ${publicTriggers.length} 个触发器`);
      }
      
    } catch (error) {
      this.addIssue('认证触发器', `检查触发器时出错: ${error.message}`, 'error');
    }
  }

  generateTriggerSQL() {
    return `
-- 创建更新时间函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为users表创建更新时间触发器
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
    `;
  }

  async checkAuthFunctions() {
    log.title('认证函数检查');
    
    const requiredFunctions = [
      'handle_new_user',
      'update_updated_at_column',
      'get_user_quota',
      'get_user_stats'
    ];
    
    try {
      const { data: functions, error: functionsError } = await this.supabaseAdmin.rpc('exec_sql', {
        sql: `SELECT routine_name, routine_type FROM information_schema.routines WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'`
      });
      
      if (functionsError) {
        this.addIssue('认证函数', `无法检查函数: ${functionsError.message}`, 'warning');
        return;
      }
      
      const existingFunctions = (functions || []).map(f => f.routine_name);
      
      for (const funcName of requiredFunctions) {
        if (existingFunctions.includes(funcName)) {
          this.addSuccess('认证函数', `函数 ${funcName}: 存在`);
          log.success(`函数 ${funcName} 存在`);
        } else {
          this.addIssue('认证函数', `函数 ${funcName}: 不存在`, 'warning');
          this.addFix(`创建函数 ${funcName}`, this.generateFunctionSQL(funcName));
        }
      }
      
    } catch (error) {
      this.addIssue('认证函数', `检查函数时出错: ${error.message}`, 'error');
    }
  }

  generateFunctionSQL(funcName) {
    const functionDefinitions = {
      'handle_new_user': `
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url, provider)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'provider', 'email')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
      `,
      'get_user_quota': `
CREATE OR REPLACE FUNCTION public.get_user_quota(user_uuid UUID)
RETURNS TABLE(plan_type TEXT, monthly_limit INTEGER, used_count INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uq.plan_type,
    uq.monthly_limit,
    uq.used_count
  FROM public.user_quotas uq
  WHERE uq.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
      `,
      'get_user_stats': `
CREATE OR REPLACE FUNCTION public.get_user_stats(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_backlinks', COALESCE((SELECT COUNT(*) FROM public.backlinks WHERE user_id = user_uuid), 0),
    'pending_requests', COALESCE((SELECT COUNT(*) FROM public.backlink_requests WHERE user_id = user_uuid AND status = 'pending'), 0),
    'quota_used', COALESCE((SELECT used_count FROM public.user_quotas WHERE user_id = user_uuid), 0)
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
      `
    };
    
    return functionDefinitions[funcName] || `-- 请手动创建函数 ${funcName}`;
  }

  async checkCodeIntegrity() {
    log.title('代码完整性检查');
    
    // 检查关键配置文件
    const configFiles = [
      'package.json',
      'astro.config.mjs',
      'tsconfig.json',
      '.env.local.example'
    ];
    
    for (const file of configFiles) {
      const filePath = path.join(this.projectRoot, file);
      if (fs.existsSync(filePath)) {
        this.addSuccess('配置文件', `${file} 存在`);
        log.success(`配置文件 ${file} 存在`);
      } else {
        this.addIssue('配置文件', `${file} 不存在`, 'warning');
      }
    }
    
    // 检查package.json中的依赖
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const requiredDeps = [
        '@supabase/supabase-js',
        'next-auth',
        '@next-auth/supabase-adapter'
      ];
      
      for (const dep of requiredDeps) {
        if (packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]) {
          this.addSuccess('依赖检查', `依赖 ${dep} 已安装`);
        } else {
          this.addIssue('依赖检查', `缺少依赖 ${dep}`, 'warning');
          this.addFix(`安装依赖 ${dep}`, null, `pnpm add ${dep}`);
        }
      }
    }
  }

  async checkMigrationFiles() {
    log.title('迁移文件检查');
    
    const migrationsDir = path.join(this.projectRoot, 'supabase', 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      this.addIssue('迁移文件', '迁移目录不存在', 'warning');
      return;
    }
    
    const sqlFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    this.addSuccess('迁移文件', `发现 ${sqlFiles.length} 个迁移文件`);
    log.info(`发现 ${sqlFiles.length} 个迁移文件`);
    
    // 检查是否有冲突的迁移文件
    let hasConflicts = false;
    for (const file of sqlFiles) {
      const filePath = path.join(migrationsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      if (content.includes('CREATE TABLE') && content.includes('user_profiles') && !content.includes('DROP TABLE')) {
        this.addIssue('迁移文件', `${file} 创建了user_profiles表，可能导致冲突`, 'warning');
        hasConflicts = true;
      }
    }
    
    if (!hasConflicts) {
      this.addSuccess('迁移文件', '迁移文件检查通过，无冲突');
      log.success('迁移文件检查通过');
    }
  }

  async testDatabaseOperations() {
    log.title('数据库操作测试');
    
    try {
      // 测试基本查询
      const { data: queryData, error: queryError } = await this.supabaseAdmin
        .from('users')
        .select('id, email')
        .limit(1);
      
      if (queryError) {
        this.addIssue('数据库操作', `查询测试失败: ${queryError.message}`, 'error');
      } else {
        this.addSuccess('数据库操作', '数据库查询测试成功');
        log.success('数据库查询测试通过');
      }
      
      // 测试插入操作（使用测试数据）
      const testEmail = `test-${Date.now()}@example.com`;
      const { data: insertData, error: insertError } = await this.supabaseAdmin
        .from('users')
        .insert({
          email: testEmail,
          full_name: 'Test User',
          provider: 'email',
          password_hash: 'test_hash' // 添加password_hash以满足auth_method约束
        })
        .select()
        .single();
      
      if (insertError) {
        this.addIssue('数据库操作', `插入测试失败: ${insertError.message}`, 'error');
      } else {
        this.addSuccess('数据库操作', '数据库插入测试成功');
        log.success('数据库插入测试通过');
        
        // 清理测试数据
        await this.supabaseAdmin
          .from('users')
          .delete()
          .eq('id', insertData.id);
      }
      
    } catch (error) {
      this.addIssue('数据库操作', `数据库操作测试异常: ${error.message}`, 'error');
    }
  }

  async testUserRegistration() {
    log.title('用户注册流程测试');
    
    try {
      // 模拟用户注册流程
      const testEmail = `test-registration-${Date.now()}@example.com`;
      
      // 测试用户创建
      const { data: userData, error: userError } = await this.supabaseAdmin.auth.admin.createUser({
        email: testEmail,
        password: 'test-password-123',
        email_confirm: true,
        user_metadata: {
          full_name: 'Test Registration User',
          provider: 'test'
        }
      });
      
      if (userError) {
        this.addIssue('用户注册', `用户创建测试失败: ${userError.message}`, 'error');
      } else {
        this.addSuccess('用户注册', '用户注册测试成功');
        log.success('用户注册测试通过');
        
        // 清理测试用户
        if (userData.user) {
          await this.supabaseAdmin.auth.admin.deleteUser(userData.user.id);
        }
      }
      
    } catch (error) {
      this.addIssue('用户注册', `用户注册测试异常: ${error.message}`, 'error');
    }
  }

  async generateReport() {
    log.title('生成诊断报告');
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: this.issues.length,
        errors: this.issues.filter(i => i.severity === 'error').length,
        warnings: this.issues.filter(i => i.severity === 'warning').length,
        successes: this.successes.length
      },
      issues: this.issues,
      successes: this.successes,
      fixes: this.fixes,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        cwd: process.cwd(),
        timestamp: new Date().toISOString()
      }
    };
    
    // 保存报告到文件
    fs.writeFileSync(
      path.join(this.projectRoot, this.reportFile),
      JSON.stringify(report, null, 2)
    );
    
    // 显示摘要
    console.log('\n' + '='.repeat(60));
    log.title('诊断摘要');
    
    if (report.summary.errors > 0) {
      log.error(`发现 ${report.summary.errors} 个严重错误`);
    }
    if (report.summary.warnings > 0) {
      log.warning(`发现 ${report.summary.warnings} 个警告`);
    }
    log.success(`成功检查 ${report.summary.successes} 项`);
    
    console.log(`\n📄 详细报告已保存到: ${this.reportFile}`);
    
    if (this.issues.length === 0) {
      log.success('🎉 恭喜！系统检查全部通过，未发现问题！');
    } else {
      console.log('\n🔧 修复建议:');
      if (this.autoFix) {
        console.log('自动修复模式已启用，将尝试应用修复...');
      } else {
        console.log('运行 `pnpm master-check --fix` 来自动应用修复');
      }
    }
  }

  async applyFixes() {
    log.title('应用自动修复');
    
    if (this.fixes.length === 0) {
      log.info('没有需要修复的问题');
      return;
    }
    
    const highPriorityFixes = this.fixes.filter(f => f.priority === 'high');
    const mediumPriorityFixes = this.fixes.filter(f => f.priority === 'medium');
    
    // 先应用高优先级修复
    for (const fix of highPriorityFixes) {
      await this.applyFix(fix);
    }
    
    // 再应用中等优先级修复
    for (const fix of mediumPriorityFixes) {
      await this.applyFix(fix);
    }
    
    log.success(`已应用 ${this.fixes.length} 个修复`);
  }

  async applyFix(fix) {
    try {
      if (fix.sql) {
        log.info(`执行SQL修复: ${fix.description}`);
        const { error } = await this.supabaseAdmin.rpc('exec_sql', {
          sql: fix.sql
        });
        
        if (error) {
          log.error(`SQL修复失败: ${error.message}`);
        } else {
          log.success(`SQL修复成功: ${fix.description}`);
        }
      }
      
      if (fix.command) {
        log.info(`执行命令修复: ${fix.command}`);
        try {
          execSync(fix.command, { stdio: 'inherit' });
          log.success(`命令修复成功: ${fix.description}`);
        } catch (error) {
          log.error(`命令修复失败: ${error.message}`);
        }
      }
    } catch (error) {
      log.error(`修复失败: ${fix.description} - ${error.message}`);
    }
  }
}

// 运行检查
if (require.main === module) {
  const checker = new MasterSystemCheck();
  checker.run().catch(error => {
    console.error('\n❌ 系统检查失败:', error.message);
    if (checker.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  });
}

module.exports = MasterSystemCheck;