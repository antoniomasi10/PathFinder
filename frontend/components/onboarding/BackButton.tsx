'use client';

interface Props {
  onClick: () => void;
}

export default function BackButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded-full hover:bg-[#e6e7f8] transition-colors"
      style={{ width: 36, height: 36 }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M13 4l-6 6 6 6" stroke="#595e78" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
