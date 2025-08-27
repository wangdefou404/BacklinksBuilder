#!/usr/bin/env node

/**
 * 全面的系统检查脚本
 * 检查环境变量、数据库连接、OAuth配置、权限等
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// 加载环境变量
function loadEnvironmentVariables() {
  const envFiles = ['.env.local', '.env', '.env.production'];
  
  for (const envFile of envFiles) {
    const envPath = path.join(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const lines = envContent.split('\n');
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine && !trimmedLine.startsWith('#')) {
          const [key, ...valueParts] = trimmedLine.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').replace(/^["']|["']$/g, '');
            process.env[key] = value;
          }
        }
      }
    }
  }
}

// 在脚本开始时加载环境变量
loadEnvironmentVariables();

// 处理环境变量别名（PUBLIC_ 和 NEXT_PUBLIC_ 前缀）
function normalizeEnvironmentVariables() {
  // 如果存在 PUBLIC_ 前缀的变量，也设置对应的 NEXT_PUBLIC_ 版本
  if (process.env.PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
  }
  if (process.env.PUBLIC_SUPABASE_ANON_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY;
  }
  if (process.env.PUBLIC_STRIPE_PUBLISHABLE_KEY && !process.env.STRIPE_PUBLISHABLE_KEY) {
    process.env.STRIPE_PUBLISHABLE_KEY = process.env.PUBLIC_STRIPE_PUBLISHABLE_KEY;
  }
}

normalizeEnvironmentVariables();

// 颜色输出
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bright: '\x1b[1m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// 检查结果收集
const checkResults = {
  environment: [],
  database: [],
  oauth: [],
  permissions: [],
  tables: [],
  functions: [],
  policies: []
};

function addResult(category, status, message, details = null) {
  checkResults[category].push({ status, message, details });
}

// 1. 检查环境变量
async function checkEnvironmentVariables() {
  logSection('1. 环境变量检查');
  
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET'
  ];
  
  const optionalRequiredEnvVars = [
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL'
  ];

  const optionalEnvVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'AHREFS_API_TOKEN'
  ];

  // 检查 .env.local 文件
  const envLocalPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) {
    logSuccess('.env.local 文件存在');
    addResult('environment', 'success', '.env.local 文件存在');
  } else {
    logError('.env.local 文件不存在');
    addResult('environment', 'error', '.env.local 文件不存在');
  }

  // 检查必需的环境变量
  for (const envVar of requiredEnvVars) {
    if (process.env[envVar]) {
      logSuccess(`${envVar}: 已设置`);
      addResult('environment', 'success', `${envVar}: 已设置`);
    } else {
      logError(`${envVar}: 未设置`);
      addResult('environment', 'error', `${envVar}: 未设置`);
    }
  }

  // 检查可选必需的环境变量（OAuth相关）
  logInfo('\nOAuth相关环境变量:');
  for (const envVar of optionalRequiredEnvVars) {
    if (process.env[envVar]) {
      logSuccess(`${envVar}: 已设置`);
      addResult('environment', 'success', `${envVar}: 已设置`);
    } else {
      logWarning(`${envVar}: 未设置 (OAuth功能可能受影响)`);
      addResult('environment', 'warning', `${envVar}: 未设置 (OAuth功能可能受影响)`);
    }
  }

  // 检查可选的环境变量
  logInfo('\n可选环境变量:');
  for (const envVar of optionalEnvVars) {
    if (process.env[envVar]) {
      logSuccess(`${envVar}: 已设置`);
      addResult('environment', 'success', `${envVar}: 已设置`);
    } else {
      logWarning(`${envVar}: 未设置`);
      addResult('environment', 'warning', `${envVar}: 未设置`);
    }
  }
}

// 2. 检查 Supabase 连接
async function checkSupabaseConnection() {
  logSection('2. Supabase 连接检查');
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      logError('Supabase URL 或 ANON KEY 未设置');
      addResult('database', 'error', 'Supabase URL 或 ANON KEY 未设置');
      return;
    }

    // 测试匿名连接
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: anonData, error: anonError } = await anonClient.from('users').select('count').limit(1);
    
    if (anonError) {
      logError(`匿名客户端连接失败: ${anonError.message}`);
      addResult('database', 'error', `匿名客户端连接失败: ${anonError.message}`);
    } else {
      logSuccess('匿名客户端连接成功');
      addResult('database', 'success', '匿名客户端连接成功');
    }

    // 测试服务角色连接
    if (supabaseServiceKey) {
      const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: serviceData, error: serviceError } = await serviceClient.from('users').select('count').limit(1);
      
      if (serviceError) {
        logError(`服务角色客户端连接失败: ${serviceError.message}`);
        addResult('database', 'error', `服务角色客户端连接失败: ${serviceError.message}`);
      } else {
        logSuccess('服务角色客户端连接成功');
        addResult('database', 'success', '服务角色客户端连接成功');
      }
    }

  } catch (error) {
    logError(`Supabase 连接检查失败: ${error.message}`);
    addResult('database', 'error', `Supabase 连接检查失败: ${error.message}`);
  }
}

// 3. 检查数据库表结构
async function checkDatabaseTables() {
  logSection('3. 数据库表结构检查');
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      logError('无法检查数据库表：缺少必要的环境变量');
      return;
    }

    const client = createClient(supabaseUrl, supabaseServiceKey);
    
    // 检查关键表是否存在
    const criticalTables = [
      'users',
      'links', 
      'categories',
      'payments',
      'subscriptions',
      'user_quotas',
      'permissions',
      'user_permissions'
    ];

    for (const tableName of criticalTables) {
      try {
        const { data, error } = await client.from(tableName).select('*').limit(1);
        
        if (error) {
          logError(`表 ${tableName}: ${error.message}`);
          addResult('tables', 'error', `表 ${tableName}: ${error.message}`);
        } else {
          logSuccess(`表 ${tableName}: 存在且可访问`);
          addResult('tables', 'success', `表 ${tableName}: 存在且可访问`);
        }
      } catch (err) {
        logError(`表 ${tableName}: 检查失败 - ${err.message}`);
        addResult('tables', 'error', `表 ${tableName}: 检查失败 - ${err.message}`);
      }
    }

    // 检查表权限
    logInfo('\n检查表权限...');
    const { data: permissions, error: permError } = await client.rpc('check_table_permissions');
    
    if (permError) {
      logWarning(`无法检查表权限: ${permError.message}`);
      addResult('permissions', 'warning', `无法检查表权限: ${permError.message}`);
    } else {
      logSuccess('表权限检查完成');
      addResult('permissions', 'success', '表权限检查完成');
    }

  } catch (error) {
    logError(`数据库表检查失败: ${error.message}`);
    addResult('tables', 'error', `数据库表检查失败: ${error.message}`);
  }
}

// 4. 检查 OAuth 配置
async function checkOAuthConfiguration() {
  logSection('4. OAuth 配置检查');
  
  // 检查 Google OAuth 配置
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (googleClientId && googleClientSecret) {
    logSuccess('Google OAuth 环境变量已设置');
    addResult('oauth', 'success', 'Google OAuth 环境变量已设置');
    
    // 检查 Google Client ID 格式
    if (googleClientId.includes('.googleusercontent.com')) {
      logSuccess('Google Client ID 格式正确');
      addResult('oauth', 'success', 'Google Client ID 格式正确');
    } else {
      logWarning('Google Client ID 格式可能不正确');
      addResult('oauth', 'warning', 'Google Client ID 格式可能不正确');
    }
  } else {
    logError('Google OAuth 配置不完整');
    addResult('oauth', 'error', 'Google OAuth 配置不完整');
  }

  // 检查 NextAuth 配置
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;
  const nextAuthUrl = process.env.NEXTAUTH_URL;
  
  if (nextAuthSecret) {
    logSuccess('NEXTAUTH_SECRET 已设置');
    addResult('oauth', 'success', 'NEXTAUTH_SECRET 已设置');
  } else {
    logError('NEXTAUTH_SECRET 未设置');
    addResult('oauth', 'error', 'NEXTAUTH_SECRET 未设置');
  }
  
  if (nextAuthUrl) {
    logSuccess(`NEXTAUTH_URL 已设置: ${nextAuthUrl}`);
    addResult('oauth', 'success', `NEXTAUTH_URL 已设置: ${nextAuthUrl}`);
  } else {
    logError('NEXTAUTH_URL 未设置');
    addResult('oauth', 'error', 'NEXTAUTH_URL 未设置');
  }
}

// 5. 检查 RLS 策略
async function checkRLSPolicies() {
  logSection('5. RLS 策略检查');
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      logError('无法检查 RLS 策略：缺少必要的环境变量');
      return;
    }

    const client = createClient(supabaseUrl, supabaseServiceKey);
    
    // 检查 RLS 是否启用
    const tablesWithRLS = ['users', 'links', 'categories', 'payments', 'subscriptions'];
    
    for (const tableName of tablesWithRLS) {
      try {
        // 这里应该查询 pg_tables 或使用 Supabase 的管理 API
        // 由于权限限制，我们只能尝试基本的访问测试
        const { data, error } = await client.from(tableName).select('*').limit(1);
        
        if (error && error.message.includes('RLS')) {
          logSuccess(`表 ${tableName}: RLS 已启用`);
          addResult('policies', 'success', `表 ${tableName}: RLS 已启用`);
        } else if (!error) {
          logWarning(`表 ${tableName}: 可能未启用 RLS 或策略过于宽松`);
          addResult('policies', 'warning', `表 ${tableName}: 可能未启用 RLS 或策略过于宽松`);
        }
      } catch (err) {
        logError(`表 ${tableName}: RLS 检查失败 - ${err.message}`);
        addResult('policies', 'error', `表 ${tableName}: RLS 检查失败 - ${err.message}`);
      }
    }

  } catch (error) {
    logError(`RLS 策略检查失败: ${error.message}`);
    addResult('policies', 'error', `RLS 策略检查失败: ${error.message}`);
  }
}

// 6. 检查数据库函数和触发器
async function checkDatabaseFunctions() {
  logSection('6. 数据库函数和触发器检查');
  
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      logError('无法检查数据库函数：缺少必要的环境变量');
      return;
    }

    const client = createClient(supabaseUrl, supabaseServiceKey);
    
    // 检查常用的数据库函数
    const functions = [
      'handle_new_user',
      'check_user_permissions',
      'update_user_quota',
      'reset_monthly_quotas'
    ];

    for (const funcName of functions) {
      try {
        // 尝试调用函数（如果存在的话）
        const { data, error } = await client.rpc(funcName, {});
        
        if (error && error.message.includes('function') && error.message.includes('does not exist')) {
          logWarning(`函数 ${funcName}: 不存在`);
          addResult('functions', 'warning', `函数 ${funcName}: 不存在`);
        } else if (error) {
          logInfo(`函数 ${funcName}: 存在但调用失败 (${error.message})`);
          addResult('functions', 'info', `函数 ${funcName}: 存在但调用失败`);
        } else {
          logSuccess(`函数 ${funcName}: 存在且可调用`);
          addResult('functions', 'success', `函数 ${funcName}: 存在且可调用`);
        }
      } catch (err) {
        logError(`函数 ${funcName}: 检查失败 - ${err.message}`);
        addResult('functions', 'error', `函数 ${funcName}: 检查失败 - ${err.message}`);
      }
    }

  } catch (error) {
    logError(`数据库函数检查失败: ${error.message}`);
    addResult('functions', 'error', `数据库函数检查失败: ${error.message}`);
  }
}

// 7. 生成诊断报告
function generateDiagnosticReport() {
  logSection('7. 诊断报告');
  
  let totalIssues = 0;
  let criticalIssues = 0;
  
  for (const [category, results] of Object.entries(checkResults)) {
    const errors = results.filter(r => r.status === 'error').length;
    const warnings = results.filter(r => r.status === 'warning').length;
    const successes = results.filter(r => r.status === 'success').length;
    
    totalIssues += errors + warnings;
    criticalIssues += errors;
    
    log(`\n${category.toUpperCase()}:`);
    log(`  ✅ 成功: ${successes}`, 'green');
    log(`  ⚠️  警告: ${warnings}`, 'yellow');
    log(`  ❌ 错误: ${errors}`, 'red');
  }
  
  log('\n' + '='.repeat(60));
  log('总结:', 'cyan');
  log(`总问题数: ${totalIssues}`, totalIssues > 0 ? 'yellow' : 'green');
  log(`严重问题数: ${criticalIssues}`, criticalIssues > 0 ? 'red' : 'green');
  
  if (criticalIssues > 0) {
    log('\n🚨 发现严重问题，需要立即修复！', 'red');
  } else if (totalIssues > 0) {
    log('\n⚠️  发现一些警告，建议检查和修复。', 'yellow');
  } else {
    log('\n🎉 所有检查都通过了！', 'green');
  }
  
  // 生成修复建议
  generateFixSuggestions();
}

// 8. 生成修复建议
function generateFixSuggestions() {
  logSection('8. 修复建议');
  
  const allErrors = [];
  const allWarnings = [];
  
  for (const [category, results] of Object.entries(checkResults)) {
    allErrors.push(...results.filter(r => r.status === 'error'));
    allWarnings.push(...results.filter(r => r.status === 'warning'));
  }
  
  if (allErrors.length > 0) {
    log('\n🔧 错误修复建议:', 'red');
    allErrors.forEach((error, index) => {
      log(`${index + 1}. ${error.message}`);
      
      // 提供具体的修复建议
      if (error.message.includes('env.local')) {
        log('   💡 创建 .env.local 文件并添加必要的环境变量', 'blue');
      } else if (error.message.includes('SUPABASE')) {
        log('   💡 检查 Supabase 项目设置和 API 密钥', 'blue');
      } else if (error.message.includes('GOOGLE')) {
        log('   💡 检查 Google Cloud Console 中的 OAuth 配置', 'blue');
      } else if (error.message.includes('NEXTAUTH')) {
        log('   💡 设置 NextAuth 相关环境变量', 'blue');
      } else if (error.message.includes('表')) {
        log('   💡 检查数据库迁移和表权限设置', 'blue');
      }
    });
  }
  
  if (allWarnings.length > 0) {
    log('\n⚠️  警告处理建议:', 'yellow');
    allWarnings.forEach((warning, index) => {
      log(`${index + 1}. ${warning.message}`);
    });
  }
  
  // 通用建议
  log('\n📋 通用建议:', 'cyan');
  log('1. 确保所有环境变量都已正确设置');
  log('2. 检查 Supabase 项目的 RLS 策略');
  log('3. 验证 OAuth 提供商的配置');
  log('4. 确保数据库迁移已正确执行');
  log('5. 检查网络连接和防火墙设置');
}

// 主函数
async function main() {
  log('🔍 开始全面系统检查...', 'bright');
  log(`检查时间: ${new Date().toLocaleString()}`, 'blue');
  
  try {
    await checkEnvironmentVariables();
    await checkSupabaseConnection();
    await checkDatabaseTables();
    await checkOAuthConfiguration();
    await checkRLSPolicies();
    await checkDatabaseFunctions();
    generateDiagnosticReport();
    
    // 保存报告到文件
    const reportPath = path.join(process.cwd(), 'diagnostic-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      results: checkResults
    }, null, 2));
    
    log(`\n📄 详细报告已保存到: ${reportPath}`, 'blue');
    
  } catch (error) {
    logError(`检查过程中发生错误: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  checkEnvironmentVariables,
  checkSupabaseConnection,
  checkDatabaseTables,
  checkOAuthConfiguration,
  checkRLSPolicies,
  checkDatabaseFunctions,
  generateDiagnosticReport
};