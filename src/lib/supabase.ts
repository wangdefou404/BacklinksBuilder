import { createClient } from '@supabase/supabase-js';

// Supabase配置
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// 创建Supabase客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    debug: false,
    storage: {
      getItem: (key: string) => {
        if (typeof window !== 'undefined') {
          try {
            return window.localStorage.getItem(key);
          } catch (error) {
            console.warn('LocalStorage getItem error:', error);
            return null;
          }
        }
        return null;
      },
      setItem: (key: string, value: string) => {
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(key, value);
          } catch (error) {
            console.warn('LocalStorage setItem error:', error);
          }
        }
      },
      removeItem: (key: string) => {
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.removeItem(key);
          } catch (error) {
            console.warn('LocalStorage removeItem error:', error);
          }
        }
      }
    }
  },
  global: {
    headers: {
      'X-Client-Info': 'backlinks-builder@1.0.0'
    }
  }
});

// 数据库类型定义
export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  provider?: string;
  created_at: string;
  updated_at: string;
}

export interface UserQuota {
  id: string;
  user_id: string;
  dr_checks_used: number;
  dr_checks_limit: number;
  backlink_checks_used: number;
  backlink_checks_limit: number;
  traffic_checks_used: number;
  traffic_checks_limit: number;
  reset_date: string;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: 'free' | 'pro' | 'super_pro';
  status: 'active' | 'inactive' | 'cancelled';
  stripe_subscription_id?: string;
  current_period_start: string;
  current_period_end: string;
  created_at: string;
  updated_at: string;
}