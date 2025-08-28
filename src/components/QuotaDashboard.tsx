import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, AlertCircle, Crown } from 'lucide-react';

interface QuotaData {
  quotaType: string;
  monthlyLimit: number;
  monthlyUsed: number;
  dailyLimit: number;
  dailyUsed: number;
  resetDate: string;
}

interface UserRole {
  role: string;
  planType: string;
}

interface QuotaDashboardProps {
  userId?: string;
  className?: string;
}

const QuotaDashboard: React.FC<QuotaDashboardProps> = ({ userId, className = '' }) => {
  const [quotaData, setQuotaData] = useState<QuotaData[]>([]);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchQuotaData();
  }, [userId]);

  const fetchQuotaData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current user ID if not provided
      const currentUserId = userId || await getCurrentUserId();
      if (!currentUserId) {
        setError('User not authenticated');
        return;
      }

      // Fetch quota data for all quota types
      const quotaTypes = ['dr_check', 'traffic_check', 'backlink_check'];
      const quotaPromises = quotaTypes.map(async (quotaType) => {
        const response = await fetch('/api/quota/check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ quotaType, userId: currentUserId }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch ${quotaType} quota`);
        }

        const data = await response.json();
        return {
          quotaType,
          monthlyLimit: data.monthlyLimit,
          monthlyUsed: data.monthlyUsed,
          dailyLimit: data.dailyLimit,
          dailyUsed: data.dailyUsed,
          resetDate: data.resetDate,
        };
      });

      const quotaResults = await Promise.all(quotaPromises);
      setQuotaData(quotaResults);

      // Get user role information from the first quota response
      if (quotaResults.length > 0) {
        const firstQuotaResponse = await fetch('/api/quota/check', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ quotaType: quotaTypes[0], userId: currentUserId }),
        });

        if (firstQuotaResponse.ok) {
          const data = await firstQuotaResponse.json();
          setUserRole({
            role: data.userRole,
            planType: data.planType,
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch quota data');
    } finally {
      setLoading(false);
    }
  };

  const getCurrentUserId = async (): Promise<string | null> => {
    try {
      // This would typically get the user ID from authentication context
      // For now, we'll use a placeholder implementation
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        return data.userId;
      }
    } catch (error) {
      console.error('Failed to get current user ID:', error);
    }
    return null;
  };

  const getQuotaTypeLabel = (quotaType: string): string => {
    const labels: Record<string, string> = {
      dr_check: 'DR Check',
      traffic_check: 'Traffic Check',
      backlink_check: 'Backlink Check',
    };
    return labels[quotaType] || quotaType;
  };

  const getUsagePercentage = (used: number, limit: number): number => {
    if (limit === 0) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getPlanBadgeColor = (planType: string): string => {
    const colors: Record<string, string> = {
      free: 'bg-gray-100 text-gray-800',
      basic: 'bg-blue-100 text-blue-800',
      pro: 'bg-purple-100 text-purple-800',
      enterprise: 'bg-yellow-100 text-yellow-800',
    };
    return colors[planType] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <div className="flex items-center text-red-600">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>Error loading quota data: {error}</span>
        </div>
        <button
          onClick={fetchQuotaData}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <BarChart3 className="h-6 w-6 text-blue-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">Quota Usage</h2>
        </div>
        {userRole && (
          <div className="flex items-center space-x-2">
            <Crown className="h-4 w-4 text-yellow-500" />
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPlanBadgeColor(userRole.planType)}`}>
              {userRole.planType.toUpperCase()} Plan
            </span>
          </div>
        )}
      </div>

      {/* Quota Cards */}
      <div className="space-y-4">
        {quotaData.map((quota) => {
          const monthlyPercentage = getUsagePercentage(quota.monthlyUsed, quota.monthlyLimit);
          const dailyPercentage = getUsagePercentage(quota.dailyUsed, quota.dailyLimit);

          return (
            <div key={quota.quotaType} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900">{getQuotaTypeLabel(quota.quotaType)}</h3>
                <TrendingUp className="h-4 w-4 text-gray-400" />
              </div>

              {/* Monthly Usage */}
              <div className="mb-3">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Monthly Usage</span>
                  <span>{quota.monthlyUsed} / {quota.monthlyLimit}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(monthlyPercentage)}`}
                    style={{ width: `${monthlyPercentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Daily Usage */}
              <div className="mb-3">
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Daily Usage</span>
                  <span>{quota.dailyUsed} / {quota.dailyLimit}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${getUsageColor(dailyPercentage)}`}
                    style={{ width: `${dailyPercentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Reset Date */}
              <div className="text-xs text-gray-500">
                Resets: {new Date(quota.resetDate).toLocaleDateString()}
              </div>

              {/* Warning for high usage */}
              {(monthlyPercentage >= 80 || dailyPercentage >= 80) && (
                <div className="mt-2 flex items-center text-yellow-600 text-sm">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  <span>High usage - consider upgrading your plan</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Upgrade CTA */}
      {userRole && userRole.planType === 'free' && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-blue-900">Need more quota?</h4>
              <p className="text-sm text-blue-700">Upgrade to a paid plan for higher limits</p>
            </div>
            <a
              href="/pricing"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
            >
              Upgrade Now
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotaDashboard;