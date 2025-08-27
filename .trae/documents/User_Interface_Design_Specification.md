# 用户界面设计规范

## 1. 设计概述

本文档定义了BacklinksBuilder用户角色权限系统的界面设计规范，确保不同用户面板具有一致的视觉体验和良好的用户体验。

## 2. 设计原则

### 2.1 核心原则
- **一致性**：所有面板保持统一的设计语言
- **层次性**：通过视觉层次区分不同用户等级
- **可用性**：简洁直观的操作流程
- **响应性**：适配各种设备和屏幕尺寸
- **可访问性**：符合WCAG 2.1 AA标准

### 2.2 用户体验原则
- **渐进式披露**：根据用户权限逐步展示功能
- **即时反馈**：操作结果的及时响应
- **错误预防**：通过设计减少用户错误
- **帮助与文档**：提供上下文相关的帮助信息

## 3. 视觉设计系统

### 3.1 色彩系统

#### 主色调
```css
/* 品牌主色 */
--primary-blue: #2563eb;
--primary-blue-light: #3b82f6;
--primary-blue-dark: #1d4ed8;

/* 辅助色 */
--secondary-gray: #6b7280;
--secondary-gray-light: #9ca3af;
--secondary-gray-dark: #374151;
```

#### 角色专属色彩
```css
/* 免费用户 - 蓝色系 */
--free-primary: #2563eb;
--free-secondary: #dbeafe;
--free-accent: #1e40af;

/* 付费用户 - 金色系 */
--premium-primary: #f59e0b;
--premium-secondary: #fef3c7;
--premium-accent: #d97706;
--premium-gradient: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);

/* 管理员 - 紫色系 */
--admin-primary: #7c3aed;
--admin-secondary: #ede9fe;
--admin-accent: #5b21b6;
--admin-gradient: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
```

#### 状态色彩
```css
/* 成功状态 */
--success-green: #10b981;
--success-green-light: #d1fae5;

/* 警告状态 */
--warning-yellow: #f59e0b;
--warning-yellow-light: #fef3c7;

/* 错误状态 */
--error-red: #ef4444;
--error-red-light: #fee2e2;

/* 信息状态 */
--info-blue: #3b82f6;
--info-blue-light: #dbeafe;
```

### 3.2 字体系统

#### 字体族
```css
/* 主字体 */
--font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

/* 代码字体 */
--font-mono: 'JetBrains Mono', 'Fira Code', Consolas, monospace;

/* 装饰字体 */
--font-display: 'Inter', sans-serif;
```

#### 字体大小
```css
/* 标题字体 */
--text-xs: 0.75rem;     /* 12px */
--text-sm: 0.875rem;    /* 14px */
--text-base: 1rem;      /* 16px */
--text-lg: 1.125rem;    /* 18px */
--text-xl: 1.25rem;     /* 20px */
--text-2xl: 1.5rem;     /* 24px */
--text-3xl: 1.875rem;   /* 30px */
--text-4xl: 2.25rem;    /* 36px */
```

#### 字重
```css
--font-light: 300;
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### 3.3 间距系统

```css
/* 间距单位 */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
```

### 3.4 圆角系统

```css
--radius-sm: 0.25rem;   /* 4px */
--radius-md: 0.375rem;  /* 6px */
--radius-lg: 0.5rem;    /* 8px */
--radius-xl: 0.75rem;   /* 12px */
--radius-2xl: 1rem;     /* 16px */
--radius-full: 9999px;  /* 完全圆角 */
```

### 3.5 阴影系统

```css
/* 阴影层级 */
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
```

## 4. 组件设计规范

### 4.1 按钮组件

#### 主要按钮
```css
.btn-primary {
  background: var(--primary-blue);
  color: white;
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  font-weight: var(--font-medium);
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background: var(--primary-blue-dark);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}
```

#### 次要按钮
```css
.btn-secondary {
  background: white;
  color: var(--secondary-gray-dark);
  border: 1px solid var(--secondary-gray);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-lg);
  font-weight: var(--font-medium);
}
```

#### 角色专属按钮
```css
/* 付费用户按钮 */
.btn-premium {
  background: var(--premium-gradient);
  color: white;
  position: relative;
  overflow: hidden;
}

.btn-premium::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  transition: left 0.5s;
}

.btn-premium:hover::before {
  left: 100%;
}
```

### 4.2 卡片组件

#### 基础卡片
```css
.card {
  background: white;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
  border: 1px solid #f3f4f6;
  transition: all 0.2s ease;
}

.card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
```

#### 功能卡片
```css
.feature-card {
  padding: var(--space-6);
  text-align: center;
  position: relative;
}

.feature-card-icon {
  width: 3rem;
  height: 3rem;
  margin: 0 auto var(--space-4);
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
}

.feature-card-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  margin-bottom: var(--space-2);
}

.feature-card-description {
  color: var(--secondary-gray);
  font-size: var(--text-sm);
  margin-bottom: var(--space-4);
}
```

### 4.3 导航组件

#### 顶部导航
```css
.navbar {
  background: white;
  border-bottom: 1px solid #f3f4f6;
  padding: var(--space-4) 0;
  position: sticky;
  top: 0;
  z-index: 50;
  backdrop-filter: blur(8px);
}

.navbar-brand {
  font-size: var(--text-xl);
  font-weight: var(--font-bold);
  color: var(--primary-blue);
}

.navbar-user {
  display: flex;
  align-items: center;
  gap: var(--space-4);
}
```

#### 侧边导航
```css
.sidebar {
  width: 16rem;
  background: white;
  border-right: 1px solid #f3f4f6;
  padding: var(--space-6);
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
}

.sidebar-item {
  display: flex;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  color: var(--secondary-gray-dark);
  text-decoration: none;
  transition: all 0.2s ease;
}

.sidebar-item:hover {
  background: var(--primary-blue);
  color: white;
}
```

### 4.4 状态组件

#### 权限徽章
```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
}

.badge-free {
  background: var(--free-secondary);
  color: var(--free-accent);
}

.badge-premium {
  background: var(--premium-gradient);
  color: white;
}

.badge-admin {
  background: var(--admin-gradient);
  color: white;
}
```

#### 配额进度条
```css
.quota-progress {
  width: 100%;
  height: 0.5rem;
  background: #f3f4f6;
  border-radius: var(--radius-full);
  overflow: hidden;
}

.quota-progress-bar {
  height: 100%;
  background: var(--primary-blue);
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

.quota-progress-bar.warning {
  background: var(--warning-yellow);
}

.quota-progress-bar.danger {
  background: var(--error-red);
}
```

## 5. 页面布局规范

### 5.1 通用布局结构

```html
<div class="app-layout">
  <!-- 顶部导航 -->
  <nav class="navbar">
    <div class="navbar-container">
      <div class="navbar-brand">BacklinksBuilder</div>
      <div class="navbar-user">
        <span class="user-email">user@example.com</span>
        <div class="user-badge">Premium</div>
        <button class="logout-btn">退出</button>
      </div>
    </div>
  </nav>
  
  <!-- 主要内容区域 -->
  <main class="main-content">
    <div class="container">
      <!-- 页面内容 -->
    </div>
  </main>
</div>
```

### 5.2 响应式断点

```css
/* 移动设备 */
@media (max-width: 640px) {
  .container {
    padding: var(--space-4);
  }
  
  .grid-cols-3 {
    grid-template-columns: 1fr;
  }
}

/* 平板设备 */
@media (min-width: 641px) and (max-width: 1024px) {
  .container {
    padding: var(--space-6);
  }
  
  .grid-cols-3 {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* 桌面设备 */
@media (min-width: 1025px) {
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: var(--space-8);
  }
}
```

## 6. 用户面板设计规范

### 6.1 普通用户面板

#### 设计特点
- **色彩**：以蓝色为主色调，传达专业和信任感
- **布局**：简洁的网格布局，突出核心功能
- **引导**：明显的升级提示和功能限制说明
- **反馈**：清晰的配额使用情况显示

#### 关键元素
```css
.free-dashboard {
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
}

.upgrade-banner {
  background: var(--primary-blue);
  color: white;
  padding: var(--space-6);
  border-radius: var(--radius-xl);
  margin-bottom: var(--space-8);
}

.feature-locked {
  position: relative;
  opacity: 0.6;
}

.feature-locked::after {
  content: '🔒';
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  font-size: var(--text-lg);
}
```

### 6.2 付费用户面板

#### 设计特点
- **色彩**：金色渐变突出付费身份
- **动效**：微妙的动画效果提升体验
- **功能**：完整的功能访问权限
- **统计**：详细的使用数据展示

#### 关键元素
```css
.premium-dashboard {
  background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
}

.premium-header {
  background: var(--premium-gradient);
  color: white;
  padding: var(--space-8);
  border-radius: var(--radius-2xl);
  position: relative;
  overflow: hidden;
}

.premium-header::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -50%;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
  animation: shimmer 3s ease-in-out infinite;
}

@keyframes shimmer {
  0%, 100% { transform: scale(0.8) rotate(0deg); }
  50% { transform: scale(1.2) rotate(180deg); }
}

.unlimited-badge {
  background: rgba(255,255,255,0.2);
  color: white;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
}
```

### 6.3 管理员面板

#### 设计特点
- **色彩**：紫色系体现管理权威
- **信息密度**：高信息密度的数据展示
- **控制**：丰富的管理控制选项
- **监控**：实时系统状态监控

#### 关键元素
```css
.admin-dashboard {
  background: linear-gradient(135deg, #faf5ff 0%, #e9d5ff 100%);
}

.admin-header {
  background: var(--admin-gradient);
  color: white;
  padding: var(--space-6);
  border-radius: var(--radius-xl);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--space-6);
  margin: var(--space-8) 0;
}

.stat-card {
  background: white;
  padding: var(--space-6);
  border-radius: var(--radius-xl);
  border-left: 4px solid var(--admin-primary);
}
```

## 7. 交互设计规范

### 7.1 微交互

#### 悬停效果
```css
.interactive-element {
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.interactive-element:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}
```

#### 点击反馈
```css
.clickable {
  position: relative;
  overflow: hidden;
}

.clickable::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(255,255,255,0.3);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.3s, height 0.3s;
}

.clickable:active::after {
  width: 200px;
  height: 200px;
}
```

### 7.2 加载状态

#### 骨架屏
```css
.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

#### 加载指示器
```css
.spinner {
  width: 2rem;
  height: 2rem;
  border: 2px solid #f3f4f6;
  border-top: 2px solid var(--primary-blue);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
```

### 7.3 错误状态

#### 错误提示
```css
.error-message {
  background: var(--error-red-light);
  color: var(--error-red);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  border-left: 4px solid var(--error-red);
  margin: var(--space-4) 0;
}

.error-icon {
  width: 1.25rem;
  height: 1.25rem;
  margin-right: var(--space-2);
}
```

## 8. 可访问性规范

### 8.1 颜色对比度
- 正文文字与背景对比度 ≥ 4.5:1
- 大文字与背景对比度 ≥ 3:1
- 非文字元素对比度 ≥ 3:1

### 8.2 键盘导航
```css
.focusable:focus {
  outline: 2px solid var(--primary-blue);
  outline-offset: 2px;
}

.skip-link {
  position: absolute;
  top: -40px;
  left: 6px;
  background: var(--primary-blue);
  color: white;
  padding: 8px;
  text-decoration: none;
  border-radius: 4px;
}

.skip-link:focus {
  top: 6px;
}
```

### 8.3 屏幕阅读器支持
```html
<!-- 语义化标签 -->
<main role="main" aria-label="主要内容">
<nav role="navigation" aria-label="主导航">
<section aria-labelledby="section-title">

<!-- ARIA标签 -->
<button aria-expanded="false" aria-controls="menu">
<div role="status" aria-live="polite">
<img alt="用户头像" aria-describedby="user-info">
```

## 9. 性能优化

### 9.1 CSS优化
```css
/* 使用CSS变量减少重复 */
:root {
  --transition-fast: 0.15s ease;
  --transition-normal: 0.2s ease;
  --transition-slow: 0.3s ease;
}

/* 优化动画性能 */
.animated {
  will-change: transform;
  transform: translateZ(0);
}

/* 减少重绘 */
.gpu-accelerated {
  transform: translate3d(0, 0, 0);
}
```

### 9.2 图片优化
```html
<!-- 响应式图片 -->
<img 
  src="image-800w.jpg" 
  srcset="image-400w.jpg 400w, image-800w.jpg 800w, image-1200w.jpg 1200w"
  sizes="(max-width: 640px) 400px, (max-width: 1024px) 800px, 1200px"
  alt="描述文字"
  loading="lazy"
>

<!-- WebP格式支持 -->
<picture>
  <source srcset="image.webp" type="image/webp">
  <source srcset="image.jpg" type="image/jpeg">
  <img src="image.jpg" alt="描述文字">
</picture>
```

这个设计规范文档提供了完整的UI/UX设计指导，确保用户角色权限系统具有一致、美观、易用的界面体验。