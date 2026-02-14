'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUserData } from './use-user-data';

export function usePermission(permissionName: string) {
  const { userData, loading: userLoading } = useUserData();
  const [hasPermission, setHasPermission] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkPermission = useCallback(async () => {
    if (!userData || !permissionName) {
      setHasPermission(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Chamar a API para verificar permissão
      const response = await fetch('/api/auth/check-permission', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          permission: permissionName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao verificar permissão');
      }

      const data = await response.json();
      setHasPermission(data.hasPermission);
    } catch (error: any) {
      console.error('Erro ao verificar permissão:', error);
      setError(error.message);
      setHasPermission(false);
    } finally {
      setLoading(false);
    }
  }, [userData, permissionName]);

  useEffect(() => {
    if (!userLoading) {
      checkPermission();
    }
  }, [userLoading, checkPermission]);

  return {
    hasPermission,
    loading: loading || userLoading,
    error,
    checkPermission,
  };
} 