import API from './api';

export const getMyDonorProfile = async () => {
  const res = await API.get('/donors/me');
  return res.data;
};

export const updateDonorProfile = async (data) => {
  const res = await API.put('/donors/me', data);
  return res.data;
};

export const getPendingDonorRequests = async () => {
  const res = await API.get('/donors/requests');
  return res.data;
};

export const respondToDonorRequest = async (bloodRequestId, action) => {
  const res = await API.post('/donors/respond', { bloodRequestId, action });
  return res.data;
};

export const publicRegisterDonor = async (donorData) => {
  const res = await API.post('/donors/public-register', donorData);
  return res.data;
};
