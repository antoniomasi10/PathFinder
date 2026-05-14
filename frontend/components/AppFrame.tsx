import { ReactNode } from 'react';

type AppFrameProps = {
  children: ReactNode;
  /** Background of the area outside the frame (visible on tablet/desktop). */
  outerBg?: string;
  /** Background of the frame itself. */
  innerBg?: string;
  className?: string;
};

/**
 * Capped phone-shaped frame that keeps the mobile design centered on
 * large screens. Pair with the fluid root font-size in globals.css so
 * proportions scale identically across devices up to the cap (~480px).
 */
export default function AppFrame({
  children,
  outerBg = '#fbf8ff',
  innerBg = '#fbf8ff',
  className = '',
}: AppFrameProps) {
  return (
    <div className="min-h-dvh w-full" style={{ backgroundColor: outerBg }}>
      <div
        className={`mx-auto w-full max-w-[30rem] min-h-dvh ${className}`}
        style={{ backgroundColor: innerBg }}
      >
        {children}
      </div>
    </div>
  );
}
