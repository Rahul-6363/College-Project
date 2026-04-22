import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: if token exists decode it locally (no network round-trip needed)
  // Only call /me if we can't decode locally (future-proof)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }

    // Fast: decode JWT payload locally without verifying signature
    // (signature is verified by backend on every protected call anyway)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 > Date.now()) {
        // Token still valid — restore user immediately, no network needed
        setUser({ id: payload.sub, name: payload.name, email: payload.email, role: payload.role });
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setLoading(false);
        return;
      }
    } catch (_) { /* malformed token — fall through to network check */ }

    // Token malformed or expired — clear it
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setLoading(false);
  }, []);

  function login(token, userData) {
    localStorage.setItem('token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  }

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
