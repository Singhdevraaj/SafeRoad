import { useState, useEffect } from 'react';
import { API_URL } from '../api';
import { AuthContext } from './auth-context';

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(() => localStorage.getItem('saferoute_token'));

  // Mock authentication for the hackathon
  useEffect(() => {
    const savedUser = localStorage.getItem('saferoute_user');
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch { localStorage.removeItem('saferoute_user'); }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Invalid credentials.');
      const { user, token } = data;
      setUser(user);
      setToken(token);
      localStorage.setItem('saferoute_user', JSON.stringify(user));
      localStorage.setItem('saferoute_token', token);
      return user;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const signup = async (email, password, name) => {
    try {
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create account.');
      const { user, token } = data;
      setUser(user);
      setToken(token);
      localStorage.setItem('saferoute_user', JSON.stringify(user));
      localStorage.setItem('saferoute_token', token);
      return user;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  // Guests can browse, report, add places and vote without an account (handy for demos).
  const loginAsGuest = () => {
    const guest = { id: 'guest', name: 'Guest', role: 'GUEST', guest: true };
    setUser(guest);
    setToken(null);
    localStorage.setItem('saferoute_user', JSON.stringify(guest));
    localStorage.removeItem('saferoute_token');
    return guest;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('saferoute_user');
    localStorage.removeItem('saferoute_token');
    return Promise.resolve();
  };

  return (
    <AuthContext.Provider value={{ user, token, login, signup, loginAsGuest, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
