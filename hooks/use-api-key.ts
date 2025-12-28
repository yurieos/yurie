'use client';

import { useState, useEffect } from 'react';

export function useApiKey() {
  const [firecrawlApiKey, setFirecrawlApiKey] = useState<string>('');
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [isCheckingEnv, setIsCheckingEnv] = useState<boolean>(true);

  // Check for environment variables on mount
  useEffect(() => {
    const checkEnvironment = async () => {
      setIsCheckingEnv(true);
      try {
        const response = await fetch('/api/check-env');
        const data = await response.json();
        
        if (data.environmentStatus) {
          setHasApiKey(data.environmentStatus.FIRECRAWL_API_KEY);
        }
      } catch (error) {
        console.error('Failed to check environment:', error);
        setHasApiKey(false);
      } finally {
        setIsCheckingEnv(false);
      }
    };

    checkEnvironment();
  }, []);

  const saveApiKey = (key: string) => {
    if (key.trim()) {
      setFirecrawlApiKey(key.trim());
      setHasApiKey(true);
      return true;
    }
    return false;
  };

  return {
    firecrawlApiKey,
    setFirecrawlApiKey,
    hasApiKey,
    setHasApiKey,
    isCheckingEnv,
    saveApiKey,
  };
}

