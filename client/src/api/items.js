import http from './http';

export const createItem = async (payload) => {
  try {
    const res = await http.post('/items', payload);
    if (!res.data.ok || !res.data.data) {
      throw new Error(res.data.error ?? 'Failed to save item');
    }
    return res.data.data;
  } catch (err) {
    const error = err;
    const serverMessage = error.response?.data?.error;
    throw new Error(serverMessage || 'Failed to save item. Please try again.');
  }
};

export const getItems = async (params) => {
  try {
    const res = await http.get('/items', {
      params,
    });
    if (!res.data.ok || !Array.isArray(res.data.data)) {
      throw new Error(res.data.error ?? 'Failed to fetch items');
    }
    return res.data.data;
  } catch (err) {
    const error = err;
    const serverMessage = error.response?.data?.error;
    throw new Error(
      serverMessage || 'Failed to fetch items. Please try again.'
    );
  }
};

export const deleteItem = async (id) => {
  try {
    const res = await http.delete(`/items/${id}`);
    if (!res.data.ok || !res.data.data) {
      throw new Error(res.data.error ?? 'Failed to delete item');
    }
    return res.data.data;
  } catch (err) {
    const error = err;
    const serverMessage = error.response?.data?.error;
    throw new Error(
      serverMessage || 'Failed to delete item. Please try again.'
    );
  }
};

