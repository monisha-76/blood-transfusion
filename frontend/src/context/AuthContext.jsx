import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser, loginUser, registerUser } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('jeevansetu_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('jeevansetu_token'));
  const [linkedProfile, setLinkedProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      if (token) {
        try {
          const res = await getCurrentUser();
          if (res.success) {
            setUser(res.data.user);
            setLinkedProfile(res.data.linkedProfile);
            localStorage.setItem('jeevansetu_user', JSON.stringify(res.data.user));
          }
        } catch (err) {
          console.error('Failed to fetch user session:', err);
          logout();
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, [token]);

  const login = async (credentials) => {
    const res = await loginUser(credentials);
    if (res.success) {
      setToken(res.data.token);
      setUser(res.data.user);
      localStorage.setItem('jeevansetu_token', res.data.token);
      localStorage.setItem('jeevansetu_user', JSON.stringify(res.data.user));
    }
    return res;
  };

  const register = async (userData) => {
    const res = await registerUser(userData);
    if (res.success) {
      setToken(res.data.token);
      setUser(res.data.user);
      localStorage.setItem('jeevansetu_token', res.data.token);
      localStorage.setItem('jeevansetu_user', JSON.stringify(res.data.user));
    }
    return res;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setLinkedProfile(null);
    localStorage.removeItem('jeevansetu_token');
    localStorage.removeItem('jeevansetu_user');
  };

  return (
    <AuthContext.Provider value={{ user, token, linkedProfile, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
