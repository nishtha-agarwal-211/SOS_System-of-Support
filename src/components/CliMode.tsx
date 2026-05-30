import React, { useState, useEffect, useRef, useMemo } from 'react';
import { resources, cities } from '../data/resources';
import { useSound } from '../hooks/useSound';

interface CliModeProps {
    onExit: () => void;
    isDarkMode?: boolean;
    setIsDarkMode?: (val: boolean) => void;
    exportBackup?: () => string;
    importBackup?: (backup: string) => boolean;
}

const COMMANDS = ['help', 'search', 'list', 'stats', 'theme', 'export', 'import', 'clear', 'exit'];

export const CliMode = ({
    onExit,
    isDarkMode,
    setIsDarkMode,
    exportBackup,
    importBackup
}: CliModeProps) => {
    const [input, setInput] = useState('');
    const [history, setHistory] = useState<string[]>([
        'SOS: SUPPORT CORE TERMINAL v1.1.0',
        'Secure terminal connection initialized.',
        'Type "help" for a list of valid commands.',
    ]);
    
    // Command History Buffer
    const [commandHistory, setCommandHistory] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('crf_cli_history') || '[]');
        } catch {
            return [];
        }
    });
    const [historyPointer, setHistoryPointer] = useState(-1);
    
    const { playSuccessSound, playErrorSound, playNavigationSound, playTypeSound } = useSound();
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom of command history
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    // Keep command history synchronized in local storage
    const pushToCommandHistory = (cmd: string) => {
        const updated = [cmd, ...commandHistory.filter(c => c !== cmd)].slice(0, 50); // unique, max 50 items
        setCommandHistory(updated);
        localStorage.setItem('crf_cli_history', JSON.stringify(updated));
    };

    // Calculate suggestions based on current input first word
    const firstWord = input.trim().split(' ')[0] || '';
    const suggestions = useMemo(() => {
        if (!firstWord) return [];
        return COMMANDS.filter(cmd => cmd.startsWith(firstWord.toLowerCase()) && cmd !== firstWord.toLowerCase());
    }, [firstWord]);

    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Tab Autocomplete
        if (e.key === 'Tab') {
            e.preventDefault();
            if (suggestions.length > 0) {
                const parts = input.trim().split(' ');
                const clampedIdx = activeSuggestionIndex % suggestions.length;
                parts[0] = suggestions[clampedIdx];
                setInput(parts.join(' ') + ' ');
                playNavigationSound();
                // Cycle through matching suggestions
                setActiveSuggestionIndex(prev => (prev + 1) % suggestions.length);
            }
            return;
        }

        // Command History Navigation (Arrow Up / Down)
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (commandHistory.length > 0) {
                const nextPointer = historyPointer + 1;
                if (nextPointer < commandHistory.length) {
                    setHistoryPointer(nextPointer);
                    setInput(commandHistory[nextPointer]);
                    playNavigationSound();
                }
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextPointer = historyPointer - 1;
            if (nextPointer >= 0) {
                setHistoryPointer(nextPointer);
                setInput(commandHistory[nextPointer]);
                playNavigationSound();
            } else {
                setHistoryPointer(-1);
                setInput('');
            }
            return;
        }

        // Standard Key Press Beep
        if (e.key !== 'Enter' && e.key.length === 1) {
            playTypeSound();
        }
    };

    const handleCommandSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const cmd = input.trim();
            if (!cmd) return;

            pushToCommandHistory(cmd);
            setHistoryPointer(-1);

            const newHistory = [...history, `> ${cmd}`];
            const parts = cmd.split(' ');
            const action = parts[0].toLowerCase();
            const arg = parts.slice(1).join(' ');

            switch (action) {
                case 'help':
                    playSuccessSound();
                    newHistory.push(
                        'AVAILABLE SYSTEM COMMANDS:',
                        '  search [term]     - Full text resource search',
                        '  list [city]       - List top resources in specified city',
                        '  stats             - Display local database telemetry metrics',
                        '  theme [light|dark]- Set terminal color spectrum theme',
                        '  export            - Export configurations as encoded base64 block',
                        '  import [string]   - Import/restore configuration backups',
                        '  clear             - Flush terminal log history buffer',
                        '  exit              - Terminate terminal and resume interface'
                    );
                    break;

                case 'clear':
                    playSuccessSound();
                    setHistory([]);
                    setInput('');
                    return;

                case 'exit':
                    playSuccessSound();
                    onExit();
                    return;

                case 'stats': {
                    playSuccessSound();
                    try {
                        const s = JSON.parse(localStorage.getItem('crf_analytics') || '{"searches":0,"views":0,"favorites":0,"emergency":0}');
                        newHistory.push(
                            'SYSTEM METRICS INTEGRITY REPORT:',
                            `  - Search Queries:       ${s.searches}`,
                            `  - Resources Viewed:     ${s.views}`,
                            `  - Favorites Saved:      ${s.favorites}`,
                            `  - Emergency Triggers:   ${s.emergency}`,
                            `  Total Event Transactions: ${s.searches + s.views + s.favorites + s.emergency}`
                        );
                    } catch {
                        newHistory.push('Error parsing local storage telemetry report.');
                    }
                    break;
                }

                case 'theme': {
                    const themeArg = arg.toLowerCase().trim();
                    if (themeArg === 'light' || themeArg === 'dark') {
                        if (setIsDarkMode) {
                            setIsDarkMode(themeArg === 'dark');
                            playSuccessSound();
                            newHistory.push(`Success: Theme configuration set to [${themeArg.toUpperCase()}].`);
                        } else {
                            newHistory.push('Error: Theme dispatcher service is offline.');
                        }
                    } else {
                        // Toggle theme
                        if (setIsDarkMode && isDarkMode !== undefined) {
                            const newMode = !isDarkMode;
                            setIsDarkMode(newMode);
                            playSuccessSound();
                            newHistory.push(`Success: Theme toggled to [${newMode ? 'DARK' : 'LIGHT'}].`);
                        } else {
                            newHistory.push('Usage: theme [light|dark]');
                        }
                    }
                    break;
                }

                case 'export': {
                    if (exportBackup) {
                        const backupStr = exportBackup();
                        if (backupStr) {
                            navigator.clipboard.writeText(backupStr).then(() => {
                                playSuccessSound();
                            }).catch(() => {});
                            newHistory.push(
                                'Success: Configurations serialized to Base64.',
                                'Backup configuration copied to system clipboard.',
                                `Data block: ${backupStr.substring(0, 45)}...`
                            );
                        } else {
                            playErrorSound();
                            newHistory.push('Error: Failed to encode backup configuration.');
                        }
                    } else {
                        playErrorSound();
                        newHistory.push('Error: Backup encoding service offline.');
                    }
                    break;
                }

                case 'import': {
                    if (!arg) {
                        playErrorSound();
                        newHistory.push('Usage: import [base64_backup_string]');
                    } else if (importBackup) {
                        const success = importBackup(arg);
                        if (success) {
                            playSuccessSound();
                            newHistory.push('Success: Local storage state fully restored.');
                        } else {
                            playErrorSound();
                            newHistory.push('Error: Configuration decryption failure. Invalid base64 block.');
                        }
                    } else {
                        playErrorSound();
                        newHistory.push('Error: Configuration import service offline.');
                    }
                    break;
                }

                case 'search': {
                    if (!arg) {
                        playErrorSound();
                        newHistory.push('Error: Provide search query argument.');
                    } else {
                        const query = arg.toLowerCase();
                        const matches = resources.filter(r =>
                            r.name.toLowerCase().includes(query) ||
                            r.type.toLowerCase().includes(query) ||
                            r.services.join(' ').toLowerCase().includes(query)
                        );
                        if (matches.length === 0) {
                            playErrorSound();
                            newHistory.push(`No resources match query term: "${arg}"`);
                        } else {
                            playSuccessSound();
                            newHistory.push(`Discovered ${matches.length} matching resources:`);
                            matches.slice(0, 6).forEach(m => newHistory.push(`  › [${m.type.toUpperCase()}] ${m.name} (${m.phone})`));
                            if (matches.length > 6) {
                                newHistory.push(`  ...and ${matches.length - 6} additional resources available in graphical layout.`);
                            }
                        }
                    }
                    break;
                }

                case 'list': {
                    const cityArg = arg.toLowerCase().trim();
                    const validCities = cities.map(c => c.toLowerCase());
                    if (cityArg && validCities.includes(cityArg)) {
                        const items = resources.filter(r => r.city.toLowerCase() === cityArg);
                        playSuccessSound();
                        newHistory.push(`Top resources in ${cityArg.toUpperCase()}:`);
                        items.slice(0, 6).forEach(m => newHistory.push(`  › [${m.type.toUpperCase()}] ${m.name} — ${m.hours}`));
                    } else {
                        playErrorSound();
                        newHistory.push(`Usage: list [${cities.join('|').toLowerCase()}]`);
                    }
                    break;
                }

                default:
                    playErrorSound();
                    newHistory.push(`Unknown command: "${action}". Type "help" for assistance.`);
            }

            setHistory(newHistory);
            setInput('');
        }
    };

    return (
        <div className="absolute inset-0 z-50 bg-black font-mono text-green-500 p-6 flex flex-col text-lg overflow-hidden select-text">
            {/* Header branding */}
            <div className="border-b border-green-900 pb-2 mb-4 flex justify-between text-xs text-green-600 select-none">
                <span>SECURE INTERACTION DIALOGUE</span>
                <span className="blink">● LOCAL_LINK_SECURE</span>
            </div>

            {/* Logs console */}
            <div className="flex-1 overflow-auto space-y-1 custom-scrollbar">
                {history.map((line, i) => (
                    <div key={i} className="whitespace-pre-wrap leading-relaxed">{line}</div>
                ))}
                <div ref={bottomRef}></div>
            </div>

            {/* Suggestions view */}
            {suggestions.length > 0 && (
                <div className="text-[12px] text-teal-600 mb-1 flex gap-2 select-none">
                    <span className="opacity-50">Suggestion match:</span>
                    {suggestions.map((s, idx) => (
                        <span key={s} className={idx === activeSuggestionIndex % suggestions.length ? 'text-amber-400 font-bold underline' : 'opacity-80'}>
                            {s}
                        </span>
                    ))}
                    <span className="text-[10px] opacity-40 ml-auto">[Tab to cycle]</span>
                </div>
            )}

            {/* Terminal prompt input row */}
            <div className="flex items-center gap-2 mt-4 border-t border-green-900 pt-2">
                <span className="text-amber-500 font-bold select-none">$</span>
                <input
                    autoFocus
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onKeyDownCapture={(e) => {
                        if (e.key === 'Enter') handleCommandSubmit(e);
                    }}
                    className="flex-1 bg-transparent border-none outline-none text-green-100 placeholder-green-900 font-mono"
                    placeholder="Enter command (e.g. help)..."
                />
            </div>
        </div>
    );
};
