'use client';

import { isValidImageUrl } from '@/lib/urlValidation';

type IndividualProps = {
  type: 'individual';
  user: { id: string; name: string; avatar?: string; university?: string };
  onBack: () => void;
  onPress: () => void;
  loading?: boolean;
};

type GroupProps = {
  type: 'group';
  group: { id: string; name: string; image?: string };
  onBack: () => void;
  onPress: () => void;
  loading?: boolean;
};

type ChatHeaderProps = IndividualProps | GroupProps;

export default function ChatHeader(props: ChatHeaderProps) {
  const { type, onBack, onPress, loading } = props;

  const name = type === 'individual' ? props.user.name : props.group.name;
  const avatar = type === 'individual' ? props.user.avatar : props.group.image;
  const university = type === 'individual' ? props.user.university : undefined;

  return (
    <div className="flex items-center mb-3">
      {/* Back button */}
      <button
        onClick={onBack}
        className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Clickable avatar + text */}
      <div className="flex items-center cursor-pointer" onClick={onPress}>
        {loading ? (
          <>
            <div className="w-[38px] h-[38px] rounded-full bg-gray-700 animate-pulse shrink-0" />
            <div className="ml-2 flex flex-col justify-center">
              <div className="h-4 bg-gray-700 rounded w-24 animate-pulse" />
            </div>
          </>
        ) : (
          <>
            {avatar && isValidImageUrl(avatar) ? (
              <img
                src={avatar}
                alt={name}
                className="w-[38px] h-[38px] rounded-full shrink-0 object-cover"
              />
            ) : (
              <div className="w-[38px] h-[38px] rounded-full bg-[#6C63FF] flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">{name[0]}</span>
              </div>
            )}
            <div className="ml-2 flex flex-col justify-center">
              <span className="text-white font-semibold text-[15px] truncate max-w-[200px]">
                {name}
              </span>
              {type === 'individual' && university && (
                <span className="text-[#8B8FA8] text-xs truncate max-w-[200px]">
                  {university}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
