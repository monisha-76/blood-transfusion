import API from './api';

export const getMyPatientProfile = async () => {
  const res = await API.get('/patients/me');
  return res.data;
};

export const createOrUpdatePatient = async (data) => {
  const res = await API.post('/patients', data);
  return res.data;
};

export const getAllPatients = async () => {
  const res = await API.get('/patients');
  return res.data;
};
