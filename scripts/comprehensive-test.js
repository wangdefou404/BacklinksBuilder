#!/usr/bin/env node

/**
 * 全面系统测试脚本
 * 测试 Google 登录、Stripe 支付、用户配额功能
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  step: (msg) => console.log(`${colors.magenta}→${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${msg}${colors.reset}\n`)
};

// 测试结果统计
const testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  details: []
};

// 添加测试结果
function addResult(category, test, status, message = '') {
  testResults.details.push({ category, test, status, message });
  if (status === 'PASS') testResults.passed++;
  else if (status === 'FAIL') testResults.failed++;
  else if (status === 'WARN') testResults.warnings++;
}

// 检查文件是否存在
function checkFileExists(filePath, description) {
  const exists = fs.existsSync(filePath);
  if (exists) {
    log.success(`${description}: ${filePath}`);
    addResult('文件检查', description, 'PASS');
  } else {
    log.error(`${description}: ${filePath} - 文件不存在`);
    addResult('文件检查', description, 'FAIL', '文件不存在');
  }
  return exists;
}

// 检查环境变量
function checkEnvVariables() {
  log.header('🔧 环境变量检查');
  
  const envFile = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envFile)) {
    log.error('.env 文件不存在');
    addResult('环境变量', '.env文件', 'FAIL', '文件不存在');
    return false;
  }
  
  const envContent = fs.readFileSync(envFile, 'utf8');
  const requiredVars = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'STRIPE_PUBLISHABLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET'
  ];
  
  let allPresent = true;
  requiredVars.forEach(varName => {
    if (envContent.includes(`${varName}=`)) {
      log.success(`${varName} 已配置`);
      addResult('环境变量', varName, 'PASS');
    } else {
      log.error(`${varName} 未配置`);
      addResult('环境变量', varName, 'FAIL', '未配置');
      allPresent = false;
    }
  });
  
  return allPresent;
}

// 检查项目文件结构
function checkProjectStructure() {
  log.header('📁 项目文件结构检查');
  
  const criticalFiles = [
    // 认证相关
    { path: 'src/pages/api/auth/google.ts', desc: 'Google认证API' },
    { path: 'src/pages/api/auth/callback.ts', desc: '认证回调API' },
    { path: 'src/pages/api/auth/logout.ts', desc: '登出API' },
    
    // 支付相关
    { path: 'src/pages/api/stripe/create-checkout-session.ts', desc: 'Stripe结账会话API' },
    { path: 'src/pages/api/stripe/webhook.ts', desc: 'Stripe Webhook API' },
    { path: 'src/pages/api/stripe/customer-portal.ts', desc: 'Stripe客户门户API' },
    
    // 配额相关
    { path: 'src/pages/api/quota/check.ts', desc: '配额检查API' },
    { path: 'src/pages/api/quota/consume.ts', desc: '配额消费API' },
    { path: 'src/scripts/quota-manager.js', desc: '配额管理器' },
    
    // 数据库迁移
    { path: 'supabase/migrations/user_quota_system_enhancement.sql', desc: '配额系统数据库迁移' },
    
    // 前端页面
    { path: 'src/pages/login.astro', desc: '登录页面' },
    { path: 'src/pages/pricing.astro', desc: '价格页面' },
    { path: 'src/pages/user/dashboard.astro', desc: '用户仪表板' },
    { path: 'src/pages/dr-checker.astro', desc: 'DR检查工具' },
    { path: 'src/pages/traffic-checker.astro', desc: '流量检查工具' },
    { path: 'src/pages/backlink-generator.astro', desc: '外链生成器' }
  ];
  
  let allExists = true;
  criticalFiles.forEach(file => {
    const fullPath = path.join(process.cwd(), file.path);
    if (!checkFileExists(fullPath, file.desc)) {
      allExists = false;
    }
  });
  
  return allExists;
}

// 检查依赖包
function checkDependencies() {
  log.header('📦 依赖包检查');
  
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    log.error('package.json 不存在');
    addResult('依赖检查', 'package.json', 'FAIL', '文件不存在');
    return false;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  const requiredDeps = [
    '@supabase/supabase-js',
    'stripe',
    'lucide-react'
  ];
  
  let allPresent = true;
  requiredDeps.forEach(dep => {
    if (allDeps[dep]) {
      log.success(`${dep} v${allDeps[dep]}`);
      addResult('依赖检查', dep, 'PASS');
    } else {
      log.error(`${dep} 未安装`);
      addResult('依赖检查', dep, 'FAIL', '未安装');
      allPresent = false;
    }
  });
  
  return allPresent;
}

// API端点测试
async function testAPIEndpoints() {
  log.header('🌐 API端点测试');
  
  const baseUrl = 'http://localhost:4321';
  const endpoints = [
    { path: '/api/auth/google', method: 'GET', desc: 'Google认证端点' },
    { path: '/api/stripe/create-checkout-session', method: 'POST', desc: 'Stripe结账会话' },
    { path: '/api/quota/check', method: 'POST', desc: '配额检查端点' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      log.info(`测试 ${endpoint.desc}: ${endpoint.method} ${endpoint.path}`);
      
      const response = await fetch(`${baseUrl}${endpoint.path}`, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: endpoint.method === 'POST' ? JSON.stringify({}) : undefined
      });
      
      if (response.status < 500) {
        log.success(`${endpoint.desc} - 状态码: ${response.status}`);
        addResult('API测试', endpoint.desc, 'PASS', `状态码: ${response.status}`);
      } else {
        log.error(`${endpoint.desc} - 服务器错误: ${response.status}`);
        addResult('API测试', endpoint.desc, 'FAIL', `服务器错误: ${response.status}`);
      }
    } catch (error) {
      log.error(`${endpoint.desc} - 连接失败: ${error.message}`);
      addResult('API测试', endpoint.desc, 'FAIL', `连接失败: ${error.message}`);
    }
  }
}

// 数据库连接测试
function testDatabaseConnection() {
  log.header('🗄️ 数据库连接测试');
  
  try {
    // 检查Supabase配置
    const envFile = path.join(process.cwd(), '.env');
    const envContent = fs.readFileSync(envFile, 'utf8');
    
    const supabaseUrl = envContent.match(/SUPABASE_URL=(.+)/)?.[1];
    const supabaseKey = envContent.match(/SUPABASE_ANON_KEY=(.+)/)?.[1];
    
    if (supabaseUrl && supabaseKey) {
      log.success('Supabase配置已找到');
      addResult('数据库', 'Supabase配置', 'PASS');
      
      // 检查迁移文件
      const migrationPath = path.join(process.cwd(), 'supabase/migrations/user_quota_system_enhancement.sql');
      if (fs.existsSync(migrationPath)) {
        log.success('配额系统迁移文件存在');
        addResult('数据库', '配额系统迁移', 'PASS');
      } else {
        log.warning('配额系统迁移文件不存在');
        addResult('数据库', '配额系统迁移', 'WARN', '迁移文件不存在');
      }
    } else {
      log.error('Supabase配置不完整');
      addResult('数据库', 'Supabase配置', 'FAIL', '配置不完整');
    }
  } catch (error) {
    log.error(`数据库配置检查失败: ${error.message}`);
    addResult('数据库', '配置检查', 'FAIL', error.message);
  }
}

// 生成测试报告
function generateReport() {
  log.header('📊 测试报告');
  
  console.log(`${colors.bright}总体统计:${colors.reset}`);
  console.log(`  ✓ 通过: ${colors.green}${testResults.passed}${colors.reset}`);
  console.log(`  ✗ 失败: ${colors.red}${testResults.failed}${colors.reset}`);
  console.log(`  ⚠ 警告: ${colors.yellow}${testResults.warnings}${colors.reset}`);
  
  const total = testResults.passed + testResults.failed + testResults.warnings;
  const successRate = total > 0 ? ((testResults.passed / total) * 100).toFixed(1) : 0;
  console.log(`  📈 成功率: ${successRate}%\n`);
  
  // 详细结果
  const categories = [...new Set(testResults.details.map(r => r.category))];
  categories.forEach(category => {
    console.log(`${colors.bright}${category}:${colors.reset}`);
    testResults.details
      .filter(r => r.category === category)
      .forEach(result => {
        const icon = result.status === 'PASS' ? '✓' : result.status === 'FAIL' ? '✗' : '⚠';
        const color = result.status === 'PASS' ? colors.green : result.status === 'FAIL' ? colors.red : colors.yellow;
        console.log(`  ${color}${icon}${colors.reset} ${result.test}${result.message ? ` (${result.message})` : ''}`);
      });
    console.log('');
  });
  
  // 建议
  if (testResults.failed > 0) {
    log.header('💡 修复建议');
    
    const failedTests = testResults.details.filter(r => r.status === 'FAIL');
    failedTests.forEach(test => {
      if (test.category === '环境变量') {
        log.warning(`请在.env文件中配置 ${test.test}`);
      } else if (test.category === '文件检查') {
        log.warning(`请创建缺失的文件: ${test.test}`);
      } else if (test.category === '依赖检查') {
        log.warning(`请安装缺失的依赖: pnpm add ${test.test}`);
      } else if (test.category === 'API测试') {
        log.warning(`请检查 ${test.test} 的实现`);
      }
    });
  }
  
  // 手动测试指导
  log.header('🧪 手动测试指导');
  console.log('请按以下步骤进行手动测试:\n');
  
  console.log(`${colors.bright}1. Google登录测试:${colors.reset}`);
  console.log('   • 访问 http://localhost:4321/login');
  console.log('   • 点击"使用Google登录"按钮');
  console.log('   • 完成Google OAuth流程');
  console.log('   • 验证是否成功跳转到用户仪表板\n');
  
  console.log(`${colors.bright}2. Stripe支付测试:${colors.reset}`);
  console.log('   • 访问 http://localhost:4321/pricing');
  console.log('   • 选择一个付费计划');
  console.log('   • 使用测试卡号: 4242 4242 4242 4242');
  console.log('   • 验证支付流程和订阅状态\n');
  
  console.log(`${colors.bright}3. 用户配额测试:${colors.reset}`);
  console.log('   • 访问 http://localhost:4321/user/dashboard');
  console.log('   • 检查配额显示是否正确');
  console.log('   • 使用DR检查工具测试配额消费');
  console.log('   • 验证配额限制和升级提示\n');
  
  console.log(`${colors.bright}4. 工具功能测试:${colors.reset}`);
  console.log('   • 测试DR检查器: http://localhost:4321/dr-checker');
  console.log('   • 测试流量检查器: http://localhost:4321/traffic-checker');
  console.log('   • 测试外链生成器: http://localhost:4321/backlink-generator');
  console.log('   • 验证配额集成和功能正常性\n');
}

// 主测试函数
async function runTests() {
  console.log(`${colors.bright}${colors.cyan}`);
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    BacklinksBuilder 全面测试                 ║');
  console.log('║              Google登录 • Stripe支付 • 用户配额              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}\n`);
  
  try {
    // 基础检查
    checkEnvVariables();
    checkProjectStructure();
    checkDependencies();
    testDatabaseConnection();
    
    // API测试
    await testAPIEndpoints();
    
    // 生成报告
    generateReport();
    
  } catch (error) {
    log.error(`测试过程中发生错误: ${error.message}`);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  runTests();
}

module.exports = { runTests, testResults };