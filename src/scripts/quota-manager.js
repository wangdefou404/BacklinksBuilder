/**
 * Quota Manager - Universal quota checking and management module
 */
class QuotaManager {
  constructor() {
    this.baseUrl = window.location.origin;
  }

  /**
     * Check user quota
     * @param {string} quotaType - Quota type (dr_check, traffic_check, backlink_check, backlink_view)
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Quota information
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
     * Consume quota
     * @param {string} quotaType - Quota type
     * @param {string} userId - User ID
     * @param {number} amount - Consumption amount, default is 1
     * @returns {Promise<Object>} Consumption result
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
     * Display quota information to specified element
     * @param {string} elementId - Target element ID
     * @param {Object} quotaInfo - Quota information
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
    let statusText = 'Available';
    
    if (!canUse) {
      statusClass = 'text-red-600';
      statusText = 'Quota Exhausted';
    } else if (remainingMonthly <= 5 || (remainingDaily !== null && remainingDaily <= 2)) {
      statusClass = 'text-yellow-600';
      statusText = 'Quota Nearly Exhausted';
    }

    // Handle guest user display
    const isGuest = quotaInfo.isGuest || false;
    const planDisplayName = isGuest ? 'Guest' : (planNames[planType] || planType);
    const planColorClass = isGuest ? 'bg-blue-100 text-blue-800' : 
      (canUse ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800');

    element.innerHTML = `
      <div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-medium text-gray-900">Quota Usage</h3>
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${planColorClass}">
            ${planDisplayName}
          </span>
        </div>
        
        <div class="space-y-2">
          <div class="flex justify-between items-center">
            <span class="text-sm text-gray-600">Monthly Quota:</span>
            <span class="text-sm font-medium ${statusClass}">
              ${monthlyUsed}/${monthlyLimit} (Remaining ${remainingMonthly})
            </span>
          </div>
          
          ${dailyLimit > 0 ? `
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-600">Daily Quota:</span>
              <span class="text-sm font-medium ${statusClass}">
                ${dailyUsed}/${dailyLimit} (Remaining ${remainingDaily})
              </span>
            </div>
          ` : ''}
          
          <div class="flex justify-between items-center pt-2 border-t border-gray-100">
            <span class="text-sm text-gray-600">Status:</span>
            <span class="text-sm font-medium ${statusClass}">${statusText}</span>
          </div>
        </div>
        
        ${!canUse ? `
          <div class="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
            <p class="text-sm text-red-700 mb-2">${isGuest ? 'Guest quota exhausted. Please login or register for more quota.' : 'Quota exhausted. Please upgrade your plan to continue.'}</p>
            ${isGuest ? `
              <div class="flex space-x-2">
                <a href="/auth/login" class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  Login
                </a>
                <a href="/auth/register" class="inline-flex items-center px-3 py-1.5 border border-blue-600 text-xs font-medium rounded text-blue-600 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  Register
                </a>
              </div>
            ` : `
              <a href="/pricing" class="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                Upgrade Plan
              </a>
            `}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
     * Display quota insufficient warning
     * @param {string} elementId - Target element ID
     * @param {string} quotaType - Quota type
     */
  showQuotaExceededMessage(elementId, quotaType) {
    const element = document.getElementById(elementId);
    if (!element) {
      console.warn(`Element with ID '${elementId}' not found`);
      return;
    }

    const quotaTypeNames = {
      'dr_check': 'DR Check',
      'traffic_check': 'Traffic Check',
      'backlink_check': 'Backlink Check',
      'backlink_view': 'Backlink View'
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
              ${quotaTypeNames[quotaType] || quotaType} Quota Exhausted
            </h3>
            <div class="mt-2 text-sm text-red-700">
              <p>Your ${quotaTypeNames[quotaType] || quotaType} quota has been exhausted. Please upgrade your plan to continue.</p>
            </div>
            <div class="mt-3">
              <a href="/pricing" class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                View Upgrade Plans
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
     * Display loading state
     * @param {string} elementId - Target element ID
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
     * Get current user ID (from localStorage or sessionStorage)
     * @returns {Promise<string|null>} User ID
     */
  async getCurrentUserId() {
    try {
      // Try to get user information from multiple storage locations
      const sources = [
        () => localStorage.getItem('supabase.auth.token'),
        () => sessionStorage.getItem('supabase.auth.token'),
        () => localStorage.getItem('sb-' + window.location.hostname.replace(/\./g, '-') + '-auth-token'),
        () => {
          // Try to get from global Supabase client
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
            // If it's a string, try to parse JSON
            if (typeof result === 'string') {
              try {
                const parsed = JSON.parse(result);
                if (parsed?.user?.id) {
                  return parsed.user.id;
                }
                if (parsed?.access_token) {
                  // Parse user ID from JWT token
                  const payload = JSON.parse(atob(parsed.access_token.split('.')[1]));
                  if (payload?.sub) {
                    return payload.sub;
                  }
                }
              } catch (e) {
                // Ignore JSON parsing errors, continue to next source
              }
            } else if (typeof result === 'string' && result.length > 0) {
              return result;
            }
          }
        } catch (error) {
          // Ignore individual source errors, continue to next
          console.debug('Failed to get user ID:', error.message);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get user ID:', error);
      return null;
    }
  }

  /**
   * Get default quota information for guest users
   * @param {string} quotaType - Quota type
   * @returns {Object} Default quota information
   */
  getGuestQuotaInfo(quotaType) {
    // Provide basic quota for guest users
    const guestQuotas = {
      'dr_check': { monthlyLimit: 5, dailyLimit: 2 },
      'traffic_check': { monthlyLimit: 5, dailyLimit: 2 },
      'backlink_check': { monthlyLimit: 3, dailyLimit: 1 },
      'backlink_view': { monthlyLimit: 10, dailyLimit: 5 }
    };

    const quota = guestQuotas[quotaType] || { monthlyLimit: 3, dailyLimit: 1 };
    
    // Get guest usage records from localStorage
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
   * Update quota usage records for guest users
   * @param {string} quotaType - Quota type
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
   * Initialize page quota display
   * @param {string} quotaType - Quota type
   * @param {string} displayElementId - Display element ID
   */
  async initPageQuota(quotaType, displayElementId) {
    this.showLoading(displayElementId);

    try {
      const userId = await this.getCurrentUserId();
      let quotaInfo;
      
      if (!userId) {
        // Use guest quota for non-logged-in users
        quotaInfo = this.getGuestQuotaInfo(quotaType);
      } else {
        // Use API to check quota for logged-in users
        quotaInfo = await this.checkQuota(quotaType, userId);
      }
      
      this.displayQuotaInfo(displayElementId, quotaInfo);
      return quotaInfo;
    } catch (error) {
      console.error('Failed to load quota information, please refresh and try again:', error);
      const element = document.getElementById(displayElementId);
      if (element) {
        element.innerHTML = `
          <div class="bg-red-50 border border-red-200 rounded-lg p-4">
            <p class="text-sm text-red-700">Failed to load quota information, please refresh and try again.</p>
          </div>
        `;
      }
    }
  }

  /**
   * Execute operation with quota check
   * @param {string} quotaType - Quota type
   * @param {Function} operation - Operation function to execute
   * @param {string} displayElementId - Display element ID (optional)
   * @returns {Promise<any>} Operation result
   */
  async executeWithQuotaCheck(quotaType, operation, displayElementId = null) {
    try {
      const userId = await this.getCurrentUserId();
      let quotaInfo;
      
      if (!userId) {
        // Use guest quota for non-logged-in users
        quotaInfo = this.getGuestQuotaInfo(quotaType);
      } else {
        // Use API to check quota for logged-in users
        quotaInfo = await this.checkQuota(quotaType, userId);
      }
      
      if (!quotaInfo.canUse) {
        if (displayElementId) {
          this.showQuotaExceededMessage(displayElementId, quotaType);
        }
        throw new Error('Quota exceeded');
      }

      // Execute operation
      const result = await operation();

      // Consume quota
      if (!userId) {
        // Update local storage for guest users
        this.updateGuestQuotaUsage(quotaType);
      } else {
        // Call API for logged-in users
        await this.consumeQuota(quotaType, userId);
      }

      // Update display
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

// Create global instance
window.quotaManager = new QuotaManager();

// Export class (if using module system)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QuotaManager;
}