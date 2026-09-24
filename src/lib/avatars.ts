/**
 * Avatares animados predefinidos (SVG estáticos en public/avatars, ver LICENSE.md).
 * El id se guarda en profiles.avatar.
 */
export const AVATARS = [
  "adventurer-luna",
  "adventurer-mateo",
  "adventurer-sofia",
  "adventurer-diego",
  "adventurer-valentina",
  "adventurer-tomas",
  "adventurer-camila",
  "adventurer-lucas",
  "big-smile-rosa",
  "big-smile-pedro",
  "big-smile-ana",
  "big-smile-jorge",
  "big-smile-lucia",
  "big-smile-carlos",
  "big-smile-elena",
  "big-smile-miguel",
  "fun-emoji-sol",
  "fun-emoji-pico",
  "fun-emoji-nube",
  "fun-emoji-kiwi",
] as const;

export type AvatarId = (typeof AVATARS)[number];

export function isAvatarId(value: unknown): value is AvatarId {
  return typeof value === "string" && (AVATARS as readonly string[]).includes(value);
}

export function avatarPath(id: AvatarId) {
  return `/avatars/${id}.svg`;
}

/** Imagen a mostrar para un miembro: avatar elegido → foto de la cuenta → null (iniciales). */
export function memberAvatarSrc(member: { avatar?: string | null; avatar_url?: string | null }) {
  if (isAvatarId(member.avatar)) return avatarPath(member.avatar);
  return member.avatar_url || null;
}

export function initials(name: string | null | undefined) {
  return (name ?? "?").trim().slice(0, 1).toUpperCase() || "?";
}
