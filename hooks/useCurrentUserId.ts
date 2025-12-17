'use client';

import { useEffect, useState } from 'react';
import { jwtDecode } from 'jwt-decode';
import { AuthService } from '@/services/auth.service';

interface JwtPayload {
  sub: string;
  name: string;
  exp: number;
}

export function useCurrentUserId() {
  const [currentUserId, setCurrentUserId] = useState<string>('');

  useEffect(() => {
    const token = AuthService.getToken();
    if (!token) return;

    const decoded = jwtDecode<JwtPayload>(token);
    setCurrentUserId(String(decoded.sub));
  }, []);

  return currentUserId;
}
