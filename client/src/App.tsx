import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { ToastProvider, useToast } from './components/Toast';
import { StatCards } from './components/StatCards';
import { InvestigationAlerts } from './components/InvestigationAlerts';
import { ActivityTimeline } from './components/ActivityTimeline';
import { IncidentIntelligenceTable } from './components/IncidentIntelligenceTable';
import { EvidenceIntelligenceTable } from './components/EvidenceIntelligenceTable';
import { AIInsightsSection } from './components/AIInsightsSection';
import { CasesListView } from './components/CasesListView';
import { CaseInvestigationView } from './components/CaseInvestigationView';
import { IncidentsListView } from './components/IncidentsListView';
import { IncidentDetailWorkspace } from './components/IncidentDetailWorkspace';
import { EvidenceListView } from './components/EvidenceListView';
import { EvidenceDetailView } from './components/EvidenceDetailView';
import { ReportCenter } from './components/ReportCenter';
import { SystemHealthView } from './components/SystemHealthView';
import { AdminOverviewView } from './components/AdminOverviewView';
import { CreateCaseModal } from './components/CreateCaseModal';
import { CreateIncidentModal } from './components/CreateIncidentModal';
import { EvidenceUploadModal } from './components/EvidenceUploadModal';

import { ThemeProvider } from './context/ThemeContext';
import { api, getStoredToken, clearStoredToken } from './services/api';
import type { InvestigationOverviewResponse, InvestigationAlertItem } from './types/dashboard.types';

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <MainApp />
      </ToastProvider>
    </ThemeProvider>
  );
}

function MainApp() {
  const toast = useToast();
  const [healthStatus, setHealthStatus] = useState<string>('checking...');
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string | { name: string };
  } | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  // Auth Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper to parse navigation state from URL query parameters
  const parseUrlState = () => {
    if (typeof window === 'undefined') {
      return { tab: 'dashboard', caseId: null, incidentId: null, evidenceId: null };
    }
    const params = new URLSearchParams(window.location.search);
    const evidenceId = params.get('evidence') || null;
    const incidentId = params.get('incident') || null;
    const caseId = params.get('case') || null;
    const tabParam = params.get('tab') || 'dashboard';

    let tab = tabParam;
    if (evidenceId) tab = 'evidence';
    else if (incidentId) tab = 'incidents';
    else if (caseId) tab = 'cases';

    return { tab, caseId, incidentId, evidenceId };
  };

  // Helper to sync current navigation state into browser URL without full reloads
  const syncUrl = (
    tab: string,
    caseId: string | null,
    incidentId: string | null,
    evidenceId: string | null,
    replace = false
  ) => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    if (evidenceId) {
      params.set('evidence', evidenceId);
      if (caseId) params.set('case', caseId);
      if (incidentId) params.set('incident', incidentId);
    } else if (incidentId) {
      params.set('incident', incidentId);
      if (caseId) params.set('case', caseId);
    } else if (caseId) {
      params.set('case', caseId);
    } else if (tab && tab !== 'dashboard') {
      params.set('tab', tab);
    }

    const query = params.toString();
    const newUrl = query ? `?${query}` : window.location.pathname;
    const currentUrl = window.location.search ? `?${window.location.search.replace(/^\?/, '')}` : window.location.pathname;

    if (newUrl !== currentUrl) {
      if (replace) {
        window.history.replaceState({ tab, caseId, incidentId, evidenceId }, '', newUrl);
      } else {
        window.history.pushState({ tab, caseId, incidentId, evidenceId }, '', newUrl);
      }
    }
  };

  // Navigation State initialized from URL query parameters
  const initialNav = parseUrlState();
  const [activeTab, setActiveTab] = useState<string>(initialNav.tab);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(initialNav.caseId);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(initialNav.incidentId);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(initialNav.evidenceId);

  // Global Modals State
  const [isCreateCaseOpen, setIsCreateCaseOpen] = useState(false);
  const [isCreateIncidentOpen, setIsCreateIncidentOpen] = useState(false);
  const [isUploadEvidenceOpen, setIsUploadEvidenceOpen] = useState(false);
  const [modalDefaultCaseId, setModalDefaultCaseId] = useState<string | undefined>(undefined);
  const [modalDefaultIncidentId, setModalDefaultIncidentId] = useState<string | undefined>(undefined);

  // Dashboard Telemetry Data
  const [overview, setOverview] = useState<InvestigationOverviewResponse | null>(null);
  const [alerts, setAlerts] = useState<InvestigationAlertItem[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState<boolean>(false);

  // Handle browser Back / Forward buttons via popstate
  useEffect(() => {
    const handlePopState = () => {
      const state = parseUrlState();
      setActiveTab(state.tab);
      setSelectedCaseId(state.caseId);
      setSelectedIncidentId(state.incidentId);
      setSelectedEvidenceId(state.evidenceId);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle expired sessions caught by api.ts 401 interceptor
  useEffect(() => {
    const handleAuthExpired = (e: Event) => {
      const customEvent = e as CustomEvent<{ message?: string }>;
      clearStoredToken();
      setCurrentUser(null);
      setOverview(null);
      setAlerts([]);
      setSelectedCaseId(null);
      setSelectedIncidentId(null);
      setSelectedEvidenceId(null);
      setActiveTab('dashboard');
      syncUrl('dashboard', null, null, null, true);
      const msg = customEvent.detail?.message || 'Your session has expired. Please sign in again.';
      toast.error(msg);
    };

    window.addEventListener('dep:auth:expired', handleAuthExpired);
    return () => window.removeEventListener('dep:auth:expired', handleAuthExpired);
  }, []);

  // Check health & authenticate
  useEffect(() => {
    api
      .getHealth()
      .then((res) => setHealthStatus(res.status))
      .catch(() => setHealthStatus('unreachable'));

    const token = getStoredToken();
    if (token) {
      api
        .getMe()
        .then((res) => {
          setCurrentUser(res.user || res);
        })
        .catch(() => {
          clearStoredToken();
          setCurrentUser(null);
        })
        .finally(() => setAuthChecking(false));
    } else {
      setAuthChecking(false);
    }
  }, []);

  const loadDashboardData = async () => {
    if (!currentUser) return;
    setLoadingDashboard(true);
    try {
      const [overviewData, alertsData] = await Promise.all([api.getOverview(), api.getAlerts()]);
      setOverview(overviewData);
      setAlerts(alertsData.alerts);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoadingDashboard(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadDashboardData();
    }
  }, [currentUser]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsSubmitting(true);
    try {
      const res = await api.login(loginEmail.trim(), loginPassword);
      setCurrentUser(res.user);
      toast.success(`Welcome back, ${res.user.firstName || res.user.email}`);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    clearStoredToken();
    setCurrentUser(null);
    setOverview(null);
    setAlerts([]);
    setSelectedCaseId(null);
    setSelectedIncidentId(null);
    setSelectedEvidenceId(null);
    setActiveTab('dashboard');
    syncUrl('dashboard', null, null, null, true);
    toast.info('Signed out successfully');
  };

  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    setSelectedIncidentId(null);
    setSelectedEvidenceId(null);
    syncUrl('cases', caseId, null, null);
  };

  const handleSelectIncident = (incidentId: string) => {
    setSelectedIncidentId(incidentId);
    setSelectedEvidenceId(null);
    syncUrl('incidents', selectedCaseId, incidentId, null);
  };

  const handleSelectEvidence = (evidenceId: string) => {
    setSelectedEvidenceId(evidenceId);
    syncUrl('evidence', selectedCaseId, selectedIncidentId, evidenceId);
  };

  const handleBackToOverview = () => {
    setSelectedCaseId(null);
    setSelectedIncidentId(null);
    setSelectedEvidenceId(null);
    syncUrl(activeTab, null, null, null);
  };

  // Auth Loading Screen
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 dark:text-slate-400 text-xs font-mono">Initializing Investigation Dashboard...</p>
        </div>
      </div>
    );
  }

  // Not Logged In View
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-2xl shadow-slate-200/50 dark:shadow-black/60">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-indigo-600/30">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Investigator Intelligence</h1>
            <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Digital Evidence & Incident Management Platform</p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs rounded-lg">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Investigator Email</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="investigator@evidence-platform.local"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Password</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-sm shadow-indigo-600/30"
            >
              {isSubmitting ? 'Authenticating...' : 'Sign In to Dashboard'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
            <span>Database: {healthStatus === 'ok' ? 'Connected' : 'Offline'}</span>
            <span>Port: 5433</span>
          </div>
        </div>
      </div>
    );
  }

  const userRole =
    (typeof currentUser.role === 'string'
      ? currentUser.role
      : currentUser.role?.name) || 'VIEWER';

  // Compute Breadcrumb Trail
  const getBreadcrumbs = () => {
    const crumbs: Array<{ label: string; onClick?: () => void }> = [
      {
        label: 'Platform',
        onClick: handleBackToOverview,
      },
    ];

    if (selectedEvidenceId) {
      if (selectedCaseId) {
        crumbs.push({
          label: 'Case Investigation',
          onClick: () => {
            setSelectedEvidenceId(null);
            syncUrl(activeTab, selectedCaseId, null, null);
          },
        });
      } else if (selectedIncidentId) {
        crumbs.push({
          label: 'Incident Workspace',
          onClick: () => {
            setSelectedEvidenceId(null);
            syncUrl(activeTab, null, selectedIncidentId, null);
          },
        });
      } else {
        crumbs.push({
          label: 'Evidence Registry',
          onClick: () => {
            setSelectedEvidenceId(null);
            syncUrl(activeTab, null, null, null);
          },
        });
      }
      crumbs.push({ label: 'Evidence Artifact' });
      return crumbs;
    }

    if (selectedIncidentId) {
      crumbs.push({
        label: 'Incidents',
        onClick: () => {
          setSelectedIncidentId(null);
          syncUrl(activeTab, selectedCaseId, null, null);
        },
      });
      crumbs.push({ label: 'Incident Workspace' });
      return crumbs;
    }

    if (selectedCaseId) {
      crumbs.push({
        label: 'Cases',
        onClick: () => {
          setSelectedCaseId(null);
          syncUrl(activeTab, null, null, null);
        },
      });
      crumbs.push({ label: 'Case Investigation' });
      return crumbs;
    }

    // Tab level breadcrumb
    const tabLabels: Record<string, string> = {
      dashboard: 'Executive Dashboard',
      cases: 'Case Management',
      incidents: 'Security Incidents',
      evidence: 'Evidence Registry',
      reports: 'Report Center',
      ai: 'AI Forensic Insights',
      audit: 'Tamper-Evident Audit Trail',
      health: 'System Health & Probes',
      admin: 'Administration & RBAC',
    };

    crumbs.push({ label: tabLabels[activeTab] || 'Workspace' });
    return crumbs;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex font-sans antialiased transition-colors">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          setSelectedCaseId(null);
          setSelectedIncidentId(null);
          setSelectedEvidenceId(null);
          syncUrl(tab, null, null, null);
        }}
        user={currentUser}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <TopHeader
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          breadcrumbs={getBreadcrumbs()}
          healthStatus={healthStatus}
          onSearchSelectCase={handleSelectCase}
          onSearchSelectIncident={handleSelectIncident}
          onSearchSelectEvidence={handleSelectEvidence}
        />

        {/* Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* 1. Evidence Detail Workspace View */}
          {selectedEvidenceId ? (
            <EvidenceDetailView
              evidenceId={selectedEvidenceId}
              onBack={() => {
                setSelectedEvidenceId(null);
                syncUrl(activeTab, selectedCaseId, selectedIncidentId, null);
              }}
              onSelectCase={handleSelectCase}
              userRole={userRole}
            />
          ) : selectedIncidentId ? (
            /* 2. Incident Detail Workspace View */
            <IncidentDetailWorkspace
              incidentId={selectedIncidentId}
              onBack={() => {
                setSelectedIncidentId(null);
                syncUrl(activeTab, selectedCaseId, null, null);
              }}
              onSelectCase={handleSelectCase}
              onSelectEvidence={handleSelectEvidence}
              onAddEvidence={(caseId, incidentId) => {
                setModalDefaultCaseId(caseId);
                setModalDefaultIncidentId(incidentId);
                setIsUploadEvidenceOpen(true);
              }}
              userRole={userRole}
            />
          ) : selectedCaseId ? (
            /* 3. Case Investigation View */
            <CaseInvestigationView
              caseId={selectedCaseId}
              onBack={handleBackToOverview}
              onSelectEvidence={handleSelectEvidence}
              onSelectIncident={handleSelectIncident}
              userRole={userRole}
            />
          ) : (
            /* 4. Active Tab Views */
            <>
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  {loadingDashboard && !overview && (
                    <div className="text-center py-4 text-xs text-slate-400">
                      Loading investigation intelligence...
                    </div>
                  )}

                  <StatCards
                    overview={overview}
                    onNavigate={(tab) => {
                      if (tab === 'cases' || tab === 'incidents' || tab === 'evidence' || tab === 'reports') {
                        setActiveTab(tab);
                      }
                    }}
                  />

                  {alerts.length > 0 && (
                    <InvestigationAlerts
                      alerts={alerts}
                      onSelectCase={handleSelectCase}
                      onNavigateTab={(tab) => {
                        if (tab === 'cases' || tab === 'incidents' || tab === 'evidence') {
                          setActiveTab(tab);
                        }
                      }}
                    />
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <IncidentIntelligenceTable onSelectCase={handleSelectCase} />
                    <EvidenceIntelligenceTable
                      onSelectCase={handleSelectCase}
                      onSelectEvidence={handleSelectEvidence}
                    />
                  </div>

                  <ActivityTimeline
                    initialItems={overview?.recentActivity}
                    onSelectCase={handleSelectCase}
                  />
                </div>
              )}

              {activeTab === 'cases' && (
                <CasesListView
                  onSelectCase={handleSelectCase}
                  userRole={userRole}
                />
              )}

              {activeTab === 'incidents' && (
                <IncidentsListView
                  onSelectIncident={handleSelectIncident}
                  onSelectCase={handleSelectCase}
                  userRole={userRole}
                />
              )}

              {activeTab === 'evidence' && (
                <EvidenceListView
                  onSelectEvidence={handleSelectEvidence}
                  onOpenUploadModal={() => {
                    setModalDefaultCaseId(undefined);
                    setModalDefaultIncidentId(undefined);
                    setIsUploadEvidenceOpen(true);
                  }}
                  userRole={userRole}
                />
              )}

              {activeTab === 'reports' && <ReportCenter />}

              {activeTab === 'ai' && <AIInsightsSection />}

              {activeTab === 'audit' && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">System Audit Log</h2>
                  <ActivityTimeline onSelectCase={handleSelectCase} />
                </div>
              )}

              {activeTab === 'health' && <SystemHealthView />}

              {activeTab === 'admin' && <AdminOverviewView />}
            </>
          )}
        </main>

        {/* Global Modals */}
        <CreateCaseModal
          isOpen={isCreateCaseOpen}
          onClose={() => setIsCreateCaseOpen(false)}
          onCaseCreated={(newCase) => {
            handleSelectCase(newCase.id);
            loadDashboardData();
          }}
        />

        <CreateIncidentModal
          isOpen={isCreateIncidentOpen}
          onClose={() => setIsCreateIncidentOpen(false)}
          defaultCaseId={modalDefaultCaseId}
          onIncidentCreated={(newIncident) => {
            handleSelectIncident(newIncident.id);
            loadDashboardData();
          }}
        />

        <EvidenceUploadModal
          isOpen={isUploadEvidenceOpen}
          onClose={() => {
            setIsUploadEvidenceOpen(false);
            setModalDefaultCaseId(undefined);
            setModalDefaultIncidentId(undefined);
          }}
          defaultCaseId={modalDefaultCaseId}
          defaultIncidentId={modalDefaultIncidentId}
          onEvidenceUploaded={(newEvidence) => {
            handleSelectEvidence(newEvidence.id);
            loadDashboardData();
          }}
        />

        {/* Footer */}
        <footer className="bg-white/80 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 py-3 mt-auto transition-colors">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div>Digital Evidence Platform • Complete Forensic Application Workspaces</div>
            <div className="flex items-center gap-4">
              <span>PostgreSQL: 5433</span>
              <button
                onClick={handleLogout}
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
