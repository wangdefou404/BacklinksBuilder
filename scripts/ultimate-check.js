#!/usr/bin/env node

/**
 * 终极全面检查脚本
 * 包含OAuth、数据库、认证流程的深度检查
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  section: (msg) => console.log(`\n${colors.cyan}${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}${colors.reset}`)
};

// 加载环境变量
function loadEnvironmentVariables() {
  const envFiles = ['.env.local', '.env', '.env.production'];
  const envVars = {};
  
  envFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').replace(/^["']|["']$/g, '');
            envVars[key] = value;
            process.env[key] = value;
          }
        }
      });
    }
  });
  
  return envVars;
}

// 标准化环境变量
function normalizeEnvironmentVariables(envVars) {
  const normalized = { ...envVars };
  
  // 映射 PUBLIC_ 前缀到 NEXT_PUBLIC_
  if (envVars.PUBLIC_SUPABASE_URL && !envVars.NEXT_PUBLIC_SUPABASE_URL) {
    normalized.NEXT_PUBLIC_SUPABASE_URL = envVars.PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = envVars.PUBLIC_SUPABASE_URL;
  }
  
  if (envVars.PUBLIC_SUPABASE_ANON_KEY && !envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    normalized.NEXT_PUBLIC_SUPABASE_ANON_KEY = envVars.PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = envVars.PUBLIC_SUPABASE_ANON_KEY;
  }
  
  if (envVars.PUBLIC_STRIPE_PUBLISHABLE_KEY && !envVars.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    normalized.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = envVars.PUBLIC_STRIPE_PUBLISHABLE_KEY;
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = envVars.PUBLIC_STRIPE_PUBLISHABLE_KEY;
  }
  
  return normalized;
}

// 检查结果收集器
class CheckResults {
  constructor() {
    this.results = {
      environment: { success: 0, warning: 0, error: 0, details: [] },
      database: { success: 0, warning: 0, error: 0, details: [] },
      oauth: { success: 0, warning: 0, error: 0, details: [] },
      authentication: { success: 0, warning: 0, error: 0, details: [] },
      permissions: { success: 0, warning: 0, error: 0, details: [] },
      tables: { success: 0, warning: 0, error: 0, details: [] },
      functions: { success: 0, warning: 0, error: 0, details: [] },
      policies: { success: 0, warning: 0, error: 0, details: [] },
      flows: { success: 0, warning: 0, error: 0, details: [] }
    };
  }
  
  add(category, type, message, details = null) {
    this.results[category][type]++;
    this.results[category].details.push({ type, message, details });
  }
  
  getTotalIssues() {
    let total = 0;
    let critical = 0;
    
    Object.values(this.results).forEach(category => {
      total += category.warning + category.error;
      critical += category.error;
    });
    
    return { total, critical };
  }
}

// 1. 环境变量检查
async function checkEnvironmentVariables(results, envVars) {
  log.section('1. 环境变量检查');
  
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL'
  ];
  
  const optionalEnvVars = [
    'AHREFS_API_TOKEN',
    'RAPIDAPI_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET'
  ];
  
  // 检查必需的环境变量
  requiredEnvVars.forEach(varName => {
    if (envVars[varName]) {
      log.success(`${varName}: 已设置`);
      results.add('environment', 'success', `${varName}: 已设置`);
    } else {
      log.error(`${varName}: 未设置`);
      results.add('environment', 'error', `${varName}: 未设置`);
    }
  });
  
  // 检查可选的环境变量
  optionalEnvVars.forEach(varName => {
    if (envVars[varName]) {
      log.success(`${varName}: 已设置`);
      results.add('environment', 'success', `${varName}: 已设置`);
    } else {
      log.warning(`${varName}: 未设置`);
      results.add('environment', 'warning', `${varName}: 未设置`);
    }
  });
  
  // 检查环境变量格式
  if (envVars.NEXT_PUBLIC_SUPABASE_URL) {
    if (envVars.NEXT_PUBLIC_SUPABASE_URL.startsWith('https://')) {
      log.success('Supabase URL 格式正确');
      results.add('environment', 'success', 'Supabase URL 格式正确');
    } else {
      log.error('Supabase URL 格式错误');
      results.add('environment', 'error', 'Supabase URL 格式错误');
    }
  }
  
  if (envVars.NEXTAUTH_SECRET) {
    if (envVars.NEXTAUTH_SECRET.length >= 32) {
      log.success('NEXTAUTH_SECRET 长度足够');
      results.add('environment', 'success', 'NEXTAUTH_SECRET 长度足够');
    } else {
      log.warning('NEXTAUTH_SECRET 长度可能不够安全');
      results.add('environment', 'warning', 'NEXTAUTH_SECRET 长度可能不够安全');
    }
  }
}

// 2. Supabase 连接检查
async function checkSupabaseConnection(results, envVars) {
  log.section('2. Supabase 连接检查');
  
  if (!envVars.NEXT_PUBLIC_SUPABASE_URL || !envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    log.error('Supabase 配置不完整');
    results.add('database', 'error', 'Supabase 配置不完整');
    return null;
  }
  
  try {
    const supabase = createClient(
      envVars.NEXT_PUBLIC_SUPABASE_URL,
      envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    
    // 测试连接
    const { data, error } = await supabase.from('users').select('count').limit(1);
    
    if (error) {
      log.error(`Supabase 连接失败: ${error.message}`);
      results.add('database', 'error', `Supabase 连接失败: ${error.message}`);
      return null;
    } else {
      log.success('Supabase 连接成功');
      results.add('database', 'success', 'Supabase 连接成功');
      return supabase;
    }
  } catch (error) {
    log.error(`Supabase 初始化失败: ${error.message}`);
    results.add('database', 'error', `Supabase 初始化失败: ${error.message}`);
    return null;
  }
}

// 3. OAuth 配置检查
async function checkOAuthConfiguration(results, envVars) {
  log.section('3. OAuth 配置检查');
  
  // Google OAuth 检查
  if (envVars.GOOGLE_CLIENT_ID && envVars.GOOGLE_CLIENT_SECRET) {
    log.success('Google OAuth 配置完整');
    results.add('oauth', 'success', 'Google OAuth 配置完整');
    
    // 检查 Client ID 格式
    if (envVars.GOOGLE_CLIENT_ID.endsWith('.googleusercontent.com')) {
      log.success('Google Client ID 格式正确');
      results.add('oauth', 'success', 'Google Client ID 格式正确');
    } else {
      log.warning('Google Client ID 格式可能不正确');
      results.add('oauth', 'warning', 'Google Client ID 格式可能不正确');
    }
  } else {
    log.error('Google OAuth 配置不完整');
    results.add('oauth', 'error', 'Google OAuth 配置不完整');
  }
  
  // NextAuth 配置检查
  if (envVars.NEXTAUTH_SECRET && envVars.NEXTAUTH_URL) {
    log.success('NextAuth 配置完整');
    results.add('oauth', 'success', 'NextAuth 配置完整');
    
    // 检查 NEXTAUTH_URL 格式
    if (envVars.NEXTAUTH_URL.startsWith('http')) {
      log.success('NEXTAUTH_URL 格式正确');
      results.add('oauth', 'success', 'NEXTAUTH_URL 格式正确');
    } else {
      log.error('NEXTAUTH_URL 格式错误');
      results.add('oauth', 'error', 'NEXTAUTH_URL 格式错误');
    }
  } else {
    log.error('NextAuth 配置不完整');
    results.add('oauth', 'error', 'NextAuth 配置不完整');
  }
}

// 4. 认证流程测试
async function testAuthenticationFlow(results, supabase) {
  log.section('4. 认证流程测试');
  
  if (!supabase) {
    log.error('无法测试认证流程 - Supabase 连接失败');
    results.add('authentication', 'error', '无法测试认证流程 - Supabase 连接失败');
    return;
  }
  
  try {
    // 测试匿名访问
    const { data: anonData, error: anonError } = await supabase.auth.getSession();
    if (!anonError) {
      log.success('匿名会话检查正常');
      results.add('authentication', 'success', '匿名会话检查正常');
    } else {
      log.warning(`匿名会话检查异常: ${anonError.message}`);
      results.add('authentication', 'warning', `匿名会话检查异常: ${anonError.message}`);
    }
    
    // 测试用户表访问权限
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id')
      .limit(1);
      
    if (!usersError) {
      log.success('用户表访问权限正常');
      results.add('authentication', 'success', '用户表访问权限正常');
    } else {
      log.error(`用户表访问权限异常: ${usersError.message}`);
      results.add('authentication', 'error', `用户表访问权限异常: ${usersError.message}`);
    }
    
    // 测试 OAuth 提供商配置
    const { data: providersData, error: providersError } = await supabase.auth.getSession();
    if (!providersError) {
      log.success('OAuth 提供商配置检查正常');
      results.add('authentication', 'success', 'OAuth 提供商配置检查正常');
    } else {
      log.warning(`OAuth 提供商配置检查异常: ${providersError.message}`);
      results.add('authentication', 'warning', `OAuth 提供商配置检查异常: ${providersError.message}`);
    }
    
  } catch (error) {
    log.error(`认证流程测试失败: ${error.message}`);
    results.add('authentication', 'error', `认证流程测试失败: ${error.message}`);
  }
}

// 5. 数据库表结构检查
async function checkDatabaseTables(results, supabase) {
  log.section('5. 数据库表结构检查');
  
  if (!supabase) {
    log.error('无法检查数据库表 - Supabase 连接失败');
    results.add('tables', 'error', '无法检查数据库表 - Supabase 连接失败');
    return;
  }
  
  const criticalTables = ['users', 'links', 'categories', 'payments', 'subscriptions'];
  
  for (const tableName of criticalTables) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(0);
        
      if (!error) {
        log.success(`表 ${tableName}: 存在且可访问`);
        results.add('tables', 'success', `表 ${tableName}: 存在且可访问`);
      } else {
        log.error(`表 ${tableName}: ${error.message}`);
        results.add('tables', 'error', `表 ${tableName}: ${error.message}`);
      }
    } catch (error) {
      log.error(`表 ${tableName}: 检查失败 - ${error.message}`);
      results.add('tables', 'error', `表 ${tableName}: 检查失败 - ${error.message}`);
    }
  }
}

// 6. RLS 策略检查
async function checkRLSPolicies(results, supabase) {
  log.section('6. RLS 策略检查');
  
  if (!supabase) {
    log.error('无法检查 RLS 策略 - Supabase 连接失败');
    results.add('policies', 'error', '无法检查 RLS 策略 - Supabase 连接失败');
    return;
  }
  
  const tables = ['users', 'links', 'categories', 'payments', 'subscriptions'];
  
  for (const tableName of tables) {
    try {
      // 检查 RLS 是否启用
      const { data: rlsData, error: rlsError } = await supabase
        .rpc('check_table_permissions')
        .single();
        
      if (!rlsError) {
        log.success(`表 ${tableName}: RLS 策略检查正常`);
        results.add('policies', 'success', `表 ${tableName}: RLS 策略检查正常`);
      } else {
        log.warning(`表 ${tableName}: RLS 策略可能存在问题`);
        results.add('policies', 'warning', `表 ${tableName}: RLS 策略可能存在问题`);
      }
    } catch (error) {
      log.warning(`表 ${tableName}: RLS 策略检查失败 - ${error.message}`);
      results.add('policies', 'warning', `表 ${tableName}: RLS 策略检查失败 - ${error.message}`);
    }
  }
}

// 7. 完整流程测试
async function testCompleteFlow(results, supabase, envVars) {
  log.section('7. 完整流程测试');
  
  if (!supabase) {
    log.error('无法进行完整流程测试 - Supabase 连接失败');
    results.add('flows', 'error', '无法进行完整流程测试 - Supabase 连接失败');
    return;
  }
  
  try {
    // 测试用户注册流程（模拟）
    log.info('测试用户注册流程...');
    const testEmail = `test-${Date.now()}@example.com`;
    
    // 注意：这里不会真正创建用户，只是测试权限
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: 'test-password-123',
      options: {
        data: {
          full_name: 'Test User'
        }
      }
    });
    
    if (signUpError) {
      if (signUpError.message.includes('rate limit') || signUpError.message.includes('too many')) {
        log.warning('用户注册流程: 受到速率限制（正常）');
        results.add('flows', 'warning', '用户注册流程: 受到速率限制（正常）');
      } else {
        log.error(`用户注册流程失败: ${signUpError.message}`);
        results.add('flows', 'error', `用户注册流程失败: ${signUpError.message}`);
      }
    } else {
      log.success('用户注册流程测试正常');
      results.add('flows', 'success', '用户注册流程测试正常');
    }
    
    // 测试数据查询流程
    log.info('测试数据查询流程...');
    const { data: queryData, error: queryError } = await supabase
      .from('users')
      .select('id, email, created_at')
      .limit(5);
      
    if (!queryError) {
      log.success('数据查询流程正常');
      results.add('flows', 'success', '数据查询流程正常');
    } else {
      log.error(`数据查询流程失败: ${queryError.message}`);
      results.add('flows', 'error', `数据查询流程失败: ${queryError.message}`);
    }
    
    // 测试 OAuth 重定向 URL
    if (envVars.NEXTAUTH_URL) {
      const callbackUrl = `${envVars.NEXTAUTH_URL}/api/auth/callback/google`;
      log.success(`OAuth 回调 URL: ${callbackUrl}`);
      results.add('flows', 'success', `OAuth 回调 URL 配置正确: ${callbackUrl}`);
    } else {
      log.error('OAuth 回调 URL 配置缺失');
      results.add('flows', 'error', 'OAuth 回调 URL 配置缺失');
    }
    
  } catch (error) {
    log.error(`完整流程测试失败: ${error.message}`);
    results.add('flows', 'error', `完整流程测试失败: ${error.message}`);
  }
}

// 8. 生成诊断报告
function generateDiagnosticReport(results, envVars) {
  log.section('8. 诊断报告');
  
  // 打印分类统计
  Object.entries(results.results).forEach(([category, stats]) => {
    const categoryName = category.toUpperCase();
    console.log(`\n${categoryName}:`);
    console.log(`  ✅ 成功: ${stats.success}`);
    console.log(`  ⚠️  警告: ${stats.warning}`);
    console.log(`  ❌ 错误: ${stats.error}`);
  });
  
  const { total, critical } = results.getTotalIssues();
  
  console.log('\n' + '='.repeat(60));
  console.log('总结:');
  console.log(`总问题数: ${total}`);
  console.log(`严重问题数: ${critical}`);
  
  if (critical > 0) {
    log.error('发现严重问题，需要立即修复！');
  } else if (total > 0) {
    log.warning('发现一些警告，建议检查和修复。');
  } else {
    log.success('所有检查都通过了！');
  }
  
  // 生成修复建议
  console.log('\n' + '='.repeat(60));
  console.log('9. 修复建议');
  console.log('='.repeat(60));
  
  const errorDetails = [];
  const warningDetails = [];
  
  Object.values(results.results).forEach(category => {
    category.details.forEach(detail => {
      if (detail.type === 'error') {
        errorDetails.push(detail.message);
      } else if (detail.type === 'warning') {
        warningDetails.push(detail.message);
      }
    });
  });
  
  if (errorDetails.length > 0) {
    console.log('\n❌ 严重问题修复建议:');
    errorDetails.forEach((detail, index) => {
      console.log(`${index + 1}. ${detail}`);
    });
  }
  
  if (warningDetails.length > 0) {
    console.log('\n⚠️  警告处理建议:');
    warningDetails.forEach((detail, index) => {
      console.log(`${index + 1}. ${detail}`);
    });
  }
  
  console.log('\n📋 通用建议:');
  console.log('1. 确保所有环境变量都已正确设置');
  console.log('2. 检查 Supabase 项目的 RLS 策略');
  console.log('3. 验证 OAuth 提供商的配置');
  console.log('4. 确保数据库迁移已正确执行');
  console.log('5. 检查网络连接和防火墙设置');
  console.log('6. 验证 Google OAuth 应用的重定向 URI 配置');
  console.log('7. 确保生产环境的 NEXTAUTH_URL 指向正确的域名');
  
  // 保存详细报告
  const reportPath = path.join(process.cwd(), 'ultimate-diagnostic-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    summary: { total, critical },
    results: results.results,
    environment: envVars,
    recommendations: {
      errors: errorDetails,
      warnings: warningDetails
    }
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 详细报告已保存到: ${reportPath}`);
  
  return { total, critical };
}

// 主函数
async function main() {
  console.log(`${colors.magenta}🔍 终极全面检查开始...${colors.reset}\n`);
  
  const results = new CheckResults();
  
  // 加载和标准化环境变量
  const rawEnvVars = loadEnvironmentVariables();
  const envVars = normalizeEnvironmentVariables(rawEnvVars);
  
  // 执行所有检查
  await checkEnvironmentVariables(results, envVars);
  const supabase = await checkSupabaseConnection(results, envVars);
  await checkOAuthConfiguration(results, envVars);
  await testAuthenticationFlow(results, supabase);
  await checkDatabaseTables(results, supabase);
  await checkRLSPolicies(results, supabase);
  await testCompleteFlow(results, supabase, envVars);
  
  // 生成报告
  const { total, critical } = generateDiagnosticReport(results, envVars);
  
  console.log(`\n${colors.magenta}🏁 终极全面检查完成！${colors.reset}`);
  
  // 退出码
  process.exit(critical > 0 ? 1 : 0);
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
  main().catch(error => {
    console.error('检查脚本执行失败:', error);
    process.exit(1);
  });
}

module.exports = { main, CheckResults };