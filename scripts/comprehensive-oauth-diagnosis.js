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
  title: (msg) => console.log(`\n\x1b[1m=== ${msg} ===\x1b[0m`),
  subtitle: (msg) => console.log(`\n\x1b[1m--- ${msg} ---\x1b[0m`)
};

class OAuthDiagnostic {
  constructor() {
    this.issues = [];
    this.fixes = [];
    this.projectRoot = process.cwd();
    this.verbose = process.argv.includes('--verbose');
    this.loadEnvironmentVariables();
  }

  loadEnvironmentVariables() {
    // 加载环境变量
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
            const cleanValue = value.trim().replace(/^["']|["']$/g, ''); // 移除引号
            if (!process.env[cleanKey]) {
              process.env[cleanKey] = cleanValue;
            }
          }
        }
      }
    }
  }

  addIssue(category, description, severity = 'warning') {
    this.issues.push({ category, description, severity });
  }

  addFix(description, command = null, sql = null) {
    this.fixes.push({ description, command, sql });
  }

  async run() {
    console.log('🔍 全面OAuth和数据库诊断\n');
    
    try {
      await this.checkEnvironmentVariables();
      await this.checkSupabaseConnection();
      await this.checkDatabaseStructure();
      await this.checkCodeReferences();
      await this.checkMigrationFiles();
      await this.checkOAuthConfiguration();
      await this.checkTriggersAndFunctions();
      await this.checkRLSPolicies();
      await this.generateReport();
      await this.provideFixes();
    } catch (error) {
      log.error(`诊断过程中出现错误: ${error.message}`);
      if (this.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  async checkEnvironmentVariables() {
    log.title('环境变量检查');
    
    const requiredVars = [
      'PUBLIC_SUPABASE_URL',
      'PUBLIC_SUPABASE_ANON_KEY', 
      'SUPABASE_SERVICE_ROLE_KEY',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET'
    ];

    const envFiles = ['.env.local', '.env', '.env.production'];
    let envFound = false;
    let envVars = {};

    for (const envFile of envFiles) {
      const envPath = path.join(this.projectRoot, envFile);
      if (fs.existsSync(envPath)) {
        envFound = true;
        log.info(`发现环境文件: ${envFile}`);
        
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n');
        
        for (const line of lines) {
          const match = line.match(/^([^=]+)=(.*)$/);
          if (match) {
            const [, key, value] = match;
            envVars[key.trim()] = value.trim();
          }
        }
      }
    }

    if (!envFound) {
      this.addIssue('环境变量', '未找到环境变量文件', 'error');
      this.addFix('创建 .env.local 文件并配置必要的环境变量');
      return;
    }

    for (const varName of requiredVars) {
      if (envVars[varName]) {
        log.success(`${varName} 已配置`);
        
        // 检查是否为占位符值
        const value = envVars[varName];
        if (value.includes('your-') || value.includes('xxx') || value === '') {
          this.addIssue('环境变量', `${varName} 似乎是占位符值: ${value}`, 'warning');
        }
      } else {
        this.addIssue('环境变量', `缺少必需的环境变量: ${varName}`, 'error');
        this.addFix(`配置环境变量 ${varName}`);
      }
    }
  }

  async checkSupabaseConnection() {
    log.title('Supabase连接检查');
    
    try {
      // 检查Supabase项目配置
      const { createClient } = require('@supabase/supabase-js');
      
      const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        this.addIssue('Supabase连接', 'Supabase环境变量未配置', 'error');
        return;
      }

      const supabase = createClient(supabaseUrl, supabaseKey);
      
      // 测试连接
      const { data, error } = await supabase.from('users').select('count').limit(1);
      
      if (error) {
        this.addIssue('Supabase连接', `连接测试失败: ${error.message}`, 'error');
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          this.addFix('检查数据库表是否存在，可能需要运行迁移');
        }
      } else {
        log.success('Supabase连接正常');
      }
    } catch (error) {
      this.addIssue('Supabase连接', `连接检查失败: ${error.message}`, 'error');
    }
  }

  async checkDatabaseStructure() {
    log.title('数据库结构检查');
    
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // 检查users表
      const { data: usersTable, error: usersError } = await supabase
        .from('information_schema.tables')
        .select('*')
        .eq('table_name', 'users')
        .eq('table_schema', 'public');

      if (usersError || !usersTable || usersTable.length === 0) {
        this.addIssue('数据库结构', 'users表不存在', 'error');
        this.addFix('创建users表', null, `
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  provider TEXT DEFAULT 'email',
  provider_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
`);
      } else {
        log.success('users表存在');
      }

      // 检查user_profiles表是否仍然存在
      const { data: profilesTable, error: profilesError } = await supabase
        .from('information_schema.tables')
        .select('*')
        .eq('table_name', 'user_profiles')
        .eq('table_schema', 'public');

      if (!profilesError && profilesTable && profilesTable.length > 0) {
        this.addIssue('数据库结构', 'user_profiles表仍然存在，可能导致冲突', 'warning');
        this.addFix('删除user_profiles表', null, 'DROP TABLE IF EXISTS public.user_profiles CASCADE;');
      } else {
        log.success('user_profiles表已正确移除');
      }

    } catch (error) {
      this.addIssue('数据库结构', `检查失败: ${error.message}`, 'error');
    }
  }

  async checkCodeReferences() {
    log.title('代码引用检查');
    
    const filesToCheck = [
      'src/pages/api/auth/sync-user.ts',
      'src/pages/auth/callback.astro',
      'src/lib/auth.ts',
      'src/lib/supabase.ts'
    ];

    for (const file of filesToCheck) {
      const filePath = path.join(this.projectRoot, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        if (content.includes('user_profiles')) {
          this.addIssue('代码引用', `${file} 仍然引用user_profiles`, 'warning');
          this.addFix(`更新 ${file} 移除user_profiles引用`);
        } else {
          log.success(`${file} 无user_profiles引用`);
        }
      } else {
        log.warning(`文件不存在: ${file}`);
      }
    }
  }

  async checkMigrationFiles() {
    log.title('迁移文件检查');
    
    const migrationsDir = path.join(this.projectRoot, 'supabase', 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      log.warning('迁移目录不存在');
      return;
    }

    const sqlFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    log.info(`发现 ${sqlFiles.length} 个迁移文件`);

    let problematicFiles = [];

    for (const file of sqlFiles) {
      // 跳过清理相关的文件
      if (file.includes('cleanup') || file.includes('remove') || file.includes('final')) {
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // 检查是否创建user_profiles相关的触发器或表
      if (content.includes('CREATE TABLE') && content.includes('user_profiles')) {
        problematicFiles.push({ file, issue: '创建user_profiles表' });
      }
      
      if (content.includes('CREATE TRIGGER') && content.includes('user_profiles')) {
        problematicFiles.push({ file, issue: '创建user_profiles触发器' });
      }
      
      if (content.includes('CREATE OR REPLACE FUNCTION') && content.includes('user_profiles')) {
        problematicFiles.push({ file, issue: '创建user_profiles相关函数' });
      }
    }

    if (problematicFiles.length > 0) {
      for (const { file, issue } of problematicFiles) {
        this.addIssue('迁移文件', `${file}: ${issue}`, 'warning');
      }
      this.addFix('运行最终清理迁移来移除所有user_profiles依赖', 'pnpm supabase:migrate');
    } else {
      log.success('迁移文件检查通过');
    }
  }

  async checkOAuthConfiguration() {
    log.title('OAuth配置检查');
    
    // 检查Google OAuth配置
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      this.addIssue('OAuth配置', 'Google OAuth凭据未配置', 'error');
      this.addFix('在Google Cloud Console配置OAuth应用并设置环境变量');
      return;
    }
    
    // 检查回调URL配置
    const callbackFile = path.join(this.projectRoot, 'src/pages/auth/callback.astro');
    if (fs.existsSync(callbackFile)) {
      log.success('OAuth回调页面存在');
    } else {
      this.addIssue('OAuth配置', 'OAuth回调页面不存在', 'error');
    }
  }

  async checkTriggersAndFunctions() {
    log.title('触发器和函数检查');
    
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // 检查是否有user_profiles相关的触发器
      const { data: triggers, error: triggersError } = await supabase
        .rpc('get_triggers_info');

      if (triggersError && !triggersError.message.includes('function get_triggers_info')) {
        log.warning(`无法检查触发器: ${triggersError.message}`);
      }

      // 检查是否有user_profiles相关的函数
      const { data: functions, error: functionsError } = await supabase
        .from('information_schema.routines')
        .select('routine_name, routine_definition')
        .eq('routine_schema', 'public');

      if (!functionsError && functions) {
        const problematicFunctions = functions.filter(f => 
          f.routine_definition && f.routine_definition.includes('user_profiles')
        );
        
        if (problematicFunctions.length > 0) {
          for (const func of problematicFunctions) {
            this.addIssue('数据库函数', `函数 ${func.routine_name} 仍然引用user_profiles`, 'warning');
          }
          this.addFix('清理引用user_profiles的数据库函数', null, 'DROP FUNCTION IF EXISTS handle_new_user() CASCADE;');
        } else {
          log.success('无问题函数');
        }
      }

    } catch (error) {
      log.warning(`触发器和函数检查失败: ${error.message}`);
    }
  }

  async checkRLSPolicies() {
    log.title('RLS策略检查');
    
    try {
      const { createClient } = require('@supabase/supabase-js');
      const supabase = createClient(
        process.env.PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      );

      // 检查users表的RLS策略
      const { data: policies, error: policiesError } = await supabase
        .from('pg_policies')
        .select('*')
        .eq('tablename', 'users');

      if (!policiesError && policies) {
        if (policies.length > 0) {
          log.success(`users表有 ${policies.length} 个RLS策略`);
        } else {
          this.addIssue('RLS策略', 'users表没有RLS策略', 'warning');
          this.addFix('为users表创建适当的RLS策略');
        }
      }

    } catch (error) {
      log.warning(`RLS策略检查失败: ${error.message}`);
    }
  }

  async generateReport() {
    log.title('诊断报告');
    
    if (this.issues.length === 0) {
      log.success('🎉 未发现问题！OAuth配置看起来正常。');
      return;
    }

    console.log(`\n发现 ${this.issues.length} 个问题:\n`);
    
    const errorCount = this.issues.filter(i => i.severity === 'error').length;
    const warningCount = this.issues.filter(i => i.severity === 'warning').length;
    
    if (errorCount > 0) {
      log.error(`严重问题: ${errorCount}`);
    }
    if (warningCount > 0) {
      log.warning(`警告: ${warningCount}`);
    }

    // 按类别分组显示问题
    const issuesByCategory = {};
    for (const issue of this.issues) {
      if (!issuesByCategory[issue.category]) {
        issuesByCategory[issue.category] = [];
      }
      issuesByCategory[issue.category].push(issue);
    }

    for (const [category, issues] of Object.entries(issuesByCategory)) {
      log.subtitle(category);
      for (const issue of issues) {
        if (issue.severity === 'error') {
          log.error(issue.description);
        } else {
          log.warning(issue.description);
        }
      }
    }
  }

  async provideFixes() {
    if (this.fixes.length === 0) {
      return;
    }

    log.title('修复建议');
    
    for (let i = 0; i < this.fixes.length; i++) {
      const fix = this.fixes[i];
      console.log(`\n${i + 1}. ${fix.description}`);
      
      if (fix.command) {
        console.log(`   命令: ${fix.command}`);
      }
      
      if (fix.sql) {
        console.log(`   SQL: ${fix.sql}`);
      }
    }

    // 提供一键修复选项
    log.title('一键修复');
    console.log('运行以下命令来应用所有修复:');
    console.log('pnpm oauth:fix');
  }
}

// 运行诊断
if (require.main === module) {
  const diagnostic = new OAuthDiagnostic();
  diagnostic.run().catch(error => {
    console.error('诊断失败:', error);
    process.exit(1);
  });
}

module.exports = OAuthDiagnostic;