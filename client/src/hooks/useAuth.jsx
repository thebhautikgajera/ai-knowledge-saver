/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';
import { login as apiLogin, logout as apiLogout, refresh as apiRefresh } from '../api/auth';
import { setAuthTokenHandlers } from '../api/http';
import { useDispatch } from 'react-redux';
import { authClear, authSetCredentials } from '../slices/authSlice';

const AuthContext = createContext(undefined);

const STORAGE_KEY = 'cinescope-auth';

export const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const refreshAttempted = useRef(false);

  const saveState = useCallback(
    (nextUser, nextToken) => {
      if (nextUser && nextToken) {
        const payload = {
          user: nextUser,
          accessToken: nextToken,
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        dispatch(authSetCredentials(payload));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
        dispatch(authClear());
      }
    },
    [dispatch]
  );

  const clearAuth = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    window.localStorage.removeItem(STORAGE_KEY);
    dispatch(authClear());
  }, [dispatch]);

  // Load from localStorage on mount
  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);

        if (!raw) {
          setLoading(false);
          return;
        }

        const parsed = JSON.parse(raw);

        // Hydrate UI with stored auth state
        setUser(parsed.user);
        setAccessToken(parsed.accessToken);
        // Hydrate redux auth state immediately so RTK Query services
        // can attach Authorization headers even if refresh is unavailable.
        saveState(parsed.user, parsed.accessToken);

        // Try to refresh in the background, but do NOT force a logout
        // on page load if refresh fails. This avoids the situation where
        // a temporarily missing/blocked refresh cookie logs the user out
        // even though their existing access token is still accepted.
        //
        // If the access token ever becomes invalid, the axios response
        // interceptor will see a 401, call refreshAccessToken, and that
        // path WILL clear auth if refresh fails – keeping client & server
        // in sync without surprise logouts on simple reloads.
        const newToken = await apiRefresh();

        if (newToken) {
          setAccessToken(newToken);
          saveState(parsed.user, newToken);
        }
        // If newToken is null, we simply continue using the stored token
        // until the server explicitly rejects it.
      } catch (error) {
        // Swallow refresh errors here; hard failures are handled via
        // axios interceptor flow when the server actually rejects a request.
      } finally {
        setLoading(false);
      }
    };

    if (refreshAttempted.current) return;
    refreshAttempted.current = true;

    loadStoredAuth();
  }, [saveState]);

  const login = useCallback(
    async (email, password) => {
      const { accessToken: token, user: loggedInUser } = await apiLogin({
        email,
        password,
      });
      setUser(loggedInUser);
      setAccessToken(token);
      saveState(loggedInUser, token);
    },
    [saveState]
  );

  // Registration creates an account and sends a verification email; it does NOT log the user in.
  const register = useCallback(async (email, password) => {
    const { register: apiRegister } = await import('../api/auth');
    await apiRegister({
      email,
      password,
    });
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    clearAuth();
  }, [clearAuth]);

  const getAccessToken = useCallback(() => accessToken, [accessToken]);

  const refreshAccessToken = useCallback(
    async () => {
      const newToken = await apiRefresh();

      if (newToken) {
        setAccessToken(newToken);
        saveState(user, newToken);
      } else {
        clearAuth();
      }

      return newToken;
    },
    [clearAuth, saveState, user]
  );

  // Set up token handlers for HTTP interceptor
  useEffect(() => {
    setAuthTokenHandlers({
      getAccessToken,
      refreshAccessToken,
    });
  }, [getAccessToken, refreshAccessToken]);

  const value = {
    user,
    accessToken,
    loading,
    login,
    logout,
    register,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
};

