'use client';

import { ReactNode } from 'react';

// Custom session provider - no external auth library needed
// Session is managed via HTTP-only cookies set by /api/auth/callback
export function SessionProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
