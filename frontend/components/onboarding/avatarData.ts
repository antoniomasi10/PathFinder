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

export const DEFAULT_AVATAR_ID = 'avatar_01';

export function getAvatar(id: string): AvatarOption {
  return AVATARS.find((a) => a.id === id) ?? AVATARS[0];
}
