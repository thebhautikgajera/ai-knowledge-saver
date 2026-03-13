import { createSlice } from '@reduxjs/toolkit';

// Redux copy of auth state (source of truth is AuthProvider).

const initialState = {
  user: null,
  accessToken: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    authSetCredentials: (state, action) => {
      state.user = action.payload.user;
      state.accessToken = action.payload.accessToken;
    },
    authClear: (state) => {
      state.user = null;
      state.accessToken = null;
    },
  },
});

export const { authSetCredentials, authClear } = authSlice.actions;

export default authSlice.reducer;

