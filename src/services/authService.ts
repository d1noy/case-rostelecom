/**
 * Authentication service implementing DevTeam Laravel Fortify/Sanctum API specification
 * Base URL: /api (or fallback to root)
 */

export interface UserProfile {
  id: number;
  username: string;
  name: string;
  email: string;
  two_factor_confirmed: boolean;
}

export interface LoginResponse {
  message: string;
  two_factor_required: boolean;
  challenge: string;
  expires_in?: number;
}

export interface VerifyResponse {
  message: string;
  token_type: string;
  access_token: string;
  expires_at: string;
  user: UserProfile;
}

const STORAGE_TOKEN_KEY = 'rtk_access_token';
const STORAGE_USER_KEY = 'rtk_user';

export const authService = {
  getToken(): string | null {
    try {
      return localStorage.getItem(STORAGE_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  getUser(): UserProfile | null {
    try {
      const raw = localStorage.getItem(STORAGE_USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  saveSession(token: string, user: UserProfile) {
    try {
      localStorage.setItem(STORAGE_TOKEN_KEY, token);
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
    } catch (e) {
      console.error('Failed to save session to localStorage', e);
    }
  },

  clearSession() {
    try {
      localStorage.removeItem(STORAGE_TOKEN_KEY);
      localStorage.removeItem(STORAGE_USER_KEY);
    } catch (e) {
      console.error('Failed to clear session from localStorage', e);
    }
  },

  /**
   * Helper fetch with automatic Bearer Token header
   */
  async apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const token = this.getToken();
    const headers = new Headers(options.headers || {});

    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(endpoint, {
      ...options,
      headers,
    });

    // If unauthorized, session is expired
    if (res.status === 401) {
      this.clearSession();
    }

    return res;
  },

  /**
   * Step 1: POST /auth/login
   */
  async login(username: string, password: string): Promise<LoginResponse> {
    const payload = { username, password };
    let res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status === 404) {
      // Fallback without /api prefix
      res = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMessage =
        data.message ||
        (data.errors && Object.values(data.errors).flat().join(', ')) ||
        (res.status === 429
          ? 'Слишком много попыток входа. Попробуйте позже.'
          : 'Ошибка авторизации. Проверьте логин и пароль.');
      const err = new Error(errorMessage) as any;
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return {
      message: data.message || 'Введите код из приложения-аутентификатора.',
      two_factor_required: !!data.two_factor_required,
      challenge: data.challenge || data.challenge_token || '',
      expires_in: data.expires_in || 300,
    };
  },

  /**
   * Step 2: POST /auth/2fa/verify
   */
  async verify2fa(challenge: string, code: string): Promise<VerifyResponse> {
    const payload = {
      challenge,
      challenge_token: challenge,
      code: code.trim(),
    };

    let res = await fetch('/api/auth/2fa/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.status === 404) {
      // Fallback without /api prefix
      res = await fetch('/auth/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMessage =
        data.message ||
        (data.errors && Object.values(data.errors).flat().join(', ')) ||
        'Неверный код подтверждения.';
      const err = new Error(errorMessage) as any;
      err.status = res.status;
      err.data = data;
      throw err;
    }

    // Save token and user
    if (data.access_token && data.user) {
      this.saveSession(data.access_token, data.user);
    }

    return data as VerifyResponse;
  },

  /**
   * POST /auth/logout
   */
  async logout(): Promise<void> {
    try {
      await this.apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Logout request failed, clearing local session anyway', e);
    } finally {
      this.clearSession();
    }
  },

  /**
   * GET /user
   */
  async getProfile(): Promise<UserProfile | null> {
    const res = await this.apiFetch('/api/user');
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    return data as UserProfile;
  },
};
