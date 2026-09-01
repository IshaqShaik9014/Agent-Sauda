export interface MerchantSession {
  id: string;
  name: string;
  slug: string;
  currency: string;
  role: 'OWNER' | 'ADMIN' | 'STAFF';
}

export interface UserSession {
  id: string;
  email: string;
  name: string;
}

export interface AuthSession {
  token: string;
  user: UserSession;
  merchant: MerchantSession;
}

const AUTH_STORAGE_KEY = 'agent_sauda_auth_session';

export const auth = {
  getSession(): AuthSession | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as AuthSession;
    } catch {
      return null;
    }
  },

  setSession(session: AuthSession) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  },

  clearSession() {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(AUTH_STORAGE_KEY);
  },

  getToken(): string | null {
    const session = this.getSession();
    return session ? session.token : null;
  },

  getActiveMerchant(): MerchantSession | null {
    const session = this.getSession();
    return session ? session.merchant : null;
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
};
