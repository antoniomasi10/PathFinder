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
        height: 64,
        backgroundColor: '#fbf8ff',
        borderBottom: '1px solid rgba(172,176,206,0.3)',
        boxShadow: '0px 1px 1px rgba(0,0,0,0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingLeft: 7,
        paddingRight: 16,
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
          padding: 8,
          borderRadius: 9999,
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
          width: 32,
          height: 32,
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
          <div style={{ width: 32, height: 32, backgroundColor: '#e4e7ff', borderRadius: '50%' }} />
        ) : avatar && isValidImageUrl(avatar) ? (
          <img src={avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontFamily: 'var(--font-plus-jakarta)', fontWeight: 700, fontSize: 13, color: '#4a4bd7' }}>
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
          paddingLeft: 10,
          paddingTop: 3,
        }}
      >
        {loading ? (
          <div style={{ height: 14, width: 100, backgroundColor: '#e4e7ff', borderRadius: 4 }} />
        ) : (
          <>
            <span
              style={{
                fontFamily: 'var(--font-plus-jakarta)',
                fontWeight: 600,
                fontSize: 14,
                lineHeight: '17.5px',
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
                  fontSize: 10,
                  lineHeight: '12.5px',
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
          padding: 8,
          borderRadius: 9999,
          flexShrink: 0,
        }}
      >
        <MoreVertical size={16} color="#2c3149" />
      </button>
    </div>
  );
}
