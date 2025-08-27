#!/usr/bin/env node

/**
 * OAuth和数据库全面诊断脚本
 * 用于检查和诊断OAuth登录相关的所有潜在问题
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 颜色输出
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.bold}${colors.cyan}=== ${msg} ===${colors.reset}`)
};

class OAuthDiagnostic {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.successes = [];
    this.envVars = {};
    this.supabase = null;
  }

  addIssue(category, message, solution = null) {
    this.issues.push({ category, message, solution });
  }

  addWarning(category, message) {
    this.warnings.push({ category, message });
  }

  addSuccess(category, message) {
    this.successes.push({ category, message });
  }

  // 1. 检查环境变量配置
  async checkEnvironmentVariables() {
    log.section('检查环境变量配置');
    
    const envFiles = ['.env', '.env.local', '.env.production'];
    let envFound = false;
    
    for (const envFile of envFiles) {
      const envPath = path.join(process.cwd(), envFile);
      if (fs.existsSync(envPath)) {
        envFound = true;
        log.info(`发现环境变量文件: ${envFile}`);
        
        try {
          const envContent = fs.readFileSync(envPath, 'utf8');
          const lines = envContent.split('\n');
          
          for (const line of lines) {
            if (line.includes('=') && !line.startsWith('#')) {
              const [key, value] = line.split('=', 2);
              if (key && value) {
                this.envVars[key.trim()] = value.trim();
              }
            }
          }
        } catch (error) {
          this.addIssue('环境变量', `无法读取 ${envFile}: ${error.message}`);
        }
      }
    }
    
    if (!envFound) {
      this.addIssue('环境变量', '未找到任何环境变量文件 (.env, .env.local, .env.production)');
      return;
    }
    
    // 检查必需的环境变量
    const requiredVars = [
      'PUBLIC_SUPABASE_URL',
      'PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET'
    ];
    
    for (const varName of requiredVars) {
      if (!this.envVars[varName]) {
        this.addIssue('环境变量', `缺少必需的环境变量: ${varName}`);
      } else if (this.envVars[varName].includes('your-') || this.envVars[varName].includes('xxx')) {
        this.addIssue('环境变量', `环境变量 ${varName} 包含占位符值，需要替换为实际值`);
      } else {
        this.addSuccess('环境变量', `${varName} 已配置`);
      }
    }
    
    // 检查URL格式
    if (this.envVars.PUBLIC_SUPABASE_URL) {
      try {
        new URL(this.envVars.PUBLIC_SUPABASE_URL);
        this.addSuccess('环境变量', 'Supabase URL 格式正确');
      } catch {
        this.addIssue('环境变量', 'PUBLIC_SUPABASE_URL 格式无效');
      }
    }
  }

  // 2. 验证Supabase连接
  async checkSupabaseConnection() {
    log.section('验证Supabase连接');
    
    if (!this.envVars.PUBLIC_SUPABASE_URL || !this.envVars.PUBLIC_SUPABASE_ANON_KEY) {
      this.addIssue('Supabase连接', '缺少Supabase连接所需的环境变量');
      return;
    }
    
    try {
      this.supabase = createClient(
        this.envVars.PUBLIC_SUPABASE_URL,
        this.envVars.PUBLIC_SUPABASE_ANON_KEY
      );
      
      // 测试连接
      const { data, error } = await this.supabase.from('users').select('count').limit(1);
      
      if (error) {
        this.addIssue('Supabase连接', `连接测试失败: ${error.message}`, '检查Supabase URL和密钥是否正确');
      } else {
        this.addSuccess('Supabase连接', '连接测试成功');
      }
    } catch (error) {
      this.addIssue('Supabase连接', `连接初始化失败: ${error.message}`);
    }
  }

  // 3. 检查数据库表结构
  async checkDatabaseSchema() {
    log.section('检查数据库表结构');
    
    if (!this.supabase) {
      this.addIssue('数据库结构', 'Supabase连接未建立，跳过数据库检查');
      return;
    }
    
    try {
      // 检查users表
      const { data: usersData, error: usersError } = await this.supabase
        .from('users')
        .select('*')
        .limit(1);
      
      if (usersError) {
        this.addIssue('数据库结构', `users表访问失败: ${usersError.message}`);
      } else {
        this.addSuccess('数据库结构', 'users表访问正常');
      }
      
      // 检查user_profiles表是否存在（不应该存在）
      const { data: profilesData, error: profilesError } = await this.supabase
        .from('user_profiles')
        .select('*')
        .limit(1);
      
      if (profilesError && profilesError.code === '42P01') {
        this.addSuccess('数据库结构', 'user_profiles表已正确移除');
      } else if (!profilesError) {
        this.addWarning('数据库结构', 'user_profiles表仍然存在，可能导致OAuth错误');
      }
      
      // 检查其他必需表
      const requiredTables = ['user_quotas', 'subscriptions'];
      for (const table of requiredTables) {
        const { error } = await this.supabase.from(table).select('*').limit(1);
        if (error) {
          this.addIssue('数据库结构', `${table}表访问失败: ${error.message}`);
        } else {
          this.addSuccess('数据库结构', `${table}表访问正常`);
        }
      }
    } catch (error) {
      this.addIssue('数据库结构', `数据库结构检查失败: ${error.message}`);
    }
  }

  // 4. 检查数据库触发器和函数
  async checkDatabaseTriggers() {
    log.section('检查数据库触发器和函数');
    
    if (!this.envVars.SUPABASE_SERVICE_ROLE_KEY) {
      this.addWarning('数据库触发器', '缺少SERVICE_ROLE_KEY，无法检查触发器');
      return;
    }
    
    try {
      const adminClient = createClient(
        this.envVars.PUBLIC_SUPABASE_URL,
        this.envVars.SUPABASE_SERVICE_ROLE_KEY
      );
      
      // 检查是否存在user_profiles相关的触发器
      const { data: triggers, error: triggerError } = await adminClient
        .rpc('get_triggers_info');
      
      if (triggerError && triggerError.code !== '42883') {
        this.addWarning('数据库触发器', `无法检查触发器: ${triggerError.message}`);
      }
      
      // 检查是否存在user_profiles相关的函数
      const { data: functions, error: functionError } = await adminClient
        .rpc('get_functions_info');
      
      if (functionError && functionError.code !== '42883') {
        this.addWarning('数据库触发器', `无法检查函数: ${functionError.message}`);
      }
      
    } catch (error) {
      this.addWarning('数据库触发器', `触发器检查失败: ${error.message}`);
    }
  }

  // 5. 检查OAuth配置
  async checkOAuthConfiguration() {
    log.section('检查OAuth配置');
    
    // 检查Google OAuth配置
    if (!this.envVars.GOOGLE_CLIENT_ID || !this.envVars.GOOGLE_CLIENT_SECRET) {
      this.addIssue('OAuth配置', '缺少Google OAuth客户端ID或密钥');
    } else {
      this.addSuccess('OAuth配置', 'Google OAuth凭据已配置');
    }
    
    // 检查回调URL配置
    const callbackPath = '/auth/callback';
    const expectedCallback = `http://localhost:4321${callbackPath}`;
    
    log.info(`预期的OAuth回调URL: ${expectedCallback}`);
    this.addSuccess('OAuth配置', `回调URL路径: ${callbackPath}`);
  }

  // 6. 检查API端点
  async checkAPIEndpoints() {
    log.section('检查API端点');
    
    const endpoints = [
      '/api/auth/check',
      '/api/auth/sync-user'
    ];
    
    for (const endpoint of endpoints) {
      const filePath = path.join(process.cwd(), 'src', 'pages', endpoint + '.ts');
      if (fs.existsSync(filePath)) {
        this.addSuccess('API端点', `${endpoint} 文件存在`);
        
        // 检查文件内容
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          if (content.includes('user_profiles')) {
            this.addWarning('API端点', `${endpoint} 仍包含user_profiles引用`);
          } else {
            this.addSuccess('API端点', `${endpoint} 不包含user_profiles引用`);
          }
        } catch (error) {
          this.addWarning('API端点', `无法读取 ${endpoint}: ${error.message}`);
        }
      } else {
        this.addIssue('API端点', `${endpoint} 文件不存在`);
      }
    }
  }

  // 7. 检查迁移文件
  async checkMigrationFiles() {
    log.section('检查迁移文件');
    
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      this.addWarning('迁移文件', 'migrations目录不存在');
      return;
    }
    
    try {
      const files = fs.readdirSync(migrationsDir);
      const sqlFiles = files.filter(f => f.endsWith('.sql'));
      
      log.info(`发现 ${sqlFiles.length} 个迁移文件`);
      
      let hasUserProfilesReferences = false;
      for (const file of sqlFiles) {
        const filePath = path.join(migrationsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        
        if (content.includes('user_profiles')) {
          hasUserProfilesReferences = true;
          this.addWarning('迁移文件', `${file} 包含user_profiles引用`);
        }
      }
      
      if (!hasUserProfilesReferences) {
        this.addSuccess('迁移文件', '没有发现user_profiles引用');
      }
      
    } catch (error) {
      this.addIssue('迁移文件', `检查迁移文件失败: ${error.message}`);
    }
  }

  // 8. 测试OAuth流程
  async testOAuthFlow() {
    log.section('测试OAuth流程');
    
    if (!this.supabase) {
      this.addIssue('OAuth测试', 'Supabase连接未建立，跳过OAuth测试');
      return;
    }
    
    try {
      // 测试OAuth URL生成
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'http://localhost:4321/auth/callback'
        }
      });
      
      if (error) {
        this.addIssue('OAuth测试', `OAuth URL生成失败: ${error.message}`);
      } else {
        this.addSuccess('OAuth测试', 'OAuth URL生成成功');
      }
    } catch (error) {
      this.addIssue('OAuth测试', `OAuth测试失败: ${error.message}`);
    }
  }

  // 生成诊断报告
  generateReport() {
    log.section('诊断报告');
    
    console.log(`\n${colors.bold}📊 诊断结果统计:${colors.reset}`);
    console.log(`${colors.green}✓ 成功: ${this.successes.length}${colors.reset}`);
    console.log(`${colors.yellow}⚠ 警告: ${this.warnings.length}${colors.reset}`);
    console.log(`${colors.red}✗ 错误: ${this.issues.length}${colors.reset}`);
    
    if (this.issues.length > 0) {
      console.log(`\n${colors.bold}${colors.red}🚨 需要修复的问题:${colors.reset}`);
      this.issues.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${colors.bold}[${issue.category}]${colors.reset} ${issue.message}`);
        if (issue.solution) {
          console.log(`   ${colors.cyan}💡 建议解决方案:${colors.reset} ${issue.solution}`);
        }
      });
    }
    
    if (this.warnings.length > 0) {
      console.log(`\n${colors.bold}${colors.yellow}⚠️  警告信息:${colors.reset}`);
      this.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${colors.bold}[${warning.category}]${colors.reset} ${warning.message}`);
      });
    }
    
    if (this.successes.length > 0) {
      console.log(`\n${colors.bold}${colors.green}✅ 正常项目:${colors.reset}`);
      this.successes.forEach((success, index) => {
        console.log(`${index + 1}. ${colors.bold}[${success.category}]${colors.reset} ${success.message}`);
      });
    }
    
    // 生成修复建议
    this.generateFixSuggestions();
  }

  generateFixSuggestions() {
    console.log(`\n${colors.bold}${colors.magenta}🔧 修复建议:${colors.reset}`);
    
    if (this.issues.some(i => i.category === '环境变量')) {
      console.log(`\n1. ${colors.bold}环境变量问题:${colors.reset}`);
      console.log('   - 确保所有必需的环境变量都已正确配置');
      console.log('   - 检查.env.local文件是否存在且包含正确的值');
      console.log('   - 确保没有使用占位符值（如your-key-here）');
    }
    
    if (this.issues.some(i => i.category === 'Supabase连接')) {
      console.log(`\n2. ${colors.bold}Supabase连接问题:${colors.reset}`);
      console.log('   - 验证Supabase URL和密钥是否正确');
      console.log('   - 检查Supabase项目是否处于活跃状态');
      console.log('   - 确保网络连接正常');
    }
    
    if (this.warnings.some(w => w.message.includes('user_profiles'))) {
      console.log(`\n3. ${colors.bold}user_profiles表问题:${colors.reset}`);
      console.log('   - 运行以下SQL清理user_profiles相关依赖:');
      console.log('   - DROP TABLE IF EXISTS user_profiles CASCADE;');
      console.log('   - 检查并移除所有相关触发器和函数');
    }
    
    if (this.issues.some(i => i.category === 'OAuth配置')) {
      console.log(`\n4. ${colors.bold}OAuth配置问题:${colors.reset}`);
      console.log('   - 在Google Cloud Console中验证OAuth客户端配置');
      console.log('   - 确保回调URL已正确添加到授权重定向URI列表');
      console.log('   - 检查客户端ID和密钥是否匹配');
    }
    
    console.log(`\n${colors.bold}${colors.cyan}🚀 下一步操作:${colors.reset}`);
    console.log('1. 根据上述建议修复所有问题');
    console.log('2. 重新运行此诊断脚本验证修复结果');
    console.log('3. 测试OAuth登录功能');
    console.log('4. 如果问题仍然存在，请检查浏览器控制台和服务器日志');
  }

  // 运行所有检查
  async runAllChecks() {
    console.log(`${colors.bold}${colors.cyan}🔍 OAuth和数据库全面诊断开始...${colors.reset}\n`);
    
    await this.checkEnvironmentVariables();
    await this.checkSupabaseConnection();
    await this.checkDatabaseSchema();
    await this.checkDatabaseTriggers();
    await this.checkOAuthConfiguration();
    await this.checkAPIEndpoints();
    await this.checkMigrationFiles();
    await this.testOAuthFlow();
    
    this.generateReport();
    
    console.log(`\n${colors.bold}${colors.cyan}✨ 诊断完成！${colors.reset}`);
    
    // 返回诊断结果
    return {
      success: this.issues.length === 0,
      issues: this.issues,
      warnings: this.warnings,
      successes: this.successes
    };
  }
}

// 主函数
async function main() {
  const diagnostic = new OAuthDiagnostic();
  
  try {
    const result = await diagnostic.runAllChecks();
    
    // 设置退出码
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error(`${colors.red}诊断脚本执行失败: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = { OAuthDiagnostic };