// App-wide auth state. Drives which navigation stack is shown.

import React, { createContext, useContext, useEffect, useState } from 'react';

import * as auth from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // 'loading' | 'signedIn' | 'signedOut'
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let active = true;
    (async () => {
      auth.installInterceptors();
      auth.setSessionExpiredHandler(() => setStatus('signedOut'));
      await auth.hydrate();
      if (active) setStatus(auth.isAuthenticated() ? 'signedIn' : 'signedOut');
    })();
    return () => {
      active = false;
    };
  }, []);

  const value = {
    status,
    user: auth.getCurrentUser(),
    signIn: async (username, password) => {
      await auth.login(username, password);
      setStatus('signedIn');
    },
    register: auth.register,
    signOut: async () => {
      await auth.logout();
      setStatus('signedOut');
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
