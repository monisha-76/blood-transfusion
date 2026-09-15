import { DonorRespond } from './pages/DonorRespond';

// ... (existing imports) ...
// Add after existing imports (line 9 maybe)

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { PublicDonorRegister } from './pages/PublicDonorRegister';
import { PatientDashboard } from './pages/PatientDashboard';
import { DoctorDashboard } from './pages/DoctorDashboard';
import { BloodBankDashboard } from './pages/BloodBankDashboard';
import { DonorDashboard } from './pages/DonorDashboard';
import { HospitalMgmtDashboard } from './pages/HospitalMgmtDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Protected Route Guard Component
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="p-12 text-center text-slate-400 text-sm">Loading user session...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

// Role-based Router Switcher for /dashboard
const DashboardRedirect = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'PATIENT':
      return <PatientDashboard />;
    case 'DOCTOR':
      return <DoctorDashboard />;
    case 'BLOOD_BANK':
      return <BloodBankDashboard />;
    case 'DONOR':
      return <DonorDashboard />;
    case 'HOSPITAL_MANAGEMENT':
      return <HospitalMgmtDashboard />;
    case 'ADMIN':
      return <AdminDashboard />;
    default:
      return <PatientDashboard />;
  }
};

// Main App Layout Wrapper
const AppLayout = ({ children }) => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />
      <div className="flex flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
        {user && <Sidebar />}
        <main className="flex-1 w-full overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppLayout>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/public-donor-register" element={<PublicDonorRegister />} />

            {/* Role Dashboards */}
            <Route path="/dashboard" element={<ProtectedRoute><DashboardRedirect /></ProtectedRoute>} />
            
            <Route path="/patient/dashboard" element={<ProtectedRoute allowedRoles={['PATIENT']}><PatientDashboard /></ProtectedRoute>} />
            
            <Route path="/doctor/patients" element={<ProtectedRoute allowedRoles={['DOCTOR']}><DoctorDashboard /></ProtectedRoute>} />
            <Route path="/doctor/approvals" element={<ProtectedRoute allowedRoles={['DOCTOR']}><DoctorDashboard /></ProtectedRoute>} />
            
            <Route path="/blood-bank/inventory" element={<ProtectedRoute allowedRoles={['BLOOD_BANK', 'HOSPITAL_MANAGEMENT', 'ADMIN']}><BloodBankDashboard /></ProtectedRoute>} />
            
            <Route path="/donor/requests" element={<ProtectedRoute allowedRoles={['DONOR']}><DonorDashboard /></ProtectedRoute>} />
            
            <Route path="/hospital/requests" element={<ProtectedRoute allowedRoles={['HOSPITAL_MANAGEMENT', 'ADMIN']}><HospitalMgmtDashboard /></ProtectedRoute>} />
            <Route path="/hospital/escalated" element={<ProtectedRoute allowedRoles={['HOSPITAL_MANAGEMENT', 'ADMIN']}><HospitalMgmtDashboard /></ProtectedRoute>} />
            
            <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['ADMIN']}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/donor/respond" element={<DonorRespond />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
        <ToastContainer position="bottom-right" theme="dark" autoClose={3000} />
      </Router>
    </AuthProvider>
  );
}
