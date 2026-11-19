import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { useTheme } from '../context/ThemeContext';
import type { UnifiedSearchResponse } from '../types/dashboard.types';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface TopHeaderProps {
  onToggleSidebar: () => void;
  breadcrumbs: BreadcrumbItem[];
  healthStatus: string;
  onSearchSelectCase?: (caseId: string) => void;
  onSearchSelectIncident?: (incidentId: string) => void;
  onSearchSelectEvidence?: (evidenceId: string) => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  onToggleSidebar,
  breadcrumbs,
  healthStatus,
  onSearchSelectCase,
  onSearchSelectIncident,
  onSearchSelectEvidence,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UnifiedSearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await api.search(searchQuery.trim(), 5);
        setSearchResults(res);
        setShowDropdown(true);
      } catch (err) {
        console.error('Unified search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-14 bg-white/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between gap-4 sticky top-0 z-30 backdrop-blur-md transition-colors">
      {/* Left: Mobile hamburger & Breadcrumbs */}
      <div className="flex items-center gap-3 overflow-hidden">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="md:hidden text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          aria-label="Open sidebar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {/* Breadcrumb Trail */}
        <nav className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 overflow-hidden" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, idx) => {
            const isLast = idx === breadcrumbs.length - 1;
            return (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-slate-400 dark:text-slate-600 select-none">/</span>}
                {isLast || !crumb.onClick ? (
                  <span className={`truncate max-w-[200px] ${isLast ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
                    {crumb.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={crumb.onClick}
                    className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer truncate max-w-[150px] focus:outline-none focus:underline"
                  >
                    {crumb.label}
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Right: Search Input, Theme Toggle, & System Status */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Global Search Bar */}
        <div ref={searchRef} className="relative hidden sm:block w-64 lg:w-80">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchResults) setShowDropdown(true);
              }}
              placeholder="Search cases, incidents, hashes..."
              className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
            <svg
              className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {isSearching && (
              <div className="absolute right-2.5 top-2.5">
                <div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showDropdown && searchResults && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-2 z-50 space-y-2 text-xs max-h-80 overflow-y-auto">
              {searchResults.cases.length === 0 &&
              searchResults.incidents.length === 0 &&
              searchResults.evidence.length === 0 ? (
                <div className="py-3 text-center text-slate-500 dark:text-slate-400 text-xs">No records found matching query</div>
              ) : (
                <>
                  {searchResults.cases.length > 0 && (
                    <div>
                      <span className="text-[10px] font-mono uppercase text-indigo-600 dark:text-indigo-400 font-bold px-2 block">Cases</span>
                      {searchResults.cases.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setShowDropdown(false);
                            setSearchQuery('');
                            if (onSearchSelectCase) onSearchSelectCase(c.id);
                          }}
                          className="w-full text-left p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs flex items-center justify-between cursor-pointer"
                        >
                          <span className="font-mono text-indigo-600 dark:text-indigo-300 font-medium">{c.caseNumber}</span>
                          <span className="truncate ml-2 text-slate-500 dark:text-slate-400">{c.title}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchResults.incidents.length > 0 && (
                    <div>
                      <span className="text-[10px] font-mono uppercase text-amber-600 dark:text-amber-400 font-bold px-2 block">Incidents</span>
                      {searchResults.incidents.map((inc) => (
                        <button
                          key={inc.id}
                          type="button"
                          onClick={() => {
                            setShowDropdown(false);
                            setSearchQuery('');
                            if (onSearchSelectIncident) onSearchSelectIncident(inc.id);
                          }}
                          className="w-full text-left p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs flex items-center justify-between cursor-pointer"
                        >
                          <span className="font-mono text-amber-600 dark:text-amber-300 font-medium">{inc.incidentNumber}</span>
                          <span className="truncate ml-2 text-slate-500 dark:text-slate-400">{inc.title}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchResults.evidence.length > 0 && (
                    <div>
                      <span className="text-[10px] font-mono uppercase text-emerald-600 dark:text-emerald-400 font-bold px-2 block">Evidence</span>
                      {searchResults.evidence.map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => {
                            setShowDropdown(false);
                            setSearchQuery('');
                            if (onSearchSelectEvidence) onSearchSelectEvidence(ev.id);
                          }}
                          className="w-full text-left p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs flex items-center justify-between cursor-pointer"
                        >
                          <span className="font-mono text-emerald-600 dark:text-emerald-300 font-medium">{ev.evidenceNumber}</span>
                          <span className="truncate ml-2 text-slate-500 dark:text-slate-400">{ev.originalFilename}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Accessible Sun/Moon Theme Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            /* Sun Icon */
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3v1m0 16v1m9-9h-1M4 9h-1m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          ) : (
            /* Moon Icon */
            <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
              />
            </svg>
          )}
        </button>

        {/* Database Status Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700/80 text-[11px] font-mono text-slate-700 dark:text-slate-300 transition-colors">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              healthStatus === 'ok' ? 'bg-emerald-500 dark:bg-emerald-400 shadow-sm shadow-emerald-400/80' : 'bg-rose-500 dark:bg-rose-400 animate-pulse'
            }`}
          />
          <span className="hidden md:inline">PostgreSQL: 5433</span>
        </div>
      </div>
    </header>
  );
};
