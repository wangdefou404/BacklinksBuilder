/**
 * 配额管理器 - 通用的配额检查和管理模块
 */
class QuotaManager {
  constructor() {
    this.baseUrl = window.location.origin;
  }

  /**
   * 检查用户配额
   * @param {string} quotaType - 配额类型 (dr_check, traffic_check, backlink_check, backlink_view)
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 配额信息
   */
  async checkQuota(quotaType, userId) {
    try {
      const response = await fetch(`${this.baseUrl}/api/quota/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ quotaType, userId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to check quota');
      }

      return await response.json();
    } catch (error) {
      console.error('Error checking quota:', error);
      throw error;
    }
  }

  /**
   * 消费配额
   * @param {string} quotaType - 配额类型
   * @param {string} userId - 用户ID
   * @param {number} amount - 消费数量，默认为1
   * @returns {Promise<Object>} 消费结果
   */
  async consumeQuota(quotaType, userId, amount = 1) {
    try {
      const response = await fetch(`${this.baseUrl}/api/quota/consume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ quotaType, userId, amount })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to consume quota');
      }

      return result;
    } catch (error) {
      console.error('Error consuming quota:', error);
      throw error;
    }
  }

  /**
   * 显示配额信息到指定元素
   * @param {string} elementId - 目标元素ID
   * @param {Object} quotaInfo - 配额信息
   */
  displayQuotaInfo(elementId, quotaInfo) {
    const element = document.getElementById(elementId);
    if (!element) {
      console.warn(`Element with ID '${elementId}' not found`);
      return;
    }

    const { monthlyUsed, monthlyLimit, dailyUsed, dailyLimit, planType, canUse } = quotaInfo;
    const remainingMonthly = monthlyLimit - monthlyUsed;
    const remainingDaily = dailyLimit > 0 ? dailyLimit - dailyUsed : null;

    const planNames = {
      'free': 'Free',
      'pro': 'Pro',
      'super': 'Super'
    };

    let statusClass = 'text-green-600';
    let statusText = '可用';
    
    if (!canUse) {
      statusClass = 'text-red-600';
      statusText = '配额已用完';
    } else if (remainingMonthly <= 5 || (remainingDaily !== null && remainingDaily <= 2)) {
      statusClass = 'text-yellow-600';
      statusText = '配额即将用完';
    }

    // 处理访客用户的显示
    const isGuest = quotaInfo.isGuest || false;
    const planDisplayName = isGuest ? '访客' : (planNames[planType] || planType);
    const planColorClass = isGuest ? 'bg-blue-100 text-blue-800' : 
      (canUse ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800');

    element.innerHTML = `
      <div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-medium text-gray-900">配额使用情况</h3>
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${planColorClass}">
            ${planDisplayName}
          </span>
        </div>
        
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600">月度配额:</span>
            <span class="text-sm font-medium ${statusClass}">
              ${monthlyUsed}/${monthlyLimit} (剩余 ${remainingMonthly})
            </span>
          </div>
          
          ${dailyLimit > 0 ? `
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-600">日度配额:</span>
              <span class="text-sm font-medium ${statusClass}">
                ${dailyUsed}/${dailyLimit} (剩余 ${remainingDaily})
              </span>
            </div>
          ` : ''}
          
          <div class="flex justify-between items-center pt-2 border-t border-gray-100">
            <span class="text-sm text-gray-600">状态:</span>
            <span class="text-sm font-medium ${statusClass}">${statusText}</span>
          </div>
        </div>
        
        ${!canUse ? `
          <div class="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
            <p class="text-sm text-red-700 mb-2">${isGuest ? '访客配额已用完，请登录或注册以获得更多配额。' : '配额已用完，请升级您的计划以继续使用。'}</p>
            ${isGuest ? `
              <div class="flex space-x-2">
                <a href="/auth/login" class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  登录
                </a>
                <a href="/auth/register" class="inline-flex items-center px-3 py-1.5 border border-blue-600 text-xs font-medium rounded text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  注册
                </a>
              </div>
            ` : `
              <a href="/pricing" class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                升级计划
              </a>
            `}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * 显示配额不足提示
   * @param {string} elementId - 目标元素ID
   * @param {string} quotaType - 配额类型
   */
  showQuotaExceededMessage(elementId, quotaType) {
    const element = document.getElementById(elementId);
    if (!element) {
      console.warn(`Element with ID '${elementId}' not found`);
      return;
    }

    const quotaTypeNames = {
      'dr_check': 'DR检查',
      'traffic_check': '流量检查',
      'backlink_check': '外链检查',
      'backlink_view': '外链查看'
    };

    element.innerHTML = `
      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">
              ${quotaTypeNames[quotaType] || quotaType}配额已用完
            </h3>
            <div class="mt-2 text-sm text-red-700">
              <p>您的${quotaTypeNames[quotaType] || quotaType}配额已用完，请升级您的计划以继续使用。</p>
            </div>
            <div class="mt-3">
              <a href="/pricing" class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                查看升级计划
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 显示加载状态
   * @param {string} elementId - 目标元素ID
   */
  showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.innerHTML = `
      <div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div class="animate-pulse">
          <div class="flex items-center justify-between mb-3">
            <div class="h-4 bg-gray-200 rounded w-24"></div>
            <div class="h-5 bg-gray-200 rounded w-12"></div>
          </div>
          <div class="space-y-2">
            <div class="h-3 bg-gray-200 rounded"></div>
            <div class="h-3 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 获取当前用户ID（从localStorage或sessionStorage中获取）
   * @returns {Promise<string|null>} 用户ID
   */
  async getCurrentUserId() {
    try {
      // 尝试从多个存储位置获取用户信息
      const sources = [
        () => localStorage.getItem('supabase.auth.token'),
        () => sessionStorage.getItem('supabase.auth.token'),
        () => localStorage.getItem('sb-' + window.location.hostname.replace(/\./g, '-') + '-auth-token'),
        () => {
          // 尝试从全局Supabase客户端获取
          if (window.supabase && typeof window.supabase.auth?.getSession === 'function') {
            return window.supabase.auth.getSession().then(({ data }) => data?.session?.user?.id);
          }
          return null;
        }
      ];

      for (const getSource of sources) {
        try {
          const result = await getSource();
          if (result) {
            // 如果是字符串，尝试解析JSON
            if (typeof result === 'string') {
              try {
                const parsed = JSON.parse(result);
                if (parsed?.user?.id) {
                  return parsed.user.id;
                }
                if (parsed?.access_token) {
                  // 从JWT token中解析用户ID
                  const payload = JSON.parse(atob(parsed.access_token.split('.')[1]));
                  if (payload?.sub) {
                    return payload.sub;
                  }
                }
              } catch (e) {
                // 忽略JSON解析错误，继续尝试下一个源
              }
            } else if (typeof result === 'string' && result.length > 0) {
              return result;
            }
          }
        } catch (error) {
          // 忽略单个源的错误，继续尝试下一个
          console.debug('尝试获取用户ID失败:', error.message);
        }
      }
      
      return null;
    } catch (error) {
      console.warn('获取用户ID失败:', error.message);
      return null;
    }
  }

  /**
   * 获取访客用户的默认配额信息
   * @param {string} quotaType - 配额类型
   * @returns {Object} 默认配额信息
   */
  getGuestQuotaInfo(quotaType) {
    // 为访客用户提供基础配额
    const guestQuotas = {
      'dr_check': { monthlyLimit: 5, dailyLimit: 2 },
      'traffic_check': { monthlyLimit: 5, dailyLimit: 2 },
      'backlink_check': { monthlyLimit: 3, dailyLimit: 1 },
      'backlink_view': { monthlyLimit: 10, dailyLimit: 5 }
    };

    const quota = guestQuotas[quotaType] || { monthlyLimit: 3, dailyLimit: 1 };
    
    // 从localStorage获取访客使用记录
    const guestUsage = JSON.parse(localStorage.getItem('guestQuotaUsage') || '{}');
    const today = new Date().toDateString();
    const currentMonth = new Date().getFullYear() + '-' + (new Date().getMonth() + 1);
    
    const dailyUsed = guestUsage[quotaType]?.[today] || 0;
    const monthlyUsed = guestUsage[quotaType]?.[currentMonth] || 0;
    
    return {
      canUse: dailyUsed < quota.dailyLimit && monthlyUsed < quota.monthlyLimit,
      monthlyUsed,
      monthlyLimit: quota.monthlyLimit,
      dailyUsed,
      dailyLimit: quota.dailyLimit,
      planType: 'guest',
      isGuest: true
    };
  }

  /**
   * 更新访客用户的配额使用记录
   * @param {string} quotaType - 配额类型
   */
  updateGuestQuotaUsage(quotaType) {
    const guestUsage = JSON.parse(localStorage.getItem('guestQuotaUsage') || '{}');
    const today = new Date().toDateString();
    const currentMonth = new Date().getFullYear() + '-' + (new Date().getMonth() + 1);
    
    if (!guestUsage[quotaType]) {
      guestUsage[quotaType] = {};
    }
    
    guestUsage[quotaType][today] = (guestUsage[quotaType][today] || 0) + 1;
    guestUsage[quotaType][currentMonth] = (guestUsage[quotaType][currentMonth] || 0) + 1;
    
    localStorage.setItem('guestQuotaUsage', JSON.stringify(guestUsage));
  }

  /**
   * 初始化页面配额显示
   * @param {string} quotaType - 配额类型
   * @param {string} displayElementId - 显示元素ID
   */
  async initPageQuota(quotaType, displayElementId) {
    this.showLoading(displayElementId);

    try {
      const userId = await this.getCurrentUserId();
      let quotaInfo;
      
      if (!userId) {
        // 未登录用户使用访客配额
        quotaInfo = this.getGuestQuotaInfo(quotaType);
      } else {
        // 已登录用户使用API检查配额
        quotaInfo = await this.checkQuota(quotaType, userId);
      }
      
      this.displayQuotaInfo(displayElementId, quotaInfo);
      return quotaInfo;
    } catch (error) {
      console.error('Failed to load quota info:', error);
      const element = document.getElementById(displayElementId);
      if (element) {
        element.innerHTML = `
          <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <p class="text-sm text-red-700">加载配额信息失败，请刷新页面重试。</p>
          </div>
        `;
      }
    }
  }

  /**
   * 执行带配额检查的操作
   * @param {string} quotaType - 配额类型
   * @param {Function} operation - 要执行的操作函数
   * @param {string} displayElementId - 显示元素ID（可选）
   * @returns {Promise<any>} 操作结果
   */
  async executeWithQuotaCheck(quotaType, operation, displayElementId = null) {
    try {
      const userId = await this.getCurrentUserId();
      let quotaInfo;
      
      if (!userId) {
        // 未登录用户使用访客配额
        quotaInfo = this.getGuestQuotaInfo(quotaType);
      } else {
        // 已登录用户使用API检查配额
        quotaInfo = await this.checkQuota(quotaType, userId);
      }
      
      if (!quotaInfo.canUse) {
        if (displayElementId) {
          this.showQuotaExceededMessage(displayElementId, quotaType);
        }
        throw new Error('Quota exceeded');
      }

      // 执行操作
      const result = await operation();

      // 消费配额
      if (!userId) {
        // 访客用户更新本地存储
        this.updateGuestQuotaUsage(quotaType);
      } else {
        // 已登录用户调用API
        await this.consumeQuota(quotaType, userId);
      }

      // 更新显示
      if (displayElementId) {
        let updatedQuotaInfo;
        if (!userId) {
          updatedQuotaInfo = this.getGuestQuotaInfo(quotaType);
        } else {
          updatedQuotaInfo = await this.checkQuota(quotaType, userId);
        }
        this.displayQuotaInfo(displayElementId, updatedQuotaInfo);
      }

      return result;
    } catch (error) {
      if (error.message === 'Quota exceeded' && displayElementId) {
        this.showQuotaExceededMessage(displayElementId, quotaType);
      }
      throw error;
    }
  }
}

// 创建全局实例
window.quotaManager = new QuotaManager();

// 导出类（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QuotaManager;
}