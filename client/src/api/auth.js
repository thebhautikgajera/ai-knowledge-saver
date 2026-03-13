import http from './http';

export const register = async (payload) => {
  try {
    const res = await http.post('/auth/register', payload);
    if (!res.data.ok || !res.data.data) {
      throw new Error(res.data.error ?? 'Registration failed');
    }
    return res.data.data;
  } catch (err) {
    const error = err;
    const serverMessage = error.response?.data?.error;

    const fallback =
      error.response?.status === 429
        ? 'Too many registration attempts. Please wait a moment and try again.'
        : 'Registration failed. Please try again.';

    throw new Error(serverMessage || fallback);
  }
};

export const login = async (payload) => {
  try {
    const res = await http.post('/auth/login', payload);
    if (!res.data.ok || !res.data.data) {
      const error = new Error(res.data.error ?? 'Login failed');
      if (res.data.requiresVerification) {
        error.requiresVerification = true;
      }
      throw error;
    }
    return res.data.data;
  } catch (err) {
    const error = err;
    const serverMessage = error.response?.data?.error;
    const requiresVerification = error.response?.data?.requiresVerification;

    const loginError = new Error(
      serverMessage || 'Login failed. Please check your credentials and try again.'
    );

    if (requiresVerification) {
      loginError.requiresVerification = true;
    }

    if (!serverMessage) {
      const fallback =
        error.response?.status === 429
          ? 'Too many login attempts. Please wait a moment and try again.'
          : 'Login failed. Please check your credentials and try again.';
      loginError.message = fallback;
    }

    throw loginError;
  }
};

export const refresh = async () => {
  try {
    const res = await http.post(
      "/auth/refresh",
      {},
      {
        withCredentials: true,
      }
    );

    if (!res.data.ok || !res.data.data) {
      return null;
    }

    return res.data.data.accessToken;
  } catch {
    return null;
  }
};

export const logout = async () => {
  try {
    await http.post('/auth/logout', {});
  } catch (error) {
    // Ignore logout errors; client state will be cleared regardless
  }
};

export const checkEmailAvailability = async (email) => {
  try {
    const res = await http.get('/auth/check-email', {
      params: { email },
    });
    if (!res.data.ok || res.data.data === undefined) {
      throw new Error(res.data.error ?? 'Unable to check email availability');
    }
    return res.data.data.available;
  } catch (error) {
    // Re-throw so UI layer can distinguish between "unavailable" and "check failed"
    throw error;
  }
};

