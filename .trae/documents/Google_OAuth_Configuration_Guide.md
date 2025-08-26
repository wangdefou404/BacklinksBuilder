# BacklinksBuilder Google OAuth 配置操作指南

## 📋 概述

本文档将详细指导您如何为 BacklinksBuilder 项目配置 Google OAuth 登录功能。请按照以下步骤顺序执行，确保每个步骤都正确完成后再进行下一步。

## ✅ 前置条件检查

在开始配置之前，请确认以下条件已满足：

- [x] 已完成 Google OAuth 代码集成
- [x] 拥有 Google 账户
- [x] 拥有 Supabase 项目访问权限
- [x] 项目已部署或准备部署到生产环境

---

## 🔧 步骤 1：在 Google Cloud Console 配置 OAuth 2.0 凭据

### 1.1 创建 Google Cloud 项目

1. **访问 Google Cloud Console**
   - 打开浏览器，访问：https://console.cloud.google.com/
   - 使用您的 Google 账户登录

2. **创建新项目**
   - 点击页面顶部的项目选择器
   - 点击「新建项目」按钮
   - 填写项目信息：
     ```
     项目名称: BacklinksBuilder
     组织: (可选)
     位置: (可选)
     ```
   - 点击「创建」按钮
   - 等待项目创建完成（通常需要几秒钟）

### 1.2 启用必要的 API

1. **导航到 API 库**
   - 在左侧菜单中，点击「API 和服务」→「库」
   - 或直接访问：https://console.cloud.google.com/apis/library

2. **启用 Google+ API**
   - 在搜索框中输入「Google+ API」
   - 点击搜索结果中的「Google+ API」
   - 点击「启用」按钮
   - 等待 API 启用完成

3. **启用 Google People API（可选但推荐）**
   - 返回 API 库页面
   - 搜索「Google People API」
   - 点击并启用该 API

### 1.3 配置 OAuth 同意屏幕

1. **导航到 OAuth 同意屏幕**
   - 在左侧菜单中，点击「API 和服务」→「OAuth 同意屏幕」

2. **选择用户类型**
   - 选择「外部」（推荐用于生产环境）
   - 点击「创建」

3. **填写应用信息**
   ```
   应用名称: BacklinksBuilder
   用户支持电子邮件: your-email@example.com
   应用徽标: (可选，上传您的 logo)
   应用首页链接: https://your-domain.com
   应用隐私政策链接: https://your-domain.com/privacy
   应用服务条款链接: https://your-domain.com/terms
   ```

4. **授权域名**
   - 在「授权域名」部分添加：
     ```
     your-domain.com
     localhost (仅用于开发)
     ```

5. **开发者联系信息**
   ```
   电子邮件地址: your-email@example.com
   ```

6. **保存并继续**

### 1.4 创建 OAuth 2.0 客户端 ID

1. **导航到凭据页面**
   - 在左侧菜单中，点击「API 和服务」→「凭据」

2. **创建凭据**
   - 点击页面顶部的「+ 创建凭据」
   - 选择「OAuth 2.0 客户端 ID」

3. **配置客户端**
   ```
   应用类型: Web 应用
   名称: BacklinksBuilder Web Client
   ```

4. **配置授权重定向 URI**
   - 在「授权的重定向 URI」部分，添加以下 URI：
   ```
   开发环境:
   http://localhost:4321/auth/callback
   
   生产环境:
   https://your-domain.com/auth/callback
   ```
   
   ⚠️ **重要提示**：
   - 确保 URI 完全匹配，包括协议（http/https）
   - 不要在 URI 末尾添加斜杠
   - 替换 `your-domain.com` 为您的实际域名

5. **创建客户端**
   - 点击「创建」按钮
   - 系统将显示客户端 ID 和客户端密钥

6. **保存凭据信息**
   ```
   客户端 ID: 1234567890-abcdefghijklmnop.apps.googleusercontent.com
   客户端密钥: GOCSPX-abcdefghijklmnopqrstuvwxyz
   ```
   
   ⚠️ **安全提示**：
   - 立即将这些信息保存到安全的地方
   - 不要将客户端密钥提交到版本控制系统
   - 如果泄露，请立即重新生成

---

## 🗄️ 步骤 2：在 Supabase Dashboard 启用 Google 提供商

### 2.1 登录 Supabase Dashboard

1. **访问 Supabase**
   - 打开浏览器，访问：https://supabase.com/dashboard
   - 使用您的账户登录

2. **选择项目**
   - 在项目列表中找到您的 BacklinksBuilder 项目
   - 点击项目名称进入项目控制台

### 2.2 配置 Google 认证提供商

1. **导航到认证设置**
   - 在左侧菜单中，点击「Authentication」
   - 点击「Providers」选项卡

2. **启用 Google 提供商**
   - 在提供商列表中找到「Google」
   - 点击 Google 提供商右侧的开关，启用它

3. **配置 Google 提供商**
   - 在弹出的配置窗口中填写：
   ```
   Google enabled: ✅ (已启用)
   Client ID: [粘贴步骤1中获取的客户端ID]
   Client Secret: [粘贴步骤1中获取的客户端密钥]
   ```

4. **保存配置**
   - 点击「Save」按钮
   - 确认配置已保存成功

### 2.3 配置站点 URL 和重定向 URL

1. **导航到认证设置**
   - 在「Authentication」页面中，点击「Settings」选项卡

2. **配置站点 URL**
   ```
   Site URL: https://your-domain.com
   ```
   
   📝 **开发环境注意**：
   - 开发时可以设置为：`http://localhost:4321`
   - 生产环境必须使用 HTTPS

3. **配置重定向 URL**
   - 在「Redirect URLs」部分添加：
   ```
   http://localhost:4321/**
   https://your-domain.com/**
   ```
   
   ⚠️ **重要说明**：
   - 使用通配符 `**` 允许所有子路径
   - 确保包含开发和生产环境的 URL

4. **保存设置**
   - 点击「Save」按钮
   - 等待配置更新完成

---

## 🔐 步骤 3：配置环境变量 (.env.local)

### 3.1 获取 Supabase 项目信息

1. **获取项目 URL 和 API 密钥**
   - 在 Supabase Dashboard 中，点击「Settings」→「API」
   - 复制以下信息：
   ```
   Project URL: https://your-project-id.supabase.co
   anon public key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   service_role secret key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### 3.2 创建环境变量文件

1. **创建 .env.local 文件**
   - 在项目根目录创建 `.env.local` 文件
   - 如果文件已存在，请编辑它

2. **添加环境变量**
   ```bash
   # Supabase 配置
   PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   
   # Google OAuth 配置（可选，用于自定义处理）
   GOOGLE_CLIENT_ID=1234567890-abcdefghijklmnop.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz
   ```

3. **验证环境变量**
   - 确保所有值都正确填写
   - 确保没有多余的空格或换行符
   - 确保 `.env.local` 文件在 `.gitignore` 中

### 3.3 更新 .gitignore 文件

确保 `.gitignore` 文件包含以下内容：
```gitignore
# 环境变量文件
.env
.env.local
.env.*.local

# Supabase
.supabase/
```

---

## 🧪 步骤 4：测试本地开发环境的 Google 登录流程

### 4.1 启动开发服务器

1. **安装依赖**（如果尚未安装）
   ```bash
   cd /Users/Wangdefou/GitHub/BacklinksBuilder
   pnpm install
   ```

2. **启动开发服务器**
   ```bash
   pnpm dev
   ```
   
   服务器应该在 `http://localhost:4321` 启动

### 4.2 测试 Google 登录功能

1. **访问登录页面**
   - 打开浏览器，访问：`http://localhost:4321/auth/login`
   - 确认页面正常加载

2. **测试 Google 登录按钮**
   - 点击「使用 Google 登录」按钮
   - 应该会重定向到 Google 授权页面

3. **完成 Google 授权**
   - 选择您的 Google 账户
   - 授权应用访问您的基本信息
   - 确认授权

4. **验证回调处理**
   - 授权完成后，应该重定向到：`http://localhost:4321/auth/callback`
   - 页面应该显示「正在处理登录...」
   - 几秒钟后应该重定向到仪表板或首页

### 4.3 验证用户数据

1. **检查 Supabase 数据库**
   - 在 Supabase Dashboard 中，点击「Table Editor」
   - 查看 `users` 表，确认新用户记录已创建
   - 验证用户信息是否正确填充：
     ```
     id: [UUID]
     email: [Google 邮箱]
     name: [Google 显示名称]
     avatar_url: [Google 头像 URL]
     provider: google
     plan: free
     ```

2. **检查用户配额**
   - 查看 `user_quotas` 表
   - 确认为新用户创建了配额记录

### 4.4 故障排除

如果遇到问题，请检查以下内容：

**常见错误 1：重定向 URI 不匹配**
```
错误信息: redirect_uri_mismatch
解决方案: 检查 Google Cloud Console 中的重定向 URI 配置
```

**常见错误 2：客户端 ID 无效**
```
错误信息: invalid_client
解决方案: 检查环境变量中的 Google 客户端 ID 是否正确
```

**常见错误 3：Supabase 配置错误**
```
错误信息: Invalid API key
解决方案: 检查 Supabase URL 和 API 密钥是否正确
```

**调试技巧**：
```javascript
// 在浏览器控制台中检查认证状态
import { getCurrentSession } from './src/lib/auth';
getCurrentSession().then(console.log);

// 检查 Supabase 会话
import { supabase } from './src/lib/supabase';
supabase.auth.getSession().then(console.log);
```

---

## 🚀 步骤 5：配置生产环境的重定向 URI

### 5.1 准备生产环境信息

在配置生产环境之前，确保您有以下信息：
```
生产域名: https://your-domain.com
Vercel 项目 URL: https://your-project.vercel.app
自定义域名: https://backlinksbuilder.com (如果有)
```

### 5.2 更新 Google Cloud Console 配置

1. **添加生产环境重定向 URI**
   - 返回 Google Cloud Console
   - 导航到「API 和服务」→「凭据」
   - 点击您创建的 OAuth 2.0 客户端 ID
   - 在「授权的重定向 URI」部分添加：
   ```
   https://your-domain.com/auth/callback
   https://your-project.vercel.app/auth/callback
   ```

2. **更新授权域名**
   - 导航到「OAuth 同意屏幕」
   - 在「授权域名」部分添加：
   ```
   your-domain.com
   vercel.app
   ```

3. **保存更改**
   - 点击「保存」按钮
   - 等待配置更新生效（可能需要几分钟）

### 5.3 更新 Supabase 生产环境配置

1. **更新站点 URL**
   - 在 Supabase Dashboard 中，导航到「Authentication」→「Settings」
   - 更新站点 URL：
   ```
   Site URL: https://your-domain.com
   ```

2. **更新重定向 URL**
   - 在「Redirect URLs」部分添加：
   ```
   https://your-domain.com/**
   https://your-project.vercel.app/**
   ```

3. **保存配置**
   - 点击「Save」按钮

### 5.4 配置 Vercel 环境变量

1. **登录 Vercel Dashboard**
   - 访问：https://vercel.com/dashboard
   - 选择您的 BacklinksBuilder 项目

2. **添加环境变量**
   - 点击「Settings」选项卡
   - 点击「Environment Variables」
   - 添加以下变量：
   ```
   PUBLIC_SUPABASE_URL = https://your-project-id.supabase.co
   PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   GOOGLE_CLIENT_ID = 1234567890-abcdefghijklmnop.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET = GOCSPX-abcdefghijklmnopqrstuvwxyz
   ```

3. **设置环境**
   - 为每个变量选择适当的环境：
     - Production ✅
     - Preview ✅
     - Development ✅

### 5.5 部署和测试生产环境

1. **部署到生产环境**
   ```bash
   # 构建项目
   pnpm build
   
   # 部署到 Vercel
   vercel --prod
   ```

2. **测试生产环境 Google OAuth**
   - 访问生产环境登录页面：`https://your-domain.com/auth/login`
   - 点击「使用 Google 登录」按钮
   - 完成 Google 授权流程
   - 验证重定向和用户创建是否正常工作

3. **验证 HTTPS 和安全性**
   - 确保所有页面都使用 HTTPS
   - 检查浏览器控制台是否有安全警告
   - 验证 Cookie 和会话管理是否正常

---

## ✅ 配置完成检查清单

请确认以下所有项目都已完成：

### Google Cloud Console
- [ ] 创建了 Google Cloud 项目
- [ ] 启用了 Google+ API
- [ ] 配置了 OAuth 同意屏幕
- [ ] 创建了 OAuth 2.0 客户端 ID
- [ ] 添加了正确的重定向 URI（开发和生产）
- [ ] 保存了客户端 ID 和客户端密钥

### Supabase Dashboard
- [ ] 启用了 Google 认证提供商
- [ ] 配置了 Google 客户端 ID 和密钥
- [ ] 设置了正确的站点 URL
- [ ] 配置了重定向 URL
- [ ] 验证了数据库表结构

### 环境配置
- [ ] 创建了 `.env.local` 文件
- [ ] 配置了所有必需的环境变量
- [ ] 确保 `.env.local` 在 `.gitignore` 中
- [ ] 在 Vercel 中配置了生产环境变量

### 功能测试
- [ ] 本地开发环境 Google 登录正常工作
- [ ] 用户数据正确保存到 Supabase
- [ ] 用户配额正确创建
- [ ] 生产环境 Google 登录正常工作
- [ ] 所有重定向 URI 正常工作

---

## 🎉 恭喜！配置完成

您已经成功为 BacklinksBuilder 项目配置了 Google OAuth 登录功能！

### 🚀 下一步建议

1. **添加更多 OAuth 提供商**
   - GitHub OAuth
   - Facebook OAuth
   - Twitter OAuth

2. **增强用户体验**
   - 添加用户资料管理页面
   - 实现账户绑定功能
   - 添加登录历史记录

3. **安全性增强**
   - 实现双因素认证
   - 添加登录异常检测
   - 定期轮换 API 密钥

4. **监控和分析**
   - 添加认证成功率监控
   - 实现用户行为分析
   - 设置错误报警

### 📞 获取帮助

如果在配置过程中遇到问题，可以：

1. **查看日志**
   - 浏览器开发者工具控制台
   - Vercel 部署日志
   - Supabase 日志

2. **参考文档**
   - [Google OAuth 2.0 文档](https://developers.google.com/identity/protocols/oauth2)
   - [Supabase 认证文档](https://supabase.com/docs/guides/auth)
   - [Astro 文档](https://docs.astro.build/)

3. **社区支持**
   - Supabase Discord 社区
   - Astro Discord 社区
   - Stack Overflow

现在您的用户可以使用 Google 账户快速登录 BacklinksBuilder，享受更便捷的用户体验！🎊