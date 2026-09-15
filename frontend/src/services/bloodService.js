import API from './api';

export const getBloodInventory = async () => {
  const res = await API.get('/blood-bank/inventory');
  return res.data;
};

export const addBloodInventory = async (data) => {
  const res = await API.post('/blood-bank/inventory', data);
  return res.data;
};

export const purgeExpiredInventory = async () => {
  const res = await API.post('/blood-bank/inventory/purge-expired');
  return res.data;
};

export const getBloodRequests = async () => {
  const res = await API.get('/blood-requests');
  return res.data;
};

export const getEscalatedCases = async () => {
  const res = await API.get('/blood-requests/escalated');
  return res.data;
};

export const createBloodRequest = async (data) => {
  const res = await API.post('/blood-requests', data);
  return res.data;
};

export const retriggerSearch = async (requestId) => {
  const res = await API.post(`/blood-requests/${requestId}/search`);
  return res.data;
};
