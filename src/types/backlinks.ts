export interface BacklinkResource {
  id: string;
  name: string;
  websiteLink: string;
  dr: number; // Domain Rating
  traffic: number; // Monthly traffic
  paymentType: 'Free' | 'Paid';
  followType: 'DoFollow' | 'NoFollow';
  platformType: 'blog' | 'directory' | 'content' | 'comment' | 'social';
  access: 'guest' | 'premium';
  updated: string; // ISO date string
  featured?: boolean;
  tags?: string[];
  submissionUrl?: string;
  requirements?: string;
  approvalTime?: string;
  contactEmail?: string;
}

export interface BacklinkFilters {
  search?: string;
  paymentType?: string;
  followType?: string;
  platformType?: string;
  minDr?: number;
  maxDr?: number;
  minTraffic?: number;
  maxTraffic?: number;
}

export interface BacklinkListResponse {
  data: BacklinkResource[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface UserPermissions {
  isPremium: boolean;
  maxViewableItems: number;
}