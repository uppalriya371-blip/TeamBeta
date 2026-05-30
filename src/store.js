import { create } from 'zustand';
import api from './api';

export const useAppStore = create((set, get) => ({

  user: null,
  accessToken: localStorage.getItem('accessToken') || null,
  refreshToken: localStorage.getItem('refreshToken') || null,
  authLoading: false,
  authError: null,

  login: async (email, password) => {
    set({ authLoading: true, authError: null });
    try {
      const res = await api.post('/api/auth/login', { email, password });
      const { user, accessToken, refreshToken } = res.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      set({ user, accessToken, refreshToken, authLoading: false });
      return true;
    } catch (e) {
      const msg = e.response?.data?.error || 'Login failed. Please check credentials.';
      set({ authError: msg, authLoading: false });
      return false;
    }
  },

  signup: async (name, email, password) => {
    set({ authLoading: true, authError: null });
    try {
      const res = await api.post('/api/auth/register', { name, email, password });
      const { user, accessToken, refreshToken } = res.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      set({ user, accessToken, refreshToken, authLoading: false });
      return true;
    } catch (e) {
      const msg = e.response?.data?.error || 'Signup failed.';
      set({ authError: msg, authLoading: false });
      return false;
    }
  },

  logout: () => {
    const token = get().refreshToken;
    api.post('/api/auth/logout', { token }).catch(() => {});
    localStorage.clear();
    set({ user: null, accessToken: null, refreshToken: null });
  },

  fetchMe: async () => {
    if (!get().accessToken) return;
    try {
      const res = await api.get('/api/auth/me');
      set({ user: res.data.user });
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
      const res = await api.get('/api/scans');
      set({ scans: res.data });
    } catch (e) {
      console.error('Fetch scans error:', e);
    }
  },

  fetchScan: async (id) => {
    try {
      const res = await api.get(`/api/scans/${id}`);
      set({ activeScan: res.data });
      return res.data;
    } catch (e) {
      console.error('Fetch scan error:', e);
    }
  },

  triggerScan: async (name, url, type, collectionId = null, repoName = null, pipelineRunId = null) => {
    try {
      const payload = { name, url, type, collectionId, repoName, pipelineRunId };
      const res = await api.post('/api/scans', payload);
      const scan = res.data;
      get().fetchScans();
      get().listenToScanStream(scan.id);
      return scan;
    } catch (e) {
      console.error('Trigger scan error:', e);
      return null;
    }
  },

  listenToScanStream: (scanId) => {
    set({ streamProgress: 0, streamCheck: 'Initializing...', streamStatus: 'scanning' });

    const eventSource = new EventSource(`/api/scans/${scanId}/stream`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.status === 'scanning') {
        set({
          streamProgress: data.progress,
          streamCheck: data.currentCheck,
          streamStatus: 'scanning',
        });
      } else if (data.status === 'completed') {
        set({
          streamProgress: 100,
          streamCheck: 'Scan completed successfully.',
          streamStatus: 'completed',
        });
        eventSource.close();
        get().fetchScans();
        get().fetchAlerts();
        get().fetchPostman();
        get().fetchGitHub();
        get().fetchPipelineRuns();
      } else if (data.status === 'failed') {
        set({
          streamProgress: 100,
          streamCheck: data.error || 'Scan failed.',
          streamStatus: 'failed',
        });
        eventSource.close();
        get().fetchScans();
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      set({ streamStatus: 'failed', streamCheck: 'Connection lost.' });
    };
  },

  deleteScan: async (id) => {
    try {
      await api.delete(`/api/scans/${id}`);
      get().fetchScans();
    } catch (e) {
      console.error('Delete scan error:', e);
    }
  },

  specs: [],
  endpoints: [],
  diff: null,

  fetchSpecs: async () => {
    try {
      const res = await api.get('/api/openapi/specs');
      set({ specs: res.data });
    } catch (e) {
      console.error('Fetch specs error:', e);
    }
  },

  importSpec: async (name, specContent = '', specUrl = '', file = null) => {
    try {
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
    } catch (e) {
      console.error('Import spec error:', e);
      return null;
    }
  },

  fetchEndpoints: async (specId) => {
    try {
      const res = await api.get(`/api/openapi/specs/${specId}/endpoints`);
      set({ endpoints: res.data });
    } catch (e) {
      console.error('Fetch endpoints error:', e);
    }
  },

  scanSpec: async (specId) => {
    try {
      const res = await api.post(`/api/openapi/specs/${specId}/scan`);
      get().listenToScanStream(res.data.id);
      return res.data;
    } catch (e) {
      console.error('Scan spec error:', e);
      return null;
    }
  },

  postmanCollections: [],
  postmanConnected: false,

  fetchPostman: async () => {
    try {
      const res = await api.get('/api/postman/collections');
      set({ postmanCollections: res.data, postmanConnected: res.data.length > 0 });
    } catch (e) {
      console.error('Fetch Postman error:', e);
    }
  },

  connectPostman: async (apiKey) => {
    try {
      await api.post('/api/postman/connect', { apiKey });
      get().fetchPostman();
      return true;
    } catch (e) {
      console.error('Connect Postman error:', e);
      return false;
    }
  },

  scanCollection: async (id) => {
    try {
      const res = await api.post(`/api/postman/collections/${id}/scan`);
      get().listenToScanStream(res.data.id);
      return res.data;
    } catch (e) {
      console.error('Scan collection error:', e);
      return null;
    }
  },

  disconnectPostman: async () => {
    try {
      await api.delete('/api/postman/disconnect');
      set({ postmanCollections: [], postmanConnected: false });
    } catch (e) {
      console.error('Disconnect Postman error:', e);
    }
  },

  githubRepos: [],

  fetchGitHub: async () => {
    try {
      const res = await api.get('/api/github/repos');
      set({ githubRepos: res.data });
    } catch (e) {
      console.error('Fetch GitHub error:', e);
    }
  },

  scanRepo: async (owner, repo) => {
    try {
      const res = await api.post(`/api/github/repos/${owner}/${repo}/scan`);
      get().listenToScanStream(res.data.id);
      return res.data;
    } catch (e) {
      console.error('Scan repo error:', e);
      return null;
    }
  },

  pipelineRuns: [],
  cicdToken: '',

  fetchPipelineRuns: async () => {
    try {
      const res = await api.get('/api/cicd/runs');
      set({ pipelineRuns: res.data });
    } catch (e) {
      console.error('Fetch pipelines error:', e);
    }
  },

  generateCicdToken: async () => {
    try {
      const res = await api.post('/api/cicd/token');
      set({ cicdToken: res.data.token });
      return res.data.token;
    } catch (e) {
      console.error('Generate token error:', e);
      return '';
    }
  },

  triggerPipelineScan: async (repo, branch, commitMsg, commitSha, triggeredBy) => {
    try {
      const token = get().cicdToken || await get().generateCicdToken();
      const res = await api.post('/api/cicd/scan', {
        repo, branch, commit_msg: commitMsg, commit_sha: commitSha, triggered_by: triggeredBy,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      get().fetchPipelineRuns();
      get().listenToScanStream(res.data.scanId);
      return res.data;
    } catch (e) {
      console.error('Trigger pipeline scan error:', e);
      return null;
    }
  },

  reports: [],

  fetchReports: async () => {
    try {
      const res = await api.get('/api/reports');
      set({ reports: res.data });
    } catch (e) {
      console.error('Fetch reports error:', e);
    }
  },

  generateReport: async (scanId, name) => {
    try {
      const res = await api.post('/api/reports/generate', { scanId, name });
      get().fetchReports();
      return res.data;
    } catch (e) {
      console.error('Generate report error:', e);
      return null;
    }
  },

  deleteReport: async (id) => {
    try {
      await api.delete(`/api/reports/${id}`);
      get().fetchReports();
    } catch (e) {
      console.error('Delete report error:', e);
    }
  },

  alerts: [],

  fetchAlerts: async () => {
    try {
      const res = await api.get('/api/alerts');
      set({ alerts: res.data });
    } catch (e) {
      console.error('Fetch alerts error:', e);
    }
  },

  markAlertRead: async (id) => {
    try {
      await api.patch(`/api/alerts/${id}/read`);
      get().fetchAlerts();
    } catch (e) {
      console.error('Mark alert read error:', e);
    }
  },

  markAllAlertsRead: async () => {
    try {
      await api.patch('/api/alerts/read-all');
      get().fetchAlerts();
    } catch (e) {
      console.error('Mark all alerts read error:', e);
    }
  },

  infraStatus: [],
  tuning: { concurrency: 3, max_retries: 3, backoff_delay: 5000 },

  fetchInfra: async () => {
    try {
      const res = await api.get('/api/infra/status');
      set({ infraStatus: res.data });
    } catch (e) {
      console.error('Fetch infra error:', e);
    }
  },

  fetchTuning: async () => {
    try {
      const res = await api.get('/api/infra/tuning');
      set({ tuning: res.data });
    } catch (e) {
      console.error('Fetch tuning error:', e);
    }
  },

  saveTuning: async (config) => {
    try {
      const res = await api.post('/api/infra/tuning', config);
      set({ tuning: res.data.config });
      return true;
    } catch (e) {
      console.error('Save tuning error:', e);
      return false;
    }
  },
}));
