'use client';

import { GoogleLogin } from '@react-oauth/google';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { bffPost, setAccessToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useLanguage } from '@/lib/language';

export default function GoogleAuthButton() {
  const [error, setError] = useState('');
  const router = useRouter();
  const { setUser } = useAuth();
  const { t } = useLanguage();

  const handleSuccess = async (credentialResponse: any) => {
    setError('');
    try {
      const { data } = await bffPost('/api/bff/google', {
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
      setError(err.response?.data?.error || t.auth.googleError);
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
          onError={() => setError(t.auth.googleError)}
          theme="filled_black"
          size="large"
          width="100%"
          text="continue_with"
        />
      </div>
    </div>
  );
}
