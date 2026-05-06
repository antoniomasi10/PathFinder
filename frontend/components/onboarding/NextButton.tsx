'use client';

interface Props {
  disabled: boolean;
  onClick: () => void;
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 8h12M10 4l4 4-4 4" stroke="#fbf7ff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function NextButton({ disabled, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-2 bg-[#615fe2] text-[#fbf7ff] rounded-[24px] py-4 font-bold text-base transition-colors disabled:opacity-40 hover:bg-[#5451d0]"
      style={{
        fontFamily: 'var(--font-plus-jakarta)',
        filter: disabled ? 'none' : 'drop-shadow(0px 4px 7px rgba(74,75,215,0.39))',
      }}
    >
      <span>Avanti</span>
      <ArrowRightIcon />
    </button>
  );
}
