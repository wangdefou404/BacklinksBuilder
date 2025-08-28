/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user?: {
      id: string;
      email?: string;
      user_metadata?: {
        full_name?: string;
        name?: string;
        avatar_url?: string;
        picture?: string;
      };
    } | null;
  }
}
