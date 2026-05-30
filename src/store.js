import { create } from 'zustand';
import api from './api';
import { mockStore } from './mockData';

const DEMO_MODE = !import.meta.env.VITE_API_URL && typeof window !== 'undefined';

let backendAvailable = null;

async function checkBackend() {
  if (backendAvailable !== null) return backendAvailable;
  try {
    await api.get('/api/auth/me', { timeout: 2000 });
    backendAvailable = true;
  } catch (e) {
    if (e.response) {
      backendAvailable = true;
    } else {
      backendAvailable = false;
      console.log('[ApiGuard] Backend not available — running in demo mode with sample data.');
    }
  }
  return backendAvailable;
}

async function tryApi(apiCall, mockFallback) {
  const live = await checkBackend();
  if (live) {
    return apiCall();
  }
  return mockFallback();
}

export const useAppStore = create((set, get) => ({

  user: null,
  accessToken: localStorage.getItem('accessToken') || null,
  refreshToken: localStorage.getItem('refreshToken') || null,
  authLoading: false,
  authError: null,
  demoMode: false,

  login: async (email, password) => {
    set({ authLoading: true, authError: null });
    try {
      const live = await checkBackend();
      if (live) {
        const res = await api.post('/api/auth/login', { email, password });
        const { user, accessToken, refreshToken } = res.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        set({ user, accessToken, refreshToken, authLoading: false, demoMode: false });
      } else {
        const data = await mockStore.login(email, password);
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken, authLoading: false, demoMode: true });
      }
      return true;
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Login failed. Please check credentials.';
      set({ authError: msg, authLoading: false });
      return false;
    }
  },

  signup: async (name, email, password) => {
    set({ authLoading: true, authError: null });
    try {
      const live = await checkBackend();
      if (live) {
        const res = await api.post('/api/auth/register', { name, email, password });
        const { user, accessToken, refreshToken } = res.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        set({ user, accessToken, refreshToken, authLoading: false, demoMode: false });
      } else {
        const data = await mockStore.signup(name, email, password);
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken, authLoading: false, demoMode: true });
      }
      return true;
    } catch (e) {
      const msg = e.response?.data?.error || e.message || 'Signup failed.';
      set({ authError: msg, authLoading: false });
      return false;
    }
  },

  logout: () => {
    const token = get().refreshToken;
    if (!get().demoMode) {
      api.post('/api/auth/logout', { token }).catch(() => {});
    }
    localStorage.clear();
    backendAvailable = null;
    set({ user: null, accessToken: null, refreshToken: null, demoMode: false });
  },

  fetchMe: async () => {
    if (!get().accessToken) return;
    try {
      const live = await checkBackend();
      if (live) {
        const res = await api.get('/api/auth/me');
        set({ user: res.data.user, demoMode: false });
      } else {
        const data = await mockStore.fetchMe();
        set({ user: data.user, demoMode: true });
      }
    } catch (e) {
      get().logout();
    }
  },

  scans: [],
  activeScan: null,
  streamProgress: 0,
  streamCheck: '',
  streamStatus: 'idle',

  fetchScans: async () => {
    try {
      const data = await tryApi(
        async () => (await api.get('/api/scans')).data,
        () => mockStore.fetchScans()
      );
      set({ scans: data });
    } catch (e) {
      console.error('Fetch scans error:', e);
    }
  },

  fetchScan: async (id) => {
    try {
      const data = await tryApi(
        async () => (await api.get(`/api/scans/${id}`)).data,
        () => mockStore.fetchScan(id)
      );
      set({ activeScan: data });
      return data;
    } catch (e) {
      console.error('Fetch scan error:', e);
    }
  },

  triggerScan: async (name, url, type, collectionId = null, repoName = null, pipelineRunId = null) => {
    try {
      const live = await checkBackend();
      if (live) {
        const payload = { name, url, type, collectionId, repoName, pipelineRunId };
        const res = await api.post('/api/scans', payload);
        const scan = res.data;
        get().fetchScans();
        get().listenToScanStream(scan.id);
        return scan;
      } else {
        const scan = await mockStore.triggerScan(name, url, type);
        get().listenToScanStream(scan.id);
        return scan;
      }
    } catch (e) {
      console.error('Trigger scan error:', e);
      return null;
    }
  },

  listenToScanStream: (scanId) => {
    set({ streamProgress: 0, streamCheck: 'Initializing...', streamStatus: 'scanning' });

    const live = backendAvailable;
    if (live) {
      const eventSource = new EventSource(`/api/scans/${scanId}/stream`);
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.status === 'scanning') {
          set({ streamProgress: data.progress, streamCheck: data.currentCheck, streamStatus: 'scanning' });
        } else if (data.status === 'completed') {
          set({ streamProgress: 100, streamCheck: 'Scan completed successfully.', streamStatus: 'completed' });
          eventSource.close();
          get().fetchScans();
          get().fetchAlerts();
          get().fetchPostman();
          get().fetchGitHub();
          get().fetchPipelineRuns();
        } else if (data.status === 'failed') {
          set({ streamProgress: 100, streamCheck: data.error || 'Scan failed.', streamStatus: 'failed' });
          eventSource.close();
          get().fetchScans();
        }
      };
      eventSource.onerror = () => {
        eventSource.close();
        set({ streamStatus: 'failed', streamCheck: 'Connection lost.' });
      };
    } else {
      mockStore.simulateScanProgress(
        scanId,
        (data) => set({ streamProgress: data.progress, streamCheck: data.currentCheck, streamStatus: 'scanning' }),
        (data) => {
          set({ streamProgress: 100, streamCheck: 'Scan completed successfully.', streamStatus: 'completed' });
          get().fetchScans();
          get().fetchAlerts();
          get().fetchPostman();
          get().fetchGitHub();
          get().fetchPipelineRuns();
        }
      );
    }
  },

  deleteScan: async (id) => {
    try {
      const live = await checkBackend();
      if (live) {
        await api.delete(`/api/scans/${id}`);
      }
      set((state) => ({ scans: state.scans.filter((s) => s.id !== id) }));
    } catch (e) {
      console.error('Delete scan error:', e);
    }
  },

  specs: [],
  endpoints: [],
  diff: null,

  fetchSpecs: async () => {
    try {
      const data = await tryApi(
        async () => (await api.get('/api/openapi/specs')).data,
        () => mockStore.fetchSpecs()
      );
      set({ specs: data });
    } catch (e) {
      console.error('Fetch specs error:', e);
    }
  },

  importSpec: async (name, specContent = '', specUrl = '', file = null) => {
    try {
      const live = await checkBackend();
      if (live) {
        const formData = new FormData();
        if (file) {
          formData.append('spec', file);
        } else {
          formData.append('name', name);
          formData.append('specContent', specContent);
          formData.append('specUrl', specUrl);
        }
        const res = await api.post('/api/openapi/import', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        get().fetchSpecs();
        set({ diff: res.data.diff || null });
        return res.data;
      } else {
        const data = await mockStore.importSpec();
        get().fetchSpecs();
        return data;
      }
    } catch (e) {
      console.error('Import spec error:', e);
      return null;
    }
  },

  fetchEndpoints: async (specId) => {
    try {
      const data = await tryApi(
        async () => (await api.get(`/api/openapi/specs/${specId}/endpoints`)).data,
        () => mockStore.fetchEndpoints()
      );
      set({ endpoints: data });
    } catch (e) {
      console.error('Fetch endpoints error:', e);
    }
  },

  scanSpec: async (specId) => {
    try {
      const live = await checkBackend();
      if (live) {
        const res = await api.post(`/api/openapi/specs/${specId}/scan`);
        get().listenToScanStream(res.data.id);
        return res.data;
      } else {
        const scan = await mockStore.triggerScan('OpenAPI Scan', '/api/v1', 'openapi');
        get().listenToScanStream(scan.id);
        return scan;
      }
    } catch (e) {
      console.error('Scan spec error:', e);
      return null;
    }
  },

  postmanCollections: [],
  postmanConnected: false,

  fetchPostman: async () => {
    try {
      const data = await tryApi(
        async () => (await api.get('/api/postman/collections')).data,
        () => mockStore.fetchPostman()
      );
      set({ postmanCollections: data, postmanConnected: data.length > 0 });
    } catch (e) {
      console.error('Fetch Postman error:', e);
    }
  },

  connectPostman: async (apiKey) => {
    try {
      const live = await checkBackend();
      if (live) {
        await api.post('/api/postman/connect', { apiKey });
      } else {
        await mockStore.connectPostman();
      }
      get().fetchPostman();
      return true;
    } catch (e) {
      console.error('Connect Postman error:', e);
      return false;
    }
  },

  scanCollection: async (id) => {
    try {
      const live = await checkBackend();
      if (live) {
        const res = await api.post(`/api/postman/collections/${id}/scan`);
        get().listenToScanStream(res.data.id);
        return res.data;
      } else {
        const scan = await mockStore.triggerScan('Postman Scan', 'postman', 'postman');
        get().listenToScanStream(scan.id);
        return scan;
      }
    } catch (e) {
      console.error('Scan collection error:', e);
      return null;
    }
  },

  disconnectPostman: async () => {
    try {
      const live = await checkBackend();
      if (live) {
        await api.delete('/api/postman/disconnect');
      }
      set({ postmanCollections: [], postmanConnected: false });
    } catch (e) {
      console.error('Disconnect Postman error:', e);
    }
  },

  githubRepos: [],

  fetchGitHub: async () => {
    try {
      const data = await tryApi(
        async () => (await api.get('/api/github/repos')).data,
        () => mockStore.fetchGitHub()
      );
      set({ githubRepos: data });
    } catch (e) {
      console.error('Fetch GitHub error:', e);
    }
  },

  scanRepo: async (owner, repo) => {
    try {
      const live = await checkBackend();
      if (live) {
        const res = await api.post(`/api/github/repos/${owner}/${repo}/scan`);
        get().listenToScanStream(res.data.id);
        return res.data;
      } else {
        const scan = await mockStore.triggerScan(`GitHub Scan — ${owner}/${repo}`, `github://${owner}/${repo}`, 'github');
        get().listenToScanStream(scan.id);
        return scan;
      }
    } catch (e) {
      console.error('Scan repo error:', e);
      return null;
    }
  },

  pipelineRuns: [],
  cicdToken: '',

  fetchPipelineRuns: async () => {
    try {
      const data = await tryApi(
        async () => (await api.get('/api/cicd/runs')).data,
        () => mockStore.fetchPipelineRuns()
      );
      set({ pipelineRuns: data });
    } catch (e) {
      console.error('Fetch pipelines error:', e);
    }
  },

  generateCicdToken: async () => {
    try {
      const live = await checkBackend();
      if (live) {
        const res = await api.post('/api/cicd/token');
        set({ cicdToken: res.data.token });
        return res.data.token;
      } else {
        const token = await mockStore.generateCicdToken();
        set({ cicdToken: token });
        return token;
      }
    } catch (e) {
      console.error('Generate token error:', e);
      return '';
    }
  },

  triggerPipelineScan: async (repo, branch, commitMsg, commitSha, triggeredBy) => {
    try {
      const live = await checkBackend();
      if (live) {
        const token = get().cicdToken || await get().generateCicdToken();
        const res = await api.post('/api/cicd/scan', {
          repo, branch, commit_msg: commitMsg, commit_sha: commitSha, triggered_by: triggeredBy,
        }, {
          headers: { Authorization: `Bearer ${token}` },
        });
        get().fetchPipelineRuns();
        get().listenToScanStream(res.data.scanId);
        return res.data;
      } else {
        const scan = await mockStore.triggerScan(`CI/CD Gate — ${repo}`, `cicd://${repo}`, 'cicd');
        get().listenToScanStream(scan.id);
        get().fetchPipelineRuns();
        return scan;
      }
    } catch (e) {
      console.error('Trigger pipeline scan error:', e);
      return null;
    }
  },

  reports: [],

  fetchReports: async () => {
    try {
      const data = await tryApi(
        async () => (await api.get('/api/reports')).data,
        () => mockStore.fetchReports()
      );
      set({ reports: data });
    } catch (e) {
      console.error('Fetch reports error:', e);
    }
  },

  generateReport: async (scanId, name) => {
    try {
      const live = await checkBackend();
      if (live) {
        const res = await api.post('/api/reports/generate', { scanId, name });
        get().fetchReports();
        return res.data;
      } else {
        const data = await mockStore.generateReport(scanId, name);
        get().fetchReports();
        return data;
      }
    } catch (e) {
      console.error('Generate report error:', e);
      return null;
    }
  },

  deleteReport: async (id) => {
    try {
      const live = await checkBackend();
      if (live) {
        await api.delete(`/api/reports/${id}`);
      }
      set((state) => ({ reports: state.reports.filter((r) => r.id !== id) }));
    } catch (e) {
      console.error('Delete report error:', e);
    }
  },

  alerts: [],

  fetchAlerts: async () => {
    try {
      const data = await tryApi(
        async () => (await api.get('/api/alerts')).data,
        () => mockStore.fetchAlerts()
      );
      set({ alerts: data });
    } catch (e) {
      console.error('Fetch alerts error:', e);
    }
  },

  markAlertRead: async (id) => {
    try {
      const live = await checkBackend();
      if (live) {
        await api.patch(`/api/alerts/${id}/read`);
      }
      set((state) => ({
        alerts: state.alerts.map((a) => a.id === id ? { ...a, read: true } : a),
      }));
    } catch (e) {
      console.error('Mark alert read error:', e);
    }
  },

  markAllAlertsRead: async () => {
    try {
      const live = await checkBackend();
      if (live) {
        await api.patch('/api/alerts/read-all');
      }
      set((state) => ({
        alerts: state.alerts.map((a) => ({ ...a, read: true })),
      }));
    } catch (e) {
      console.error('Mark all alerts read error:', e);
    }
  },

  infraStatus: [],
  tuning: { concurrency: 3, max_retries: 3, backoff_delay: 5000 },

  fetchInfra: async () => {
    try {
      const data = await tryApi(
        async () => (await api.get('/api/infra/status')).data,
        () => mockStore.fetchInfra()
      );
      set({ infraStatus: data });
    } catch (e) {
      console.error('Fetch infra error:', e);
    }
  },

  fetchTuning: async () => {
    try {
      const data = await tryApi(
        async () => (await api.get('/api/infra/tuning')).data,
        () => mockStore.fetchTuning()
      );
      set({ tuning: data });
    } catch (e) {
      console.error('Fetch tuning error:', e);
    }
  },

  saveTuning: async (config) => {
    try {
      const live = await checkBackend();
      if (live) {
        const res = await api.post('/api/infra/tuning', config);
        set({ tuning: res.data.config });
      } else {
        const data = await mockStore.saveTuning(config);
        set({ tuning: data });
      }
      return true;
    } catch (e) {
      console.error('Save tuning error:', e);
      return false;
    }
  },
}));
