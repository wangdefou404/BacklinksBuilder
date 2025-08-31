/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user?: {
      id: string;
      email?: string;
      role?: string;
      user_metadata?: {
        full_name?: string;
        name?: string;
        avatar_url?: string;
        picture?: string;
      };
    } | null;
    session?: {
      user: {
        id: string;
        email?: string;
        role?: string;
        user_metadata?: {
          full_name?: string;
          name?: string;
          avatar_url?: string;
          picture?: string;
        };
      };
      access_token: string;
      refresh_token?: string;
      expires_at?: number;
    } | null;
  }
}
