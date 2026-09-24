import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, memberAvatarSrc } from "@/lib/avatars";
import { cn } from "@/lib/utils";

type Member = { full_name: string | null; avatar?: string | null; avatar_url?: string | null };

/** Avatar de un miembro: avatar animado elegido → foto de la cuenta → inicial. */
export function MemberAvatar({ member, className }: { member: Member; className?: string }) {
  const src = memberAvatarSrc(member);
  return (
    <Avatar className={cn("size-10", className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback>{initials(member.full_name)}</AvatarFallback>
    </Avatar>
  );
}
