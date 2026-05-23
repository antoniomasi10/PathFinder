'use client';
import { useState, useEffect } from 'react';
import { isValidImageUrl } from '@/lib/urlValidation';

interface Props {
  src?: string | null;
  name?: string;
  size?: number;
  style?: React.CSSProperties;
}

export default function AvatarWithFallback({ src, name, size = 50, style }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => { setFailed(false); }, [src]);

  const showImage = src && isValidImageUrl(src) && !failed;

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      overflow: 'hidden',
      backgroundColor: '#dde1ff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      ...style,
    }}>
      {showImage ? (
        <img
          src={src}
          alt={name}
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : name ? (
        <span style={{
          fontWeight: 700,
          fontSize: Math.round(size * 0.32),
          color: '#595e78',
          fontFamily: 'var(--font-plus-jakarta)',
        }}>
          {name[0]}
        </span>
      ) : (
        <span style={{ fontWeight: 700, fontSize: Math.round(size * 0.32), color: '#acb0ce' }}>?</span>
      )}
    </div>
  );
}
