import { clearPrivateClientData, getToken, saveSession } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  async request(endpoint, options = {}) {
    const token = getToken();
    const headers = {
      ...(options.headers || {})
    };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Ein Fehler ist aufgetreten' }));
      if ((response.status === 401 || response.status === 403) && token) {
        await clearPrivateClientData();
        if (!window.location.pathname.startsWith('/login')) {
          window.location.assign(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
        }
      }
      throw new Error(error.error || 'Ein Fehler ist aufgetreten');
    }

    return response.json();
  }

  async register(email, password) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (data.token) {
      saveSession(data.token, data.user);
    }
    return data;
  }

  async logout() {
    await clearPrivateClientData();
  }

  async getMedications() {
    return this.request('/medications');
  }

  async getMedication(id) {
    return this.request(`/medications/${id}`);
  }

  async createMedication(data) {
    return this.request('/medications', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async createMedicationWithPhoto(data, photoFile) {
    const formData = new FormData();
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });
    if (photoFile) {
      formData.append('photo', photoFile);
    }
    return this.request('/medications', {
      method: 'POST',
      body: formData
    });
  }

  async updateMedication(id, data) {
    return this.request(`/medications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async deleteMedication(id) {
    return this.request(`/medications/${id}`, {
      method: 'DELETE'
    });
  }

  async updateStock(id, action, amount) {
    return this.request(`/medications/${id}/stock`, {
      method: 'POST',
      body: JSON.stringify({ action, amount })
    });
  }

  async getMedicationHistory(id, limit = 50) {
    return this.request(`/medications/${id}/history?limit=${limit}`);
  }

  async uploadMedicationPhoto(id, photoFile) {
    const formData = new FormData();
    formData.append('photo', photoFile);
    return this.request(`/medications/${id}/photo`, {
      method: 'POST',
      body: formData
    });
  }

  async deleteMedicationPhoto(id) {
    return this.request(`/medications/${id}/photo`, {
      method: 'DELETE'
    });
  }

  async getProfile() {
    return this.request('/user/profile');
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/user/password', {
      method: 'PUT',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
    });
  }

  async getPreferences() {
    return this.request('/user/preferences');
  }

  async updatePreferences(preferences) {
    return this.request('/user/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences)
    });
  }

  async getUserPreferences() {
    return this.request('/user/preferences');
  }

  async updateUserPreferences(preferences) {
    return this.request('/user/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences)
    });
  }

  async sendWeeklyDigestTest() {
    return this.request('/user/notifications/test-weekly', {
      method: 'POST'
    });
  }

  async exportData() {
    return this.request('/data/export');
  }

  async importData(data) {
    return this.request('/data/import', {
      method: 'POST',
      body: JSON.stringify({ data })
    });
  }
}

export default new ApiService();
