import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { UserStatus } from "./user-status";
import { useNavigate } from "react-router-dom";

interface UserAvatarProps {
  userId: string;
  className?: string;
  showStatus?: boolean;
  clickable?: boolean;
}

export function UserAvatar({
  userId,
  className,
  showStatus = false,
  clickable = true,
}: UserAvatarProps) {
  const [displayName, setDisplayName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("display_name, avatar_url")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error fetching user:", error);
        return;
      }

      setDisplayName(data.display_name);

      if (data.avatar_url) {
        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(data.avatar_url);
        if (urlData?.publicUrl) {
          setAvatarUrl(urlData.publicUrl);
        }
      }
    };

    fetchUser();
  }, [userId]);

  return (
    <div
      className={cn(
        "relative",
        clickable && "cursor-pointer hover:opacity-80 transition-opacity",
        className,
      )}
      onClick={(e) => {
        if (clickable) {
          e.stopPropagation();
          e.preventDefault();
          navigate(`/profile/${userId}`);
        }
      }}
    >
      <Avatar className={className}>
        <AvatarImage
          src={!imageError ? avatarUrl || undefined : undefined}
          onError={() => setImageError(true)}
        />
        <AvatarFallback>{displayName?.[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>
      {showStatus && <UserStatus userId={userId} />}
    </div>
  );
}
