type AvatarFields = { ready?: boolean | null; glb_url?: string | null };
export function isReadyAvatar(avatar: AvatarFields | null | undefined): avatar is { ready: true; glb_url: string } {
  const url = avatar?.glb_url?.trim().toLowerCase() ?? "";
  return Boolean(avatar?.ready && url && !["placeholder.glb", "avatar-male.glb", "avatar-female.glb"].some((name) => url.includes(name)));
}
