import { useState, useEffect, useMemo } from 'react';
import { resources } from '../data/resources';
import type { Resource, City, ResourceType } from '../data/resources';

export type TransportMode = 'walking' | 'bus' | 'car';

/**
 * Service-Request Mode — maps natural language keywords to resource types.
 * e.g. "I need food near Dadar" → infers type 'food'
 */
const KEYWORD_TYPE_MAP: Array<{ keywords: string[]; type: ResourceType }> = [
  { keywords: ['food', 'hungry', 'eat', 'meal', 'lunch', 'dinner', 'breakfast', 'kitchen', 'rice', 'roti', 'langar', 'annadaan'], type: 'food' },
  { keywords: ['shelter', 'sleep', 'stay', 'homeless', 'roof', 'night', 'bed', 'house', 'basera', 'rain'], type: 'shelter' },
  { keywords: ['hospital', 'doctor', 'medical', 'medicine', 'sick', 'hurt', 'health', 'clinic', 'ambulance', 'injury', 'emergency care', 'phc', 'checkup', 'treatment'], type: 'hospital' },
  { keywords: ['police', 'crime', 'danger', 'unsafe', 'violence', 'theft', 'robbery', 'harassed', 'pcr', 'safety', 'fir'], type: 'police' },
  { keywords: ['school', 'learn', 'study', 'education', 'class', 'course', 'training', 'literacy', 'skill', 'books'], type: 'education' },
  { keywords: ['volunteer', 'donate', 'help others', 'contribute', 'seva', 'ngo'], type: 'volunteer' },
];

/**
 * Infers a resource type from a natural language query string.
 * Returns null if no clear keyword match is found.
 */
export function inferTypeFromQuery(query: string): ResourceType | null {
  const q = query.toLowerCase();
  for (const { keywords, type } of KEYWORD_TYPE_MAP) {
    if (keywords.some(kw => q.includes(kw))) return type;
  }
  return null;
}


/**
 * Checks if a resource is open right now given its hours string.
 * Supports multi-range hours like "10:00 AM - 2:00 PM, 6:00 PM - 8:00 PM".
 */
export function isOpenNow(hoursStr: string): boolean {
  if (!hoursStr) return false;
  if (hoursStr.includes('24 Hours')) return true;
  try {
    const now = new Date();
    const currentDecimalHour = now.getHours() + now.getMinutes() / 60;

    const parseTime = (t: string): number => {
      const match = t.trim().match(/(\d+):?(\d+)?\s*(AM|PM)/i);
      if (!match) return -1;
      let h = parseInt(match[1]);
      const m = match[2] ? parseInt(match[2]) : 0;
      if (match[3].toUpperCase() === 'PM' && h !== 12) h += 12;
      if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
      return h + m / 60;
    };

    const ranges = hoursStr.split(',').map(s => s.trim());
    for (const range of ranges) {
      const parts = range.split(/\s+-\s+/);
      if (parts.length !== 2) continue;
      const start = parseTime(parts[0]);
      const end = parseTime(parts[1]);
      if (start === -1 || end === -1) continue;
      // Handle overnight ranges (e.g. 10 PM - 6 AM)
      if (end < start) {
        if (currentDecimalHour >= start || currentDecimalHour < end) return true;
      } else {
        if (currentDecimalHour >= start && currentDecimalHour < end) return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Returns freshness category based on last_updated ISO date string.
 * 🟢 within 30 days, 🟡 30–90 days, 🔴 90+ days
 */
export function getFreshnessIndicator(lastUpdated: string): { emoji: string; label: string; color: string } {
  try {
    const updated = new Date(lastUpdated);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - updated.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 30) return { emoji: '🟢', label: 'Recently verified', color: '#4ade80' };
    if (diffDays <= 90) return { emoji: '🟡', label: 'Verified ~1–3 months ago', color: '#facc15' };
    return { emoji: '🔴', label: 'May be outdated (90+ days)', color: '#f87171' };
  } catch {
    return { emoji: '⚪', label: 'Unknown', color: '#6b7280' };
  }
}

/** Parse transport time string to minutes for sorting (e.g. "15 min" → 15) */
export function parseTransportMinutes(timeStr: string | undefined): number {
  if (!timeStr || timeStr === 'N/A' || timeStr === 'Varies') return 9999;
  const match = timeStr.match(/(\d+)/);
  return match ? parseInt(match[1]) : 9999;
}

interface FilterOptions {
  selectedCity: City;
  selectedType: ResourceType | null;
  searchQuery: string;
  emergencyMode: boolean;
  filterOpenNow: boolean;
  filterLanguage: string;
  showSavedOnly: boolean;
  showDemoResources: boolean;
  transportMode: TransportMode;
  favorites: string[];
  userResources: Resource[];
  isActive: boolean; // only filter when in CONSOLE view
}

export function useResourceFilter(options: FilterOptions) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const {
    selectedCity, selectedType, searchQuery, emergencyMode,
    filterOpenNow, filterLanguage, showSavedOnly, showDemoResources,
    transportMode, favorites, userResources, isActive,
  } = options;

  const filteredResources = useMemo(() => {
    if (!isActive) return [];

    let matches = [...userResources, ...resources];

    // Hide demo resources by default
    if (!showDemoResources) {
      matches = matches.filter(r => !r.name.startsWith('[Demo]'));
    }

    // Filter by City
    matches = matches.filter(r => r.city === selectedCity);

    // Service-Request Mode: infer type from natural language query
    const inferredType = searchQuery ? inferTypeFromQuery(searchQuery) : null;
    const activeType = inferredType ?? selectedType;

    // Filter by Saved or Type
    if (showSavedOnly) {
      matches = matches.filter(r => favorites.includes(r.id));
    } else if (activeType) {
      matches = matches.filter(r => r.type === activeType);
    }

    // Search Query — after type filter, narrow by remaining terms
    if (searchQuery && !inferredType) {
      // No type was inferred — full-text search across all types
      const q = searchQuery.toLowerCase();
      matches = matches.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.services.join(' ').toLowerCase().includes(q) ||
        r.type.toLowerCase().includes(q)
      );
    } else if (searchQuery && inferredType) {
      // Type was inferred — still allow addtional terms to narrow further
      // Strip the matched keyword and search on the remainder
      const stripped = searchQuery.toLowerCase()
        .replace(/\b(need|want|looking for|find|i|near|a|an|the|some|please|help)\b/g, ' ')
        .trim();
      if (stripped.length > 2) {
        const q = stripped;
        matches = matches.filter(r =>
          r.name.toLowerCase().includes(q) ||
          r.address.toLowerCase().includes(q) ||
          r.services.join(' ').toLowerCase().includes(q)
        );
      }
    }


    // Emergency Mode — sort by priority/urgency first
    if (emergencyMode) {
      matches = matches.sort((a, b) => {
        if (a.priority === 'High' && b.priority !== 'High') return -1;
        if (b.priority === 'High' && a.priority !== 'High') return 1;
        if (a.is_emergency && !b.is_emergency) return -1;
        if (!a.is_emergency && b.is_emergency) return 1;
        return 0;
      });
    } else {
      // Sort by transport time for the selected mode (nearest first)
      matches = matches.sort((a, b) => {
        const aTime = parseTransportMinutes(a.transport_estimates?.[transportMode]);
        const bTime = parseTransportMinutes(b.transport_estimates?.[transportMode]);
        return aTime - bTime;
      });
    }

    // Open Now filter
    if (filterOpenNow) {
      matches = matches.filter(r => isOpenNow(r.hours));
    }

    // Language filter
    if (filterLanguage !== 'All') {
      matches = matches.filter(r => r.languages.includes(filterLanguage));
    }

    return matches;
  }, [
    selectedCity, selectedType, searchQuery, emergencyMode,
    filterOpenNow, filterLanguage, showSavedOnly, showDemoResources,
    transportMode, favorites, userResources, isActive,
  ]);

  // Reset index to 0 when resources filtered state changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex(0);
  }, [filteredResources.length]);

  return { filteredResources, selectedIndex, setSelectedIndex };
}

