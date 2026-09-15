import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// This component handles the deep link from donor email.
// It verifies the token with the backend and then either redirects
// to the donor dashboard (if already logged in) or to the login page
// preserving the original token for post‑login redirection.

export const DonorRespond = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) {
      // No token – just go to dashboard or home
      navigate('/dashboard');
      return;
    }

    // Verify token with backend
    fetch(`${process.env.REACT_APP_API_URL || ''}/api/donors/verify-link?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Invalid token');
        // We don't actually need the response body for now
        return res.json();
      })
      .then(() => {
        if (user) {
          // Already logged in – go directly to donor dashboard (or specific request view)
          navigate('/donor/requests');
        } else {
          // Not logged in – redirect to login preserving the deep link
          const redirect = encodeURIComponent(`/donor/respond?token=${encodeURIComponent(token)}`);
          navigate(`/login?redirect=${redirect}`);
        }
      })
      .catch(() => {
        // Invalid token – fallback to dashboard
        navigate('/dashboard');
      });
  }, [navigate, user]);

  // Optionally render a loading indicator while verification is in progress
  return (
    <div className="flex items-center justify-center min-h-screen text-slate-400">
      Verifying link...
    </div>
  );
};
