'use client';

import { GoogleLogin } from '@react-oauth/google';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api, { setAccessToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function GoogleAuthButton() {
  const [error, setError] = useState('');
  const router = useRouter();
  const { setUser } = useAuth();

  const handleSuccess = async (credentialResponse: any) => {
    setError('');
    try {
      const { data } = await api.post('/auth/google', {
        idToken: credentialResponse.credential,
      });
      setAccessToken(data.accessToken);
      setUser(data.user);

      if (!data.user.profileCompleted) {
        router.push('/onboarding');
      } else {
        router.push('/home');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Errore durante l\'autenticazione con Google');
    }
  };

  return (
    <div className="w-full">
      {error && (
        <div className="bg-error/10 text-error rounded-xl px-4 py-2 text-sm mb-3">
          {error}
        </div>
      )}
      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => setError('Errore durante l\'autenticazione con Google')}
          theme="filled_black"
          size="large"
          width="100%"
          text="continue_with"
        />
      </div>
    </div>
  );
}
