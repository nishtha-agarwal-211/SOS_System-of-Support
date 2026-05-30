import { useState, useEffect, useRef, useMemo } from 'react';
import { TerminalLayout } from './components/TerminalLayout';
import { AsciiMap } from './components/AsciiMap';
import { StatsDashboard } from './components/StatsDashboard';
import { CliMode } from './components/CliMode';
import { Typewriter } from './components/Typewriter';
import { ConsentDialog } from './components/ConsentDialog';
import { ResourceSubmission } from './components/ResourceSubmission';
import { HelpOverlay } from './components/HelpOverlay';
import { NotificationBanner } from './components/NotificationBanner';
import { ResourceDetail } from './components/views/ResourceDetail';
import { ResourceList } from './components/views/ResourceList';
import { resources, types, cities } from './data/resources';
import type { Resource, City, ResourceType } from './data/resources';
import { Sidebar } from './components/Sidebar';
import { useSound } from './hooks/useSound';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useResourceFilter } from './hooks/useResourceFilter';
import type { TransportMode } from './hooks/useResourceFilter';
import './App.css';

type ViewState = 'INTRO' | 'PURPOSE' | 'CONSOLE';
type FocusArea = 'SIDEBAR' | 'CONTENT';

function App() {
  const [view, setView] = useState<ViewState>('INTRO');
  const [focusArea, setFocusArea] = useState<FocusArea>('SIDEBAR');

  // Console State
  const [selectedType, setSelectedType] = useState<ResourceType | null>('food');
  const [selectedCity, setSelectedCity] = useState<City>('Mumbai');
  const [viewResource, setViewResource] = useState<Resource | null>(null);
  const [showSubmission, setShowSubmission] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [filterOpenNow, setFilterOpenNow] = useState(false);
  const [filterLanguage, setFilterLanguage] = useState<string>('All');
  const [transportMode, setTransportMode] = useState<TransportMode>('walking');
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [showDemoResources, setShowDemoResources] = useState(false);

  // UI State
  const [showStats, setShowStats] = useState(false);
  const [isCliMode, setIsCliMode] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [showIntroContinue, setShowIntroContinue] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true); // Feature 6: Dark/Light toggle

  const notificationTimeoutRef = useRef<number | null>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // ── Hooks ──────────────────────────────────────────────────────────────
  const {
    playBeep, playSuccessSound, playAlertSound,
    playNavigationSound, playSelectSound, playTypeSound,
    playErrorSound,
  } = useSound();

  const {
    favorites, userResources, hasConsented,
    handleConsent, saveFavorites, addUserResource,
    clearAllData, trackEvent, saveReport,
    exportBackup, importBackup,
  } = useLocalStorage();

  const { filteredResources, selectedIndex, setSelectedIndex } = useResourceFilter({
    selectedCity, selectedType, searchQuery, emergencyMode,
    filterOpenNow, filterLanguage, showSavedOnly, showDemoResources,
    transportMode, favorites, userResources,
    isActive: view === 'CONSOLE',
  });

  const [swUpdateAvailable, setSwUpdateAvailable] = useState(false);

  // ── Service Worker registration ────────────────────────────────────────
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((registration) => {
        if (registration.waiting) {
          setSwUpdateAvailable(true);
        }

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setSwUpdateAvailable(true);
              }
            });
          }
        });
      }).catch(() => {
        // SW registration failure is non-fatal in dev mode
      });
    }
  }, []);

  // ── Theme body class sync (Features 6 & 7) ─────────────────────────────
  useEffect(() => {
    document.body.classList.toggle('theme-light', !isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    document.body.classList.toggle('emergency-active', emergencyMode);
  }, [emergencyMode]);

  // ── Helpers ────────────────────────────────────────────────────────────
  const showNotification = (msg: string) => {
    setNotification(msg);
    if (notificationTimeoutRef.current) clearTimeout(notificationTimeoutRef.current);
    notificationTimeoutRef.current = window.setTimeout(() => setNotification(null), 3000);
  };

  const handleAddResource = (res: Resource) => {
    addUserResource(res);
    setShowSubmission(false);
    showNotification('Success: Resource added locally.');
  };

  const toggleFavorite = (id: string) => {
    if (!hasConsented) {
      if (hasConsented === false) showNotification('Storage disabled by user setting.');
      return;
    }
    const isFav = favorites.includes(id);
    const newFavs = isFav ? favorites.filter(f => f !== id) : [...favorites, id];
    saveFavorites(newFavs);
    playSuccessSound();
    showNotification(isFav ? '> Removed from favorites' : '> Favorite saved locally');
  };

  const reportIssue = (resourceName: string) => {
    const issue = prompt(`Report issue for "${resourceName}":\n(e.g., Wrong number, Moved, Closed)`);
    if (issue) {
      saveReport(resourceName, issue);
      showNotification(hasConsented ? 'Thank you — report saved locally.' : 'Report NOT saved (Storage disabled).');
      playSelectSound();
    }
  };

  const shareResource = (r: Resource) => {
    const text = `${r.name} — ${r.phone} — ${r.address.split(',').slice(0, 2).join(',')} — ${r.hours}`;
    navigator.clipboard.writeText(text).then(() => {
      showNotification('> Copied to clipboard!');
      playSuccessSound();
    }).catch(() => showNotification('Copy failed. Try manually.'));
  };

  // Feature 10: Print Emergency Sheet
  const printEmergencySheet = () => {
    const top5 = filteredResources.slice(0, 5);
    if (top5.length === 0) { showNotification('No resources to print.'); return; }
    const html = `<!DOCTYPE html><html><head><title>SOS Emergency Sheet — ${selectedCity}</title>
<style>body{font-family:monospace;padding:24px;max-width:600px;margin:0 auto}
h1{font-size:1.4rem;border-bottom:2px solid #000;padding-bottom:8px}
.resource{border:1px solid #ccc;padding:12px;margin-bottom:12px;page-break-inside:avoid}
.name{font-size:1.1rem;font-weight:bold}.phone{color:#0d9488;font-size:1.2rem}
.detail{color:#555;font-size:0.85rem;margin-top:4px}
footer{font-size:0.75rem;color:#999;border-top:1px solid #ccc;margin-top:20px;padding-top:8px}
@media print{button{display:none}}</style></head><body>
<h1>🆘 SOS Emergency Resource Sheet — ${selectedCity}</h1>
<p style="color:#666;font-size:0.85rem">Printed from SOS: System of Support | ${new Date().toLocaleDateString('en-IN')}</p>
${top5.map((r: Resource, i: number) => `<div class="resource"><div class="name">${i + 1}. ${r.name}</div><div class="phone">${r.phone}</div><div class="detail">${r.address}</div><div class="detail">Hours: ${r.hours}</div><div class="detail">Services: ${r.services.slice(0, 3).join(', ')}</div></div>`).join('')}
<footer>Verified data as of Dec 2025. Call numbers directly — no internet needed.</footer>
<script>window.onload = () => { window.print(); window.close(); }</script></body></html>`;
    const w = window.open('', '_blank', 'width=700,height=800');
    if (w) { w.document.write(html); w.document.close(); }
    else showNotification('Allow pop-ups to print.');
  };

  // ── Derived languages list ─────────────────────────────────────────────
  const availableLanguages = useMemo(() => {
    const langs = new Set<string>();
    resources.forEach(r => r.languages.forEach(l => langs.add(l)));
    return ['All', ...Array.from(langs).sort()];
  }, []);


  // KEYBOARD HANDLER
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showHelp) {
        if (e.key === 'Escape' || e.key === 'H') setShowHelp(false);
        e.preventDefault();
        return;
      }
      if (showStats) {
        if (e.key === 'Escape') setShowStats(false);
        return;
      }

      // Global Shortcuts
      if (e.key === 'H' && e.shiftKey) { setShowHelp(true); return; }
      if (e.key === '!') {
        setEmergencyMode(p => !p);
        playAlertSound(); // Alert sound for emergency mode
        trackEvent('emergency');
        return;
      }
      if (e.key === 'C' && e.shiftKey) { setIsCliMode(true); return; }

      // Detail View Overlay
      if (viewResource) {
        if (e.key === 'Escape') { setViewResource(null); playBeep(300); }
        if (e.key === 'f' || e.key === 'F') toggleFavorite(viewResource.id);
        return;
      }

      // VIEW: INTRO / PURPOSE
      if (view === 'INTRO' && e.key === 'Enter') setView('PURPOSE');
      if (view === 'PURPOSE' && e.key === 'Enter') setView('CONSOLE');

      // VIEW: CONSOLE
      if (view === 'CONSOLE') {
        // Tab - Switch Focus
        if (e.key === 'Tab') {
          e.preventDefault();
          setFocusArea(prev => prev === 'SIDEBAR' ? 'CONTENT' : 'SIDEBAR');
          playBeep(400);
          return;
        }

        // ← → always change city regardless of focus area
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          const currIdx = cities.indexOf(selectedCity!);
          let nextIdx = e.key === 'ArrowLeft' ? currIdx - 1 : currIdx + 1;
          if (nextIdx < 0) nextIdx = cities.length - 1;
          if (nextIdx >= cities.length) nextIdx = 0;
          setSelectedCity(cities[nextIdx]);
          playNavigationSound();
          return;
        }

        // ↑ ↓ — sidebar category nav when in SIDEBAR focus OR when content is empty
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          if (focusArea === 'SIDEBAR' || filteredResources.length === 0) {
            e.preventDefault();
            const currIdx = types.findIndex(t => t.id === selectedType);
            let nextIdx = e.key === 'ArrowUp' ? currIdx - 1 : currIdx + 1;
            if (nextIdx < 0) nextIdx = types.length - 1;
            if (nextIdx >= types.length) nextIdx = 0;
            setSelectedType(types[nextIdx].id);
            setFocusArea('SIDEBAR');
            if (!showSavedOnly) setSearchQuery('');
            playNavigationSound();
            return;
          }
          // CONTENT navigation
          if (focusArea === 'CONTENT' && filteredResources.length > 0) {
            e.preventDefault();
            setSelectedIndex(p => {
              const next = e.key === 'ArrowUp'
                ? (p > 0 ? p - 1 : filteredResources.length - 1)
                : (p < filteredResources.length - 1 ? p + 1 : 0);
              // Scroll card into view
              setTimeout(() => {
                cardRefs.current.get(next)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
              }, 0);
              return next;
            });
            playNavigationSound();
            return;
          }
        }

        // Enter — open selected resource
        if (e.key === 'Enter' && focusArea === 'CONTENT') {
          if (filteredResources[selectedIndex]) {
            setViewResource(filteredResources[selectedIndex]);
            playSelectSound();
          }
        }

        // O — toggle Open Now filter
        if ((e.key === 'o' || e.key === 'O') && focusArea === 'CONTENT') {
          setFilterOpenNow(p => !p);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, focusArea, selectedIndex, filteredResources, selectedType, selectedCity, showHelp, viewResource, showSavedOnly]);



  // ---- Components ----

  // HelpOverlay, NotificationBanner → imported from ./components/



  // ---- Renderers ----

  const renderConsole = () => (
    // Fix 8: `console-layout` class enables mobile single-column stacking via CSS
    <div className="console-layout flex h-full w-full gap-6">
      {/* SIDEBAR — `console-sidebar` class collapses on mobile */}
      <div className={`console-sidebar w-1/3 min-w-[260px] h-full card bg-slate-900 flex flex-col ${!mobileSidebarOpen ? 'collapsed' : ''}`}>
        {/* Mobile toggle button — hidden on desktop via CSS */}
        <button
          className="mobile-sidebar-toggle"
          onClick={() => setMobileSidebarOpen(p => !p)}
        >
          <span>☰ Categories</span>
          <span>{mobileSidebarOpen ? '▲' : '▼'}</span>
        </button>
        {/* `sidebar-body` scrolls as one unit so map + buttons are always reachable */}
        <div className="sidebar-body flex flex-col flex-1 overflow-y-auto custom-scrollbar">
        <Sidebar
          selectedType={!showSavedOnly ? selectedType : null}
          onSelect={(t) => { setSelectedType(t); setShowSavedOnly(false); setSearchQuery(''); setFocusArea('SIDEBAR'); }}
          isFocused={focusArea === 'SIDEBAR' && !showSavedOnly}
        />

        {/* Sidebar Footer: Map, Saved, Actions */}
          <div className="p-4 border-t border-gray-800 space-y-3">
            {showMap && (
              <div className="flex justify-center mb-2">
                <AsciiMap resources={filteredResources} selectedId={null} userLocation={{ x: 5, y: 5 }} />
              </div>
            )}

            <button
              onClick={() => setShowSavedOnly(true)}
              className={`w-full py-2 px-4 rounded text-sm font-bold tracking-wide uppercase flex items-center justify-between transition-all ${showSavedOnly ? 'bg-amber-900/40 text-amber-400 ring-1 ring-amber-500' : 'text-gray-300 hover:text-amber-400 hover:bg-amber-900/20'}`}
            >
              <span>★ Saved Items</span>
              <span>{favorites.length}</span>
            </button>

            {/* Volunteer hint */}
            <div
              onClick={() => { setSelectedType('volunteer'); setShowSavedOnly(false); setSearchQuery(''); }}
              style={{ cursor: 'pointer', padding: '8px 12px', border: '1px dashed rgba(251,191,36,0.4)', borderRadius: '8px', background: 'rgba(251,191,36,0.05)' }}
            >
              <div style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 'bold', marginBottom: '2px' }}>🤝 VOLUNTEER</div>
              <div style={{ fontSize: '0.7rem', color: '#9ca3af', lineHeight: '1.4' }}>Click any resource in Volunteers to sign up or generate a message.</div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <button onClick={() => setShowSubmission(true)} className="py-1 px-2 border border-teal-600 text-teal-300 rounded text-[10px] hover:bg-teal-900/30 uppercase font-bold">
                + Add Data
              </button>
              <button onClick={clearAllData} className="py-1 px-2 border border-red-700 text-red-400 rounded text-[10px] hover:bg-red-900/30 uppercase font-bold">
                Reset App
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={() => {
                  const backup = exportBackup();
                  if (backup) {
                    navigator.clipboard.writeText(backup).then(() => {
                      showNotification('> Backup code copied to clipboard!');
                      playSuccessSound();
                    }).catch(() => showNotification('Copy failed.'));
                  } else {
                    showNotification('Backup failed.');
                  }
                }}
                className="py-1 px-2 border border-amber-600 text-amber-300 rounded text-[10px] hover:bg-amber-900/30 uppercase font-bold"
                title="Copy configuration backup code to clipboard"
              >
                💾 Export
              </button>
              <button
                onClick={() => {
                  const backup = prompt('Paste your backup configuration code:');
                  if (backup) {
                    const success = importBackup(backup);
                    if (success) {
                      showNotification('> Configuration imported successfully!');
                      playSuccessSound();
                      setTimeout(() => window.location.reload(), 1000);
                    } else {
                      showNotification('Error: Invalid backup configuration.');
                      playErrorSound();
                    }
                  }
                }}
                className="py-1 px-2 border border-indigo-600 text-indigo-300 rounded text-[10px] hover:bg-indigo-900/30 uppercase font-bold"
                title="Paste a configuration backup code"
              >
                📂 Import
              </button>
            </div>
            {/* Fix 9: Demo resource toggle */}
            <button
              onClick={() => setShowDemoResources(p => !p)}
              className={`w-full mt-2 py-1 px-2 rounded text-[10px] uppercase border font-bold transition-colors ${
                showDemoResources
                  ? 'border-purple-600 text-purple-300 bg-purple-900/20'
                  : 'border-gray-600 text-gray-300 hover:text-white hover:border-gray-400'
              }`}
            >
              {showDemoResources ? '◉ Demo Data ON' : '○ Show Demo Data'}
            </button>
          </div>
        {/* End sidebar-body */}
        </div>
      </div>

      {/* MAIN CONTENT — `console-content` class ensures full width on mobile */}
      <div className={`console-content flex-1 h-full flex flex-col relative card p-0 ${focusArea === 'CONTENT' ? 'border-teal-400' : 'border-slate-700'}`}>

        {/* Header - Filters */}
        {/* Fix 8: `filter-header` prevents overflow; `filter-row` wraps on mobile */}
        <div className="filter-header flex flex-col p-4 border-b border-gray-800 bg-slate-800/30 gap-4">
          {/* Row 1: City & Search */}
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <span className="text-gray-300 font-bold text-xs uppercase tracking-wider">Region</span>
                <div className="flex items-center gap-1" style={{ position: 'relative', zIndex: 5 }}>
                  <button
                    aria-label="Previous city"
                    onClick={() => {
                      const idx = cities.indexOf(selectedCity);
                      const prev = idx <= 0 ? cities.length - 1 : idx - 1;
                      setSelectedCity(cities[prev]);
                      playNavigationSound();
                    }}
                    style={{
                      cursor: 'pointer',
                      color: '#06d6a0',
                      background: 'rgba(26, 31, 53, 0.8)',
                      border: '1px solid rgba(6, 214, 160, 0.4)',
                      borderRadius: '4px',
                      padding: '4px 10px',
                      fontFamily: 'inherit',
                      fontWeight: 'bold',
                      fontSize: '1rem',
                      position: 'relative',
                      zIndex: 5,
                      userSelect: 'none',
                      transition: 'color 0.2s, border-color 0.2s, background 0.2s',
                    }}
                    title="Previous city (← arrow key)"
                  >{'<'}</button>
                  <button
                    aria-label="Current city, click to cycle"
                    onClick={() => {
                      const idx = cities.indexOf(selectedCity);
                      const next = idx >= cities.length - 1 ? 0 : idx + 1;
                      setSelectedCity(cities[next]);
                      playNavigationSound();
                    }}
                    style={{
                      cursor: 'pointer',
                      color: '#ffffff',
                      background: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid rgba(6, 214, 160, 0.35)',
                      borderRadius: '4px',
                      padding: '4px 16px',
                      fontFamily: 'inherit',
                      fontWeight: 'bold',
                      fontSize: '1rem',
                      minWidth: '120px',
                      textAlign: 'center',
                      position: 'relative',
                      zIndex: 5,
                      userSelect: 'none',
                      transition: 'border-color 0.2s, background 0.2s',
                    }}
                    title="Click to cycle city"
                  >{selectedCity}</button>
                  <button
                    aria-label="Next city"
                    onClick={() => {
                      const idx = cities.indexOf(selectedCity);
                      const next = idx >= cities.length - 1 ? 0 : idx + 1;
                      setSelectedCity(cities[next]);
                      playNavigationSound();
                    }}
                    style={{
                      cursor: 'pointer',
                      color: '#06d6a0',
                      background: 'rgba(26, 31, 53, 0.8)',
                      border: '1px solid rgba(6, 214, 160, 0.4)',
                      borderRadius: '4px',
                      padding: '4px 10px',
                      fontFamily: 'inherit',
                      fontWeight: 'bold',
                      fontSize: '1rem',
                      position: 'relative',
                      zIndex: 5,
                      userSelect: 'none',
                      transition: 'color 0.2s, border-color 0.2s, background 0.2s',
                    }}
                    title="Next city (→ arrow key)"
                  >{'>'}</button>
                </div>
            </div>

            <div className="flex-1">
              <input
                type="text"
                placeholder="Search resources..."
                className="w-full bg-slate-900 border border-slate-700 rounded px-4 py-2 text-sm text-teal-300 focus:outline-none focus:border-teal-500 font-mono placeholder-gray-600"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.length > 2) trackEvent('searches');
                  playTypeSound(); // Typing sound for retro feel
                }}
              />
            </div>
          </div>

          {/* Row 2: Toggles — `filter-row` wraps on mobile */}
          <div className="filter-row flex flex-wrap gap-4 items-center text-xs">
            <button onClick={() => setFilterOpenNow(p => !p)} className={`px-3 py-1.5 rounded border font-bold transition-colors ${filterOpenNow ? 'bg-green-900/30 border-green-500 text-green-300' : 'border-gray-600 text-gray-300 hover:border-teal-600 hover:text-teal-300'}`}>
              {filterOpenNow ? '◉ OPEN NOW' : '○ OPEN NOW'}
            </button>

            <div className="h-4 w-px bg-gray-700"></div>

            <div className="flex items-center gap-2">
              <span className="text-gray-300 uppercase font-bold tracking-wider">Lang:</span>
              <select
                value={filterLanguage}
                onChange={(e) => setFilterLanguage(e.target.value)}
                className="bg-slate-900 border border-slate-600 text-gray-200 rounded px-2 py-1 outline-none focus:border-teal-500"
              >
                {availableLanguages.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div className="h-4 w-px bg-gray-700"></div>

            <div className="flex items-center gap-2">
              <span className="text-gray-300 uppercase font-bold tracking-wider">Transport:</span>
              <div className="flex border border-slate-700 rounded overflow-hidden">
                {(['walking', 'bus', 'car'] as TransportMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setTransportMode(m)}
                    className={`px-3 py-1 transition-colors ${transportMode === m ? 'bg-slate-600 text-white' : 'hover:bg-slate-700 text-gray-300'}`}
                  >
                    {m === 'walking' && '🚶'} {m === 'bus' && '🚌'} {m === 'car' && '🚗'}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-4 w-px bg-gray-700"></div>

            <div className="flex gap-2">
              <button onClick={() => { setEmergencyMode(p => !p); if (!emergencyMode) trackEvent('emergency'); }} className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${emergencyMode ? 'bg-red-600 text-white animate-pulse' : 'bg-red-900/30 text-red-500 border border-red-900'}`}>
                {emergencyMode ? '! ACTIVE' : '! SOS'}
              </button>
              <button onClick={() => setShowMap(p => !p)} className={`px-3 py-1.5 rounded text-xs border font-bold transition-colors ${showMap ? 'bg-teal-900/30 border-teal-500 text-teal-300' : 'border-gray-600 text-gray-300 hover:border-teal-600 hover:text-teal-300'}`}>
                MAP
              </button>
              <button onClick={() => setShowStats(true)} className="px-2 py-0.5 rounded text-[10px] border border-gray-600 text-gray-300 font-bold hover:text-white hover:border-gray-400">
                STATS
              </button>
              <button onClick={() => setIsCliMode(true)} className="px-2 py-0.5 rounded text-[10px] border border-gray-600 text-gray-300 font-bold hover:text-white hover:border-gray-400">
                CLI
              </button>
              <button
                onClick={() => setIsDarkMode(p => !p)}
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                className="px-2 py-0.5 rounded text-[10px] border border-gray-600 text-gray-300 font-bold hover:text-white hover:border-gray-400"
              >
                {isDarkMode ? '☀️' : '🌙'}
              </button>
              <button
                onClick={printEmergencySheet}
                title="Print top-5 emergency resource sheet"
                className="px-2 py-0.5 rounded text-[10px] border border-teal-700 text-teal-400 font-bold hover:bg-teal-900/30"
              >
                ⎙ PRINT
              </button>
            </div>
          </div>
        </div>

        {/* Results List — extracted to ResourceList component */}
        <div className="flex-1 overflow-auto p-4 space-y-2 bg-slate-900/50">
          <ResourceList
            filteredResources={filteredResources}
            selectedIndex={selectedIndex}
            setSelectedIndex={setSelectedIndex}
            focusArea={focusArea}
            setFocusArea={setFocusArea}
            transportMode={transportMode}
            cardRefs={cardRefs}
            onSelectResource={(r, i) => {
              setSelectedIndex(i);
              setFocusArea('CONTENT');
              setViewResource(r);
              trackEvent('views');
            }}
          />
        </div>
      </div>
    </div >
  );

  const renderIntro = () => (
    <div className="boot-screen">
      <div className="center-card narrative-box">
        <Typewriter
          lines={[
            "> Initializing SOS: System of Support...",
            "> Internet unavailable.",
            "> You are in a new city.",
            "> You need help.",
            "> Access help. Anywhere. Anytime."
          ]}
          speed={40}
          onComplete={() => setShowIntroContinue(true)}
        />

        {showIntroContinue && (
          <div className="boot-hint">
            Press [Enter] to Continue
          </div>
        )}
      </div>
    </div>
  );


  const renderPurpose = () => (
    <div className="purpose-container">
      <div className="purpose-card">
        <div>
          <h1 className="purpose-title">SOS: SYSTEM OF SUPPORT</h1>
          <p className="purpose-subtitle">Access help. Anywhere. Anytime.</p>
          <p className="purpose-desc">Offline-First Emergency Response System</p>
        </div>

        <div className="purpose-list">
          <span className="purpose-pill">FOOD</span>
          <span className="purpose-pill">SHELTER</span>
          <span className="purpose-pill">POLICE</span>
          <span className="purpose-pill">HOSPITAL</span>
        </div>

        <div className="purpose-footer">
          <p>No internet required. Data is locally cached.</p>
        </div>
      </div>

      <div className="press-enter-hint">
        PRESS [ENTER] TO ACCESS TERMINAL
      </div>
    </div>
  );


  // renderDetail extracted → now <ResourceDetail /> component



  if (view === 'INTRO') {
    return renderIntro();
  }

  if (view === 'PURPOSE') {
    return (
      <TerminalLayout header="SYSTEM BOOT">
        {renderPurpose()}
      </TerminalLayout>
    );
  }

  return (
    <TerminalLayout header={emergencyMode ? 'EMERGENCY MODE' : 'RESOURCE HUB'}>
      {swUpdateAvailable && (
        <div style={{
          backgroundColor: '#0284c7', color: '#fff', textAlign: 'center',
          padding: '8px 16px', borderBottom: '2px solid #38bdf8', fontSize: '0.85rem',
          fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px',
        }} className="select-none blink">
          <span>🖲️ SYSTEM UPDATE DETECTED: CRF-OS SHELL UPGRADED</span>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#fff', color: '#0284c7', border: 'none', borderRadius: '4px',
              padding: '2px 8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem'
            }}
          >
            ACTIVATE
          </button>
        </div>
      )}
      <NotificationBanner message={notification} />
      {showHelp && <HelpOverlay />}
      {showStats && <StatsDashboard onClose={() => setShowStats(false)} />}
      {isCliMode && (
        <CliMode
          onExit={() => setIsCliMode(false)}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          exportBackup={exportBackup}
          importBackup={importBackup}
        />
      )}
      {showSubmission && <ResourceSubmission onClose={() => setShowSubmission(false)} onSubmit={handleAddResource} />}

      {!viewResource && !isCliMode && renderConsole()}
      {viewResource && !isCliMode && (
        <ResourceDetail
          resource={viewResource}
          isFav={favorites.includes(viewResource.id)}
          emergencyMode={emergencyMode}
          onBack={() => { setViewResource(null); setFocusArea('CONTENT'); }}
          onToggleFavorite={toggleFavorite}
          onShare={shareResource}
          onReport={reportIssue}
          showNotification={showNotification}
        />
      )}

      {hasConsented === null && <ConsentDialog onConsent={handleConsent} />}
    </TerminalLayout>
  );

}
// OfflineFooter and EmergencyBanner are inline in ResourceDetail.tsx

export default App;
