import { useState } from 'react';
import type { Resource } from '../data/resources';

export function useLocalStorage() {
  const [hasConsented, setHasConsented] = useState<boolean | null>(() => {
    const consent = localStorage.getItem('crf_consent');
    if (consent === 'true') return true;
    if (consent === 'false') return false;
    return null;
  });

  const [favorites, setFavorites] = useState<string[]>(() => {
    const consent = localStorage.getItem('crf_consent');
    if (consent === 'true') {
      const saved = localStorage.getItem('crf_favorites');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return [];
        }
      }
    }
    return [];
  });

  const [userResources, setUserResources] = useState<Resource[]>(() => {
    const consent = localStorage.getItem('crf_consent');
    if (consent === 'true') {
      const savedResources = localStorage.getItem('crf_user_resources');
      if (savedResources) {
        try {
          return JSON.parse(savedResources);
        } catch {
          return [];
        }
      }
    }
    return [];
  });

  const handleConsent = (allow: boolean) => {
    setHasConsented(allow);
    localStorage.setItem('crf_consent', String(allow));
    if (!allow) {
      localStorage.removeItem('crf_favorites');
      localStorage.removeItem('crf_analytics');
      localStorage.removeItem('crf_reports');
      localStorage.removeItem('crf_user_resources');
      setFavorites([]);
      setUserResources([]);
    }
  };

  const saveFavorites = (favs: string[]) => {
    setFavorites(favs);
    localStorage.setItem('crf_favorites', JSON.stringify(favs));
  };

  const addUserResource = (res: Resource) => {
    const updated = [...userResources, res];
    setUserResources(updated);
    localStorage.setItem('crf_user_resources', JSON.stringify(updated));
  };

  const clearAllData = () => {
    if (confirm('Delete ALL local data (Favorites, Stats, Added Resources)?')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const trackEvent = (metric: 'searches' | 'views' | 'favorites' | 'emergency') => {
    if (!hasConsented) return;
    const stats = JSON.parse(localStorage.getItem('crf_analytics') || '{"searches":0,"views":0,"favorites":0,"emergency":0}');
    stats[metric]++;
    localStorage.setItem('crf_analytics', JSON.stringify(stats));
  };

  const saveReport = (resourceName: string, issue: string) => {
    if (hasConsented) {
      const reports = JSON.parse(localStorage.getItem('crf_reports') || '[]');
      reports.push({ resource: resourceName, issue, timestamp: new Date().toISOString() });
      localStorage.setItem('crf_reports', JSON.stringify(reports));
    }
  };

  const exportBackup = (): string => {
    try {
      const data = {
        favorites,
        userResources,
        hasConsented,
        analytics: JSON.parse(localStorage.getItem('crf_analytics') || '{}'),
        reports: JSON.parse(localStorage.getItem('crf_reports') || '[]'),
      };
      const jsonStr = JSON.stringify(data);
      return btoa(encodeURIComponent(jsonStr));
    } catch (e) {
      console.error('Failed to export backup:', e);
      return '';
    }
  };

  const importBackup = (backupStr: string): boolean => {
    try {
      if (!backupStr) return false;
      const decoded = decodeURIComponent(atob(backupStr.trim()));
      const data = JSON.parse(decoded);
      if (!data || typeof data !== 'object') return false;

      if (data.hasConsented !== undefined) {
        setHasConsented(data.hasConsented);
        localStorage.setItem('crf_consent', String(data.hasConsented));
      }

      if (Array.isArray(data.favorites)) {
        setFavorites(data.favorites);
        localStorage.setItem('crf_favorites', JSON.stringify(data.favorites));
      }

      if (Array.isArray(data.userResources)) {
        setUserResources(data.userResources);
        localStorage.setItem('crf_user_resources', JSON.stringify(data.userResources));
      }

      if (data.analytics && typeof data.analytics === 'object') {
        localStorage.setItem('crf_analytics', JSON.stringify(data.analytics));
      }

      if (Array.isArray(data.reports)) {
        localStorage.setItem('crf_reports', JSON.stringify(data.reports));
      }

      return true;
    } catch (e) {
      console.error('Failed to import backup:', e);
      return false;
    }
  };

  return {
    favorites,
    userResources,
    hasConsented,
    handleConsent,
    saveFavorites,
    addUserResource,
    clearAllData,
    trackEvent,
    saveReport,
    exportBackup,
    importBackup,
  };
}

