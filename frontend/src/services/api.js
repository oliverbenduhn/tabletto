const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Ein Fehler ist aufgetreten' }));
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
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    return data;
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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

  async getProfile() {
    return this.request('/user/profile');
  }

  async changePassword(currentPassword, newPassword) {
    return this.request('/user/password', {
      method: 'PUT',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
    });
  }
}

export default new ApiService();
