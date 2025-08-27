#!/usr/bin/env node

/**
 * 快速OAuth问题检查脚本
 * 专门检查导致OAuth错误的常见问题
 */

const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.bold}${colors.blue}=== ${msg} ===${colors.reset}`)
};

function checkEnvironmentVariables() {
  log.section('检查环境变量');
  
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    log.error('.env.local 文件不存在');
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const requiredVars = [
    'PUBLIC_SUPABASE_URL',
    'PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET'
  ];
  
  let allGood = true;
  
  for (const varName of requiredVars) {
    if (!envContent.includes(`${varName}=`)) {
      log.error(`缺少环境变量: ${varName}`);
      allGood = false;
    } else if (envContent.includes(`${varName}=your-`) || envContent.includes(`${varName}=xxx`)) {
      log.error(`${varName} 包含占位符值`);
      allGood = false;
    } else {
      log.success(`${varName} 已配置`);
    }
  }
  
  return allGood;
}

function checkCodeForUserProfiles() {
  log.section('检查代码中的user_profiles引用');
  
  const filesToCheck = [
    'src/pages/api/auth/sync-user.ts',
    'src/pages/auth/callback.astro',
    'src/lib/auth.ts'
  ];
  
  let foundReferences = false;
  
  for (const file of filesToCheck) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('user_profiles')) {
        log.warning(`${file} 包含user_profiles引用`);
        foundReferences = true;
      } else {
        log.success(`${file} 无user_profiles引用`);
      }
    } else {
      log.warning(`${file} 文件不存在`);
    }
  }
  
  return !foundReferences;
}

function checkMigrationFiles() {
  log.section('检查迁移文件');
  
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    log.warning('migrations目录不存在');
    return true;
  }
  
  const files = fs.readdirSync(migrationsDir);
  const sqlFiles = files.filter(f => f.endsWith('.sql'));
  
  log.info(`发现 ${sqlFiles.length} 个迁移文件`);
  
  let hasProblematicFiles = false;
  
  for (const file of sqlFiles) {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 跳过清理相关的迁移文件
    if (file.includes('cleanup') || file.includes('remove') || file.includes('final')) {
      continue;
    }
    
    // 检查是否有创建user_profiles表的语句
    if (content.includes('CREATE TABLE') && content.includes('user_profiles')) {
      log.warning(`${file} 创建user_profiles表`);
      hasProblematicFiles = true;
    }
    
    // 检查是否有触发器引用user_profiles（但不是删除操作）
    if (content.includes('CREATE TRIGGER') && content.includes('user_profiles')) {
      log.warning(`${file} 创建user_profiles触发器`);
      hasProblematicFiles = true;
    }
  }
  
  if (!hasProblematicFiles) {
    log.success('迁移文件检查通过');
  }
  
  return !hasProblematicFiles;
}

function generateQuickFix() {
  log.section('快速修复建议');
  
  console.log(`${colors.bold}如果仍然遇到 "relation 'user_profiles' does not exist" 错误:${colors.reset}`);
  console.log('');
  console.log('1. 立即执行以下SQL清理命令:');
  console.log(`   ${colors.yellow}DROP TABLE IF EXISTS user_profiles CASCADE;${colors.reset}`);
  console.log(`   ${colors.yellow}DROP FUNCTION IF EXISTS handle_new_user() CASCADE;${colors.reset}`);
  console.log('');
  console.log('2. 重启开发服务器:');
  console.log(`   ${colors.yellow}pnpm dev${colors.reset}`);
  console.log('');
  console.log('3. 清除浏览器缓存和Cookie');
  console.log('');
  console.log('4. 重新测试OAuth登录');
  console.log('');
  console.log(`${colors.bold}如果问题仍然存在，运行完整诊断:${colors.reset}`);
  console.log(`   ${colors.yellow}pnpm diagnose${colors.reset}`);
}

function main() {
  console.log(`${colors.bold}🚀 快速OAuth问题检查${colors.reset}\n`);
  
  const envOk = checkEnvironmentVariables();
  const codeOk = checkCodeForUserProfiles();
  const migrationOk = checkMigrationFiles();
  
  const allOk = envOk && codeOk && migrationOk;
  
  console.log(`\n${colors.bold}📊 检查结果:${colors.reset}`);
  console.log(`环境变量: ${envOk ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
  console.log(`代码检查: ${codeOk ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
  console.log(`迁移文件: ${migrationOk ? colors.green + '✓' : colors.red + '✗'}${colors.reset}`);
  
  if (allOk) {
    console.log(`\n${colors.green}${colors.bold}✅ 基本检查通过！${colors.reset}`);
    console.log('如果仍有问题，请运行完整诊断: pnpm diagnose');
  } else {
    console.log(`\n${colors.red}${colors.bold}❌ 发现问题！${colors.reset}`);
    generateQuickFix();
  }
  
  process.exit(allOk ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { main };