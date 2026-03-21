// ---------- Avatar Data ----------

export interface AvatarOption {
  id: string;
  blindfolded: string;
  revealed: string;
  video: string;
}

export const AVATARS: AvatarOption[] = Array.from({ length: 21 }, (_, i) => {
  const num = String(i + 1).padStart(2, '0');
  return {
    id: `avatar_${num}`,
    blindfolded: `/avatars/blindfolded/avatar_${num}.png`,
    revealed: `/avatars/revealed/avatar_${num}.png`,
    video: `/avatars/videos/avatar_${num}.mp4`,
  };
});

export const BG_COLORS = [
  { id: 'purple', hex: '#6C63FF', label: 'Viola' },
  { id: 'dark', hex: '#0D1117', label: 'Scuro' },
  { id: 'teal', hex: '#3DD68C', label: 'Verde acqua' },
  { id: 'blue', hex: '#4A9EFF', label: 'Blu' },
  { id: 'orange', hex: '#FF8C42', label: 'Arancione' },
  { id: 'pink', hex: '#FF6B9D', label: 'Rosa' },
  { id: 'red', hex: '#FF4444', label: 'Rosso' },
  { id: 'green', hex: '#2ECC71', label: 'Verde' },
  { id: 'yellow', hex: '#F1C40F', label: 'Giallo' },
  { id: 'black', hex: '#000000', label: 'Nero' },
] as const;

export type BgColor = (typeof BG_COLORS)[number];

export const DEFAULT_AVATAR_ID = 'avatar_01';
export const DEFAULT_BG_COLOR = '#6C63FF';

export function getAvatar(id: string): AvatarOption {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}
