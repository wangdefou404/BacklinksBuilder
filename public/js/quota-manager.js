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
   * Display admin quota information (unlimited)
   * @param {string} elementId - Element ID to display information
   * @param {string} quotaType - Quota type
   */
  displayAdminQuotaInfo(elementId, quotaType) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const quotaTypeNames = {
      'dr_check': 'DR Check',
      'traffic_check': 'Traffic Check',
      'backlink_check': 'Backlink Check',
      'backlink_view': 'Backlink View'
    };

    const typeName = quotaTypeNames[quotaType] || quotaType;

    element.innerHTML = `
      <div class="bg-green-50 border border-green-200 rounded-lg p-4">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path>
          </svg>
          <h3 class="text-sm font-medium text-green-800">Admin Privileges</h3>
        </div>
        <div class="mt-2 text-sm text-green-700">
          <p>You have admin privileges, ${typeName} feature has unlimited usage.</p>
          <div class="mt-2 flex items-center text-xs">
            <span class="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-800">
              <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              Unlimited
            </span>
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
      console.log('🔍 [getCurrentUserId] Starting user ID detection...');
      
      // Try to get user information from multiple storage locations
      const sources = [
        // Method 1: Try API to get current user
        async () => {
          try {
            console.log('🌐 [getCurrentUserId] Trying API /api/auth/check');
            const response = await fetch('/api/auth/check', {
              method: 'GET',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json'
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              console.log('📋 [getCurrentUserId] API response:', data);
              
              if (data.user?.id) {
                console.log('🎯 [getCurrentUserId] Found user ID from API:', data.user.id);
                return data.user.id;
              }
            } else {
              console.log('❌ [getCurrentUserId] API check failed:', response.status);
            }
          } catch (error) {
            console.log('💥 [getCurrentUserId] API check error:', error.message);
          }
          return null;
        },
        // Method 2: Standard Supabase auth token
        () => {
          const token = localStorage.getItem('supabase.auth.token');
          console.log('📦 [getCurrentUserId] localStorage supabase.auth.token:', token ? 'Found' : 'Not found');
          return token;
        },
        () => {
          const token = sessionStorage.getItem('supabase.auth.token');
          console.log('📦 [getCurrentUserId] sessionStorage supabase.auth.token:', token ? 'Found' : 'Not found');
          return token;
        },
        // Method 3: Hostname-based Supabase token
        () => {
          const key = 'sb-' + window.location.hostname.replace(/\./g, '-') + '-auth-token';
          const token = localStorage.getItem(key);
          console.log(`📦 [getCurrentUserId] localStorage ${key}:`, token ? 'Found' : 'Not found');
          return token;
        },
        // Method 4: Global Supabase client
        () => {
          if (window.supabase && typeof window.supabase.auth?.getSession === 'function') {
            console.log('🌐 [getCurrentUserId] Using global Supabase client');
            return window.supabase.auth.getSession().then(({ data }) => {
              const userId = data?.session?.user?.id;
              console.log('🌐 [getCurrentUserId] Supabase session user ID:', userId || 'Not found');
              return userId;
            });
          }
          console.log('🌐 [getCurrentUserId] Global Supabase client not available');
          return null;
        },
        // Method 5: Try to get from custom session storage
        () => {
          const customSession = localStorage.getItem('custom_session');
          if (customSession) {
            try {
              const parsed = JSON.parse(customSession);
              console.log('🔧 [getCurrentUserId] Custom session found:', parsed?.userId ? 'Has userId' : 'No userId');
              return parsed?.userId;
            } catch (e) {
              console.log('🔧 [getCurrentUserId] Custom session parse error:', e.message);
            }
          }
          return null;
        }
      ];

      for (let i = 0; i < sources.length; i++) {
        try {
          console.log(`🔄 [getCurrentUserId] Trying source ${i + 1}/${sources.length}`);
          const result = await sources[i]();
          
          if (result) {
            console.log(`✅ [getCurrentUserId] Source ${i + 1} returned:`, typeof result, result.length ? `(${result.length} chars)` : '');
            
            // If it's a string, try to parse JSON
            if (typeof result === 'string') {
              try {
                const parsed = JSON.parse(result);
                console.log('📋 [getCurrentUserId] Parsed JSON keys:', Object.keys(parsed));
                
                if (parsed?.user?.id) {
                  console.log('🎯 [getCurrentUserId] Found user ID in parsed.user.id:', parsed.user.id);
                  return parsed.user.id;
                }
                if (parsed?.access_token) {
                  console.log('🔑 [getCurrentUserId] Found access_token, parsing JWT...');
                  // Parse user ID from JWT token
                  const payload = JSON.parse(atob(parsed.access_token.split('.')[1]));
                  console.log('🔑 [getCurrentUserId] JWT payload keys:', Object.keys(payload));
                  if (payload?.sub) {
                    console.log('🎯 [getCurrentUserId] Found user ID in JWT sub:', payload.sub);
                    return payload.sub;
                  }
                }
              } catch (e) {
                console.log('⚠️ [getCurrentUserId] JSON parsing failed:', e.message);
                // If it's a valid string that looks like a UUID, use it directly
                if (result.length > 10 && (result.includes('-') || result.length === 36)) {
                  console.log('🎯 [getCurrentUserId] Using string as direct user ID:', result);
                  return result;
                }
              }
            } else if (typeof result === 'string' && result.length > 0) {
              console.log('🎯 [getCurrentUserId] Using direct string result:', result);
              return result;
            }
          } else {
            console.log(`❌ [getCurrentUserId] Source ${i + 1} returned null/empty`);
          }
        } catch (error) {
          console.log(`⚠️ [getCurrentUserId] Source ${i + 1} error:`, error.message);
        }
      }
      
      console.log('❌ [getCurrentUserId] No user ID found from any source');
      return null;
    } catch (error) {
      console.error('💥 [getCurrentUserId] Critical error:', error);
      return null;
    }
  }

  /**
   * Get user role from API with enhanced error handling and fallback detection
   * @param {string} userId - User ID
   * @returns {Promise<string>} User role
   */
  async getUserRole(userId) {
    console.log('👑 [getUserRole] Starting role detection for userId:', userId);
    
    if (!userId) {
      console.log('❌ [getUserRole] No userId provided, returning free');
      return 'free';
    }

    try {
      // Method 1: Try API endpoint
      console.log('🌐 [getUserRole] Attempting API call to get-user-role');
      const response = await fetch(`/api/auth/get-user-role?userId=${encodeURIComponent(userId)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📡 [getUserRole] API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📋 [getUserRole] API response data:', data);
        
        if (data.success && data.role) {
          console.log('✅ [getUserRole] Successfully got role from API:', data.role);
          return data.role;
        } else {
          console.log('⚠️ [getUserRole] API returned unsuccessful response:', data);
        }
      } else {
        console.log('❌ [getUserRole] API request failed with status:', response.status);
      }
    } catch (error) {
      console.log('💥 [getUserRole] API request error:', error.message);
    }

    // Method 2: Try POST method as fallback
    try {
      console.log('🔄 [getUserRole] Trying POST method as fallback');
      const response = await fetch('/api/auth/get-user-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId })
      });
      
      console.log('📡 [getUserRole] POST response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📋 [getUserRole] POST response data:', data);
        
        if (data.success && data.role) {
          console.log('✅ [getUserRole] Successfully got role from POST API:', data.role);
          return data.role;
        }
      }
    } catch (error) {
      console.log('💥 [getUserRole] POST request error:', error.message);
    }

    // Method 3: Check for admin indicators in localStorage/sessionStorage
    console.log('🔍 [getUserRole] Checking local storage for admin indicators');
    try {
      const adminIndicators = [
        'admin_session',
        'user_role',
        'is_admin',
        'admin_token'
      ];
      
      for (const indicator of adminIndicators) {
        const localValue = localStorage.getItem(indicator);
        const sessionValue = sessionStorage.getItem(indicator);
        
        if (localValue) {
          console.log(`🔧 [getUserRole] Found ${indicator} in localStorage:`, localValue);
          if (localValue.toLowerCase().includes('admin')) {
            console.log('🎯 [getUserRole] Admin detected from localStorage indicator');
            return 'admin';
          }
        }
        
        if (sessionValue) {
          console.log(`🔧 [getUserRole] Found ${indicator} in sessionStorage:`, sessionValue);
          if (sessionValue.toLowerCase().includes('admin')) {
            console.log('🎯 [getUserRole] Admin detected from sessionStorage indicator');
            return 'admin';
          }
        }
      }
    } catch (error) {
      console.log('⚠️ [getUserRole] Error checking local storage:', error.message);
    }

    // Method 4: Check for admin email patterns
    console.log('📧 [getUserRole] Checking for admin email patterns');
    try {
      const adminEmails = [
        'wangpangzier@gmail.com',
        'admin@',
        'root@',
        'superuser@'
      ];
      
      // Try to get email from various sources
      const emailSources = [
        () => localStorage.getItem('user_email'),
        () => sessionStorage.getItem('user_email'),
        () => {
          const customSession = localStorage.getItem('custom_session');
          if (customSession) {
            try {
              const parsed = JSON.parse(customSession);
              return parsed?.email || parsed?.user?.email;
            } catch (e) {
              return null;
            }
          }
          return null;
        }
      ];
      
      for (const getEmail of emailSources) {
        try {
          const email = getEmail();
          if (email) {
            console.log('📧 [getUserRole] Found email:', email);
            for (const adminEmail of adminEmails) {
              if (email.toLowerCase().includes(adminEmail.toLowerCase())) {
                console.log('🎯 [getUserRole] Admin detected from email pattern:', adminEmail);
                return 'admin';
              }
            }
          }
        } catch (error) {
          console.log('⚠️ [getUserRole] Error getting email from source:', error.message);
        }
      }
    } catch (error) {
      console.log('⚠️ [getUserRole] Error checking email patterns:', error.message);
    }

    // Default fallback
    console.log('🔄 [getUserRole] All methods failed, returning default role: free');
    return 'free';
  }

  /**
   * Get default quota information for guest users
   * @param {string} quotaType - Quota type
   * @returns {Object} Default quota information
   */
  getGuestQuotaInfo(quotaType) {
    console.log('🎯 [getGuestQuotaInfo] Calculating guest quota for:', quotaType);
    
    // Provide basic quota for guest users
    const guestQuotas = {
      'dr_check': { monthlyLimit: 5, dailyLimit: 2 },
      'traffic_check': { monthlyLimit: 5, dailyLimit: 2 },
      'backlink_check': { monthlyLimit: 3, dailyLimit: 1 },
      'backlink_view': { monthlyLimit: 10, dailyLimit: 5 }
    };

    const quota = guestQuotas[quotaType] || { monthlyLimit: 3, dailyLimit: 1 };
    console.log('📋 [getGuestQuotaInfo] Base quota limits:', quota);
    
    // Get guest usage records from localStorage
    const guestUsage = JSON.parse(localStorage.getItem('guestQuotaUsage') || '{}');
    console.log('💾 [getGuestQuotaInfo] Current localStorage usage:', guestUsage);
    
    const today = new Date().toDateString();
    const currentMonth = new Date().getFullYear() + '-' + (new Date().getMonth() + 1);
    console.log('📅 [getGuestQuotaInfo] Today:', today, 'Current month:', currentMonth);
    
    const dailyUsed = guestUsage[quotaType]?.[today] || 0;
    const monthlyUsed = guestUsage[quotaType]?.[currentMonth] || 0;
    console.log('📊 [getGuestQuotaInfo] Usage - Daily:', dailyUsed, 'Monthly:', monthlyUsed);
    
    const canUse = dailyUsed < quota.dailyLimit && monthlyUsed < quota.monthlyLimit;
    console.log('✅ [getGuestQuotaInfo] Can use calculation:', {
      dailyCheck: `${dailyUsed} < ${quota.dailyLimit} = ${dailyUsed < quota.dailyLimit}`,
      monthlyCheck: `${monthlyUsed} < ${quota.monthlyLimit} = ${monthlyUsed < quota.monthlyLimit}`,
      finalResult: canUse
    });
    
    const result = {
      canUse,
      monthlyUsed,
      monthlyLimit: quota.monthlyLimit,
      dailyUsed,
      dailyLimit: quota.dailyLimit,
      planType: 'guest',
      isGuest: true
    };
    
    console.log('🎯 [getGuestQuotaInfo] Final result:', result);
    return result;
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
   * Execute operation with quota check and enhanced admin detection
   * @param {string} quotaType - Quota type
   * @param {Function} operation - Operation function to execute
   * @param {string} displayElementId - Display element ID (optional)
   * @returns {Promise<any>} Operation result
   */
  async executeWithQuotaCheck(quotaType, operation, displayElementId = null) {
    try {
      console.log('🔍 [QuotaManager] Starting quota check for:', quotaType);
      
      // Enhanced admin detection - Method 1: Direct admin check
      console.log('🎯 [QuotaManager] Performing enhanced admin detection');
      
      // Check for admin indicators before user ID check
      const isAdminByIndicators = await this.checkAdminIndicators();
      if (isAdminByIndicators) {
        console.log('🎯 [QuotaManager] Admin detected by indicators, skipping all checks');
        const result = await operation();
        if (displayElementId) {
          this.displayAdminQuotaInfo(displayElementId, quotaType);
        }
        return result;
      }
      
      const userId = await this.getCurrentUserId();
      console.log('👤 [QuotaManager] User ID:', userId || 'Guest user');
      
      if (!userId) {
        // Last chance admin check for cases where userId is not available
        const isAdminByEmail = await this.checkAdminByEmail();
        if (isAdminByEmail) {
          console.log('🎯 [QuotaManager] Admin detected by email without userId');
          const result = await operation();
          if (displayElementId) {
            this.displayAdminQuotaInfo(displayElementId, quotaType);
          }
          return result;
        }
        
        console.log('❌ [QuotaManager] Not admin and no user ID, using guest quota');
      }
      
      // Enhanced admin detection - Method 2: Multiple role checks
      if (userId) {
        console.log('👑 [QuotaManager] Performing multiple admin role checks');
        
        // Try multiple methods to detect admin
        const adminCheckMethods = [
          () => this.getUserRole(userId),
          () => this.checkAdminByUserId(userId),
          () => this.checkAdminByEmail()
        ];
        
        for (let i = 0; i < adminCheckMethods.length; i++) {
          try {
            console.log(`🔍 [QuotaManager] Admin check method ${i + 1}`);
            const result = await adminCheckMethods[i]();
            
            if (result === 'admin' || result === true) {
              console.log(`🎯 [QuotaManager] Admin detected by method ${i + 1}, skipping quota check`);
              
              // Execute operation directly for admin
              const operationResult = await operation();
              
              // Update display to show unlimited quota for admin
              if (displayElementId) {
                this.displayAdminQuotaInfo(displayElementId, quotaType);
              }
              
              return operationResult;
            }
          } catch (error) {
            console.log(`⚠️ [QuotaManager] Admin check method ${i + 1} failed:`, error.message);
            // Continue to next method
          }
        }
        
        console.log('📊 [QuotaManager] No admin privileges detected, proceeding with quota check');
      }
      
      let quotaInfo;
      
      if (!userId) {
        // Use guest quota for non-logged-in users
        console.log('🎯 [QuotaManager] Using guest quota logic');
        quotaInfo = this.getGuestQuotaInfo(quotaType);
        console.log('📊 [QuotaManager] Guest quota info:', quotaInfo);
      } else {
        // Use API to check quota for logged-in users
        console.log('🌐 [QuotaManager] Checking quota via API');
        quotaInfo = await this.checkQuota(quotaType, userId);
        console.log('📊 [QuotaManager] API quota info:', quotaInfo);
      }
      
      console.log('✅ [QuotaManager] Can use quota:', quotaInfo.canUse);
      
      if (!quotaInfo.canUse) {
        console.log('❌ [QuotaManager] Quota exceeded! Throwing error');
        if (displayElementId) {
          this.showQuotaExceededMessage(displayElementId, quotaType);
        }
        throw new Error('Quota exceeded');
      }
      
      console.log('🚀 [QuotaManager] Quota check passed, executing operation');

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

  /**
   * Check admin indicators from various sources
   * @returns {Promise<boolean>} Whether admin indicators are found
   */
  async checkAdminIndicators() {
    try {
      const adminIndicators = [
        'admin_session',
        'user_role',
        'is_admin',
        'admin_token'
      ];
      
      for (const indicator of adminIndicators) {
        const localValue = localStorage.getItem(indicator);
        const sessionValue = sessionStorage.getItem(indicator);
        
        if (localValue && localValue.toLowerCase().includes('admin')) {
          console.log(`🎯 [checkAdminIndicators] Admin detected from localStorage ${indicator}`);
          return true;
        }
        
        if (sessionValue && sessionValue.toLowerCase().includes('admin')) {
          console.log(`🎯 [checkAdminIndicators] Admin detected from sessionStorage ${indicator}`);
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.log('⚠️ [checkAdminIndicators] Error:', error.message);
      return false;
    }
  }

  /**
   * Check admin by user ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Whether user is admin
   */
  async checkAdminByUserId(userId) {
    try {
      // Check if userId matches known admin patterns
      const adminUserIds = [
        'admin',
        'root',
        'superuser'
      ];
      
      return adminUserIds.some(adminId => userId.toLowerCase().includes(adminId));
    } catch (error) {
      console.log('⚠️ [checkAdminByUserId] Error:', error.message);
      return false;
    }
  }

  /**
   * Check admin by email patterns
   * @returns {Promise<boolean>} Whether admin email is found
   */
  async checkAdminByEmail() {
    try {
      const adminEmails = [
        'wangpangzier@gmail.com',
        'admin@',
        'root@',
        'superuser@'
      ];
      
      // Try to get email from various sources
      const emailSources = [
        () => localStorage.getItem('user_email'),
        () => sessionStorage.getItem('user_email'),
        () => {
          const customSession = localStorage.getItem('custom_session');
          if (customSession) {
            try {
              const parsed = JSON.parse(customSession);
              return parsed?.email || parsed?.user?.email;
            } catch (e) {
              return null;
            }
          }
          return null;
        }
      ];
      
      for (const getEmail of emailSources) {
        try {
          const email = getEmail();
          if (email) {
            for (const adminEmail of adminEmails) {
              if (email.toLowerCase().includes(adminEmail.toLowerCase())) {
                console.log('🎯 [checkAdminByEmail] Admin detected from email pattern:', adminEmail);
                return true;
              }
            }
          }
        } catch (error) {
          console.log('⚠️ [checkAdminByEmail] Error getting email from source:', error.message);
        }
      }
      
      return false;
    } catch (error) {
      console.log('⚠️ [checkAdminByEmail] Error:', error.message);
      return false;
    }
  }
}

// Create global instance
window.quotaManager = new QuotaManager();

// Export class (if using module system)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QuotaManager;
}