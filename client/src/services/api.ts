import type {
  InvestigationOverviewResponse,
  CaseInvestigationSummaryResponse,
  ActivityTimelineResponse,
  IncidentIntelligenceResponse,
  EvidenceIntelligenceResponse,
  AIIntelligenceResponse,
  InvestigationAlertsResponse,
  UnifiedSearchResponse,
} from '../types/dashboard.types';

const TOKEN_KEY = 'dep_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = 'Request failed';
    try {
      const errJson = await response.json();
      errorDetail = errJson.message || errJson.error || JSON.stringify(errJson);
    } catch {
      errorDetail = response.statusText || `${response.status}`;
    }

    if (response.status === 401) {
      clearStoredToken();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('dep:auth:expired', {
            detail: { message: errorDetail || 'Your session has expired. Please sign in again.' },
          })
        );
      }
    }

    throw new Error(errorDetail);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Auth
  async login(email: string, password: string): Promise<{ token: string; user: any }> {
    const data = await request<{ token: string; user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  async getMe(): Promise<{ user: any }> {
    const data = await request<any>('/api/auth/me');
    return data && data.user ? data : { user: data };
  },

  async getHealth(): Promise<{ status: string; database?: string }> {
    return request<{ status: string; database?: string }>('/api/health');
  },

  // Dashboard API
  async getOverview(): Promise<InvestigationOverviewResponse> {
    return request<InvestigationOverviewResponse>('/api/dashboard/overview');
  },

  async getCaseInvestigation(caseId: string): Promise<CaseInvestigationSummaryResponse> {
    return request<CaseInvestigationSummaryResponse>(`/api/dashboard/cases/${encodeURIComponent(caseId)}`);
  },

  async getCaseInvestigationSummary(caseId: string): Promise<CaseInvestigationSummaryResponse> {
    return request<CaseInvestigationSummaryResponse>(`/api/dashboard/cases/${encodeURIComponent(caseId)}`);
  },

  async getActivityTimeline(params: Record<string, any> = {}): Promise<ActivityTimelineResponse> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query.append(k, String(v));
      }
    });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request<ActivityTimelineResponse>(`/api/dashboard/activity${qs}`);
  },

  async getIncidentIntelligence(params: Record<string, any> = {}): Promise<IncidentIntelligenceResponse> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query.append(k, String(v));
      }
    });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request<IncidentIntelligenceResponse>(`/api/dashboard/incidents${qs}`);
  },

  async getEvidenceIntelligence(params: Record<string, any> = {}): Promise<EvidenceIntelligenceResponse> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query.append(k, String(v));
      }
    });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return request<EvidenceIntelligenceResponse>(`/api/dashboard/evidence${qs}`);
  },

  async getAIIntelligence(): Promise<AIIntelligenceResponse> {
    return request<AIIntelligenceResponse>('/api/dashboard/ai');
  },

  async getAlerts(): Promise<InvestigationAlertsResponse> {
    return request<InvestigationAlertsResponse>('/api/dashboard/alerts');
  },

  async search(q: string, limit = 10): Promise<UnifiedSearchResponse> {
    const query = new URLSearchParams({ q, limit: String(limit) });
    return request<UnifiedSearchResponse>(`/api/dashboard/search?${query.toString()}`);
  },

  // Report API
  async previewReport(body: Record<string, unknown>): Promise<unknown> {
    return request<unknown>('/api/reports/preview', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async generateReport(body: Record<string, unknown>): Promise<unknown> {
    return request<unknown>('/api/reports', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async getCaseReport(caseId: string): Promise<unknown> {
    return request<unknown>(`/api/cases/${encodeURIComponent(caseId)}/report`);
  },

  async getIncidentReport(incidentId: string): Promise<unknown> {
    return request<unknown>(`/api/incidents/${encodeURIComponent(incidentId)}/report`);
  },

  async getEvidenceReport(evidenceId: string): Promise<unknown> {
    return request<unknown>(`/api/evidence/${encodeURIComponent(evidenceId)}/report`);
  },

  // Evidence Details & Sub-resources API
  async getEvidence(evidenceId: string): Promise<{ evidence: any }> {
    return request<{ evidence: any }>(`/api/evidence/${encodeURIComponent(evidenceId)}`);
  },

  async verifyEvidenceIntegrity(evidenceId: string): Promise<{
    evidenceId: string;
    storedHash: string;
    currentHash: string;
    integrity: 'VALID' | 'MISMATCH';
  }> {
    return request<{
      evidenceId: string;
      storedHash: string;
      currentHash: string;
      integrity: 'VALID' | 'MISMATCH';
    }>(`/api/evidence/${encodeURIComponent(evidenceId)}/integrity`);
  },

  async getEvidenceCustody(evidenceId: string, limit = 50): Promise<{ events: any[]; data: any[]; pagination: any }> {
    const res = await request<any>(
      `/api/evidence/${encodeURIComponent(evidenceId)}/custody?limit=${limit}`
    );
    const events = Array.isArray(res.data) ? res.data : (Array.isArray(res.events) ? res.events : []);
    return {
      events,
      data: events,
      pagination: res.pagination,
    };
  },

  async getEvidenceAudit(evidenceId: string, limit = 50): Promise<{ logs: any[]; data: any[]; pagination: any }> {
    const res = await request<any>(
      `/api/evidence/${encodeURIComponent(evidenceId)}/audit?limit=${limit}`
    );
    const logs = Array.isArray(res.data) ? res.data : (Array.isArray(res.logs) ? res.logs : []);
    return {
      logs,
      data: logs,
      pagination: res.pagination,
    };
  },

  async getEvidenceAI(evidenceId: string, limit = 20): Promise<{ analyses: any[]; data: any[]; pagination: any }> {
    const res = await request<any>(
      `/api/evidence/${encodeURIComponent(evidenceId)}/ai?limit=${limit}`
    );
    const analyses = Array.isArray(res.data) ? res.data : (Array.isArray(res.analyses) ? res.analyses : []);
    return {
      analyses,
      data: analyses,
      pagination: res.pagination,
    };
  },

  // Case Management API
  async getCases(params: Record<string, any> = {}): Promise<{ cases: any[]; data: any[]; pagination: any }> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query.append(k, String(v));
      }
    });
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await request<any>(`/api/cases${qs}`);
    const casesList = Array.isArray(res.data) ? res.data : (Array.isArray(res.cases) ? res.cases : []);
    return {
      cases: casesList,
      data: casesList,
      pagination: res.pagination || { page: 1, limit: 20, total: casesList.length, totalPages: 1 },
    };
  },

  async getCase(caseId: string): Promise<{ case: any }> {
    const data = await request<any>(`/api/cases/${encodeURIComponent(caseId)}`);
    return data && data.case ? data : { case: data };
  },

  async createCase(data: Record<string, any>): Promise<{ case: any }> {
    return request<{ case: any }>('/api/cases', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateCase(caseId: string, data: Record<string, any>): Promise<{ case: any }> {
    return request<{ case: any }>(`/api/cases/${encodeURIComponent(caseId)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async updateCaseStatus(caseId: string, data: { status: string; reason?: string }): Promise<{ case: any }> {
    return request<{ case: any }>(`/api/cases/${encodeURIComponent(caseId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async addCaseMember(caseId: string, data: { userId: string; role: string }): Promise<any> {
    return request<any>(`/api/cases/${encodeURIComponent(caseId)}/members`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async removeCaseMember(caseId: string, userId: string): Promise<any> {
    return request<any>(`/api/cases/${encodeURIComponent(caseId)}/members/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
  },

  // Incident Management API
  async getIncidents(params: Record<string, any> = {}): Promise<{ incidents: any[]; data: any[]; pagination: any }> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query.append(k, String(v));
      }
    });
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await request<any>(`/api/incidents${qs}`);
    const incidentsList = Array.isArray(res.data) ? res.data : (Array.isArray(res.incidents) ? res.incidents : []);
    return {
      incidents: incidentsList,
      data: incidentsList,
      pagination: res.pagination || { page: 1, limit: 20, total: incidentsList.length, totalPages: 1 },
    };
  },

  async getIncident(incidentId: string): Promise<{ incident: any }> {
    const data = await request<any>(`/api/incidents/${encodeURIComponent(incidentId)}`);
    return data && data.incident ? data : { incident: data };
  },

  async createIncident(data: Record<string, any>): Promise<{ incident: any }> {
    return request<{ incident: any }>('/api/incidents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateIncident(incidentId: string, data: Record<string, any>): Promise<{ incident: any }> {
    return request<{ incident: any }>(`/api/incidents/${encodeURIComponent(incidentId)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async updateIncidentStatus(incidentId: string, data: { status: string; reason?: string }): Promise<{ incident: any }> {
    return request<{ incident: any }>(`/api/incidents/${encodeURIComponent(incidentId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async classifyIncidentAI(
    incidentId: string,
    optionsOrForce?: boolean | { force?: boolean; provider?: 'gemini' | 'openai' },
    maybeProvider: 'gemini' | 'openai' = 'gemini'
  ): Promise<any> {
    const force = typeof optionsOrForce === 'boolean' ? optionsOrForce : (optionsOrForce?.force ?? false);
    const provider =
      typeof optionsOrForce === 'object' && optionsOrForce !== null
        ? (optionsOrForce.provider ?? 'gemini')
        : maybeProvider;
    return request<any>(`/api/incidents/${encodeURIComponent(incidentId)}/ai/classify`, {
      method: 'POST',
      body: JSON.stringify({ force, provider }),
    });
  },

  // Evidence Operations API
  async getEvidenceList(params: Record<string, any> = {}): Promise<{ evidence: any[]; data: any[]; pagination: any }> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        query.append(k, String(v));
      }
    });
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await request<any>(`/api/evidence${qs}`);
    const evidenceList = Array.isArray(res.data) ? res.data : (Array.isArray(res.evidence) ? res.evidence : []);
    return {
      evidence: evidenceList,
      data: evidenceList,
      pagination: res.pagination || { page: 1, limit: 20, total: evidenceList.length, totalPages: 1 },
    };
  },

  async uploadEvidence(formData: FormData): Promise<{ evidence: any }> {
    return request<{ evidence: any }>('/api/evidence', {
      method: 'POST',
      body: formData,
    });
  },

  async updateEvidenceMetadata(evidenceId: string, data: Record<string, any>): Promise<{ evidence: any }> {
    return request<{ evidence: any }>(`/api/evidence/${encodeURIComponent(evidenceId)}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async downloadEvidence(evidenceId: string, filename: string): Promise<void> {
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/evidence/${encodeURIComponent(evidenceId)}/download`, {
      headers,
    });

    if (!res.ok) {
      let msg = 'Failed to download evidence file';
      try {
        const errJson = await res.json();
        msg = errJson.message || errJson.error || msg;
      } catch {
        // use default
      }
      throw new Error(msg);
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'evidence-artifact';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  // Custody Operations API
  async transferEvidenceCustody(
    evidenceId: string,
    data: { toUserId: string; reason: string; location?: string }
  ): Promise<any> {
    return request<any>(`/api/evidence/${encodeURIComponent(evidenceId)}/custody/transfer`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async receiveEvidenceCustody(
    evidenceId: string,
    data: { reason?: string; location?: string } = {}
  ): Promise<any> {
    return request<any>(`/api/evidence/${encodeURIComponent(evidenceId)}/custody/receive`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async sealEvidenceCustody(evidenceId: string, data: { reason: string }): Promise<any> {
    return request<any>(`/api/evidence/${encodeURIComponent(evidenceId)}/custody/seal`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async unsealEvidenceCustody(evidenceId: string, data: { reason: string }): Promise<any> {
    return request<any>(`/api/evidence/${encodeURIComponent(evidenceId)}/custody/unseal`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async releaseEvidenceCustody(evidenceId: string, data: { reason: string }): Promise<any> {
    return request<any>(`/api/evidence/${encodeURIComponent(evidenceId)}/custody/release`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Evidence AI Analysis
  async triggerEvidenceAI(
    evidenceId: string,
    analysisType:
      | 'EVIDENCE_SUMMARY'
      | 'INCIDENT_CLASSIFICATION'
      | 'IOC_EXTRACTION'
      | 'THREAT_ANALYSIS'
      | 'INVESTIGATION_SUMMARY',
    force = false,
    provider: 'gemini' | 'openai' = 'gemini'
  ): Promise<any> {
    return request<any>(`/api/evidence/${encodeURIComponent(evidenceId)}/ai/analyze`, {
      method: 'POST',
      body: JSON.stringify({ analysisType, force, provider }),
    });
  },

  // System & Health API
  async getReady(): Promise<{ status: string; database?: string; storage?: string }> {
    return request<{ status: string; database?: string; storage?: string }>('/api/ready');
  },

  async getAdminRbac(): Promise<any> {
    return request<any>('/api/rbac/admin');
  },
};
