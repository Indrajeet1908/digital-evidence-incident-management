import React, { useState, useEffect, useRef } from 'react';
import type { UnifiedSearchResponse } from '../types/dashboard.types';
import { api } from '../services/api';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  onSelectCase: (caseId: string) => void;
  userRole?: string;
  userName?: string;
  healthStatus: string;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onSelectCase,
  userRole = 'INVESTIGATOR',
  userName = 'Investigator',
  healthStatus,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UnifiedSearchResponse | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setIsDropdownOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await api.search(searchQuery.trim(), 5);
        setSearchResults(results);
        setIsDropdownOpen(true);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'incidents', label: 'Incident Intelligence' },
    { id: 'evidence', label: 'Evidence Intelligence' },
    { id: 'ai', label: 'AI Insights' },
    { id: 'activity', label: 'Activity Timeline' },
    { id: 'reports', label: 'Reports' },
    { id: 'alerts', label: 'Health Alerts' },
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onSelectTab('overview')}>
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <span className="text-white font-bold text-lg tracking-tight">DEP Intelligence</span>
              <span className="hidden sm:inline-block ml-2 text-xs uppercase px-2 py-0.5 bg-indigo-950 text-indigo-400 border border-indigo-800 rounded font-semibold">
                Milestone 10
              </span>
            </div>
          </div>

          {/* Unified Search Input */}
          <div className="flex-1 max-w-md mx-4 relative" ref={searchRef}>
            <div className="relative">
              <input
                type="text"
                placeholder="Search cases, incidents, evidence..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (searchResults) setIsDropdownOpen(true);
                }}
                className="w-full bg-slate-800/80 border border-slate-700 rounded-lg pl-10 pr-4 py-1.5 text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {isSearching && (
                <div className="absolute right-3 top-2.5">
                  <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Search Dropdown */}
            {isDropdownOpen && searchResults && (
              <div className="absolute left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 max-h-96 overflow-y-auto">
                {/* Cases */}
                {searchResults.cases.length > 0 && (
                  <div className="p-2 border-b border-slate-700/60">
                    <div className="text-xs font-semibold text-slate-400 uppercase px-2 py-1">Cases</div>
                    {searchResults.cases.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          onSelectCase(c.id);
                          setIsDropdownOpen(false);
                          setSearchQuery('');
                        }}
                        className="w-full text-left px-2 py-1.5 hover:bg-slate-700/50 rounded flex items-center justify-between text-xs text-slate-200"
                      >
                        <span className="font-mono text-indigo-400">{c.caseNumber}</span>
                        <span className="truncate max-w-[180px]">{c.title}</span>
                        <span className="text-[10px] text-slate-400 uppercase">{c.status}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Incidents */}
                {searchResults.incidents.length > 0 && (
                  <div className="p-2 border-b border-slate-700/60">
                    <div className="text-xs font-semibold text-slate-400 uppercase px-2 py-1">Incidents</div>
                    {searchResults.incidents.map((inc) => (
                      <button
                        key={inc.id}
                        onClick={() => {
                          onSelectTab('incidents');
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-left px-2 py-1.5 hover:bg-slate-700/50 rounded flex items-center justify-between text-xs text-slate-200"
                      >
                        <span className="font-mono text-amber-400">{inc.incidentNumber}</span>
                        <span className="truncate max-w-[180px]">{inc.title}</span>
                        <span className="text-[10px] text-slate-400">{inc.caseNumber}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Evidence */}
                {searchResults.evidence.length > 0 && (
                  <div className="p-2">
                    <div className="text-xs font-semibold text-slate-400 uppercase px-2 py-1">Evidence</div>
                    {searchResults.evidence.map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => {
                          onSelectTab('evidence');
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-left px-2 py-1.5 hover:bg-slate-700/50 rounded flex items-center justify-between text-xs text-slate-200"
                      >
                        <span className="font-mono text-emerald-400">{ev.evidenceNumber}</span>
                        <span className="truncate max-w-[180px]">{ev.originalFilename}</span>
                        <span className="text-[10px] text-slate-400">{ev.evidenceType}</span>
                      </button>
                    ))}
                  </div>
                )}

                {searchResults.cases.length === 0 &&
                  searchResults.incidents.length === 0 &&
                  searchResults.evidence.length === 0 && (
                    <div className="p-4 text-center text-xs text-slate-400">No matching records found</div>
                  )}
              </div>
            )}
          </div>

          {/* Right Status & Role Info */}
          <div className="flex items-center gap-3">
            {/* API Health */}
            <div className="hidden md:flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700 text-xs">
              <span className={`w-2 h-2 rounded-full ${healthStatus === 'ok' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className="text-slate-400">DB:</span>
              <span className="text-slate-200 font-medium">{healthStatus === 'ok' ? 'Connected' : 'Offline'}</span>
            </div>

            {/* Role Badge */}
            <div className="flex items-center gap-2 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
              <div className="w-2 h-2 rounded-full bg-indigo-400" />
              <div className="text-left">
                <div className="text-xs font-semibold text-slate-200 leading-tight">{userName}</div>
                <div className="text-[10px] font-mono text-indigo-400 uppercase leading-none">{userRole}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex space-x-1 overflow-x-auto pb-2 border-t border-slate-800/80 pt-2">
          {tabs.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
