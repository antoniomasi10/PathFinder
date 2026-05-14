'use client';

import { isValidImageUrl } from '@/lib/urlValidation';
import { ChevronLeft, MoreVertical } from '@/components/icons';

type IndividualProps = {
  type: 'individual';
  user: { id: string; name: string; avatar?: string; university?: string };
  onBack: () => void;
  onPress: () => void;
  onMore?: () => void;
  loading?: boolean;
};

type GroupProps = {
  type: 'group';
  group: { id: string; name: string; image?: string };
  onBack: () => void;
  onPress: () => void;
  onMore?: () => void;
  loading?: boolean;
};

type ChatHeaderProps = IndividualProps | GroupProps;

export default function ChatHeader(props: ChatHeaderProps) {
  const { type, onBack, onPress, onMore, loading } = props;

  const name = type === 'individual' ? props.user.name : props.group.name;
  const avatar = type === 'individual' ? props.user.avatar : props.group.image;
  const university = type === 'individual' ? props.user.university : undefined;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 70,
        height: '4rem',
        backgroundColor: '#fbf8ff',
        borderBottom: '1px solid rgba(172,176,206,0.3)',
        boxShadow: '0px 1px 1px rgba(0,0,0,0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: '0.4375rem',
        paddingRight: '1rem',
        paddingBottom: 1,
      }}
    >
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.5rem',
          borderRadius: '624.9375rem',
          flexShrink: 0,
        }}
      >
        <ChevronLeft size={16} strokeWidth={2} color="#2c3149" />
      </button>

      {/* Avatar */}
      <button
        onClick={onPress}
        style={{
          flexShrink: 0,
          width: '2rem',
          height: '2rem',
          borderRadius: '50%',
          overflow: 'hidden',
          border: '1px solid rgba(172,176,206,0.2)',
          boxShadow: '0px 1px 2px rgba(0,0,0,0.05)',
          backgroundColor: '#dde1ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {loading ? (
          <div style={{ width: '2rem', height: '2rem', backgroundColor: '#e4e7ff', borderRadius: '50%' }} />
        ) : avatar && isValidImageUrl(avatar) ? (
          <img src={avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 700, fontSize: '0.8125rem', color: '#4a4bd7' }}>
            {name?.[0] ?? '?'}
          </span>
        )}
      </button>

      {/* Name + university */}
      <button
        onClick={onPress}
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          paddingLeft: '0.625rem',
          paddingTop: '0.1875rem',
        }}
      >
        {loading ? (
          <div style={{ height: '0.875rem', width: '6.25rem', backgroundColor: '#e4e7ff', borderRadius: '0.25rem' }} />
        ) : (
          <>
            <span
              style={{
                fontFamily: 'var(--font-plus-jakarta)',
                fontWeight: 600,
                fontSize: '0.875rem',
                lineHeight: '1.09375rem',
                color: '#2c3149',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}
            >
              {name}
            </span>
            {university && (
              <span
                style={{
                  fontFamily: 'var(--font-plus-jakarta)',
                  fontWeight: 500,
                  fontSize: '0.625rem',
                  lineHeight: '0.78125rem',
                  color: '#595e78',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                }}
              >
                {university}
              </span>
            )}
          </>
        )}
      </button>

      {/* 3-dots menu */}
      <button
        onClick={onMore}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.5rem',
          borderRadius: '624.9375rem',
          flexShrink: 0,
        }}
      >
        <MoreVertical size={16} color="#2c3149" />
      </button>
    </div>
  );
}
