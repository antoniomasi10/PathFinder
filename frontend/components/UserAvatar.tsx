'use client';

import { useState, useEffect } from 'react';
import { isValidImageUrl } from '@/lib/urlValidation';

interface UserAvatarProps {
  avatar?: string | null;
  name: string;
  size?: number;
  className?: string;
}

/**
 * Renders a user's avatar in a white circular frame.
 * Falls back to initials on gradient if no avatar is set.
 */
export default function UserAvatar({ avatar, name, size = 40, className = '' }: UserAvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [avatar]);

  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const hasValidImage = isValidImageUrl(avatar) && !imgFailed;

  return (
    <div
      className={`rounded-full flex items-center justify-center overflow-hidden shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: hasValidImage ? '#FFFFFF' : undefined,
        background: !hasValidImage ? 'linear-gradient(135deg, #4F46E5, #7C3AED)' : undefined,
      }}
    >
      {hasValidImage ? (
        <img
          src={avatar!}
          alt=""
          className="w-full h-full rounded-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <span
          className="text-white font-bold"
          style={{ fontSize: size * 0.35 }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
