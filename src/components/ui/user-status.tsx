import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type UserStatusProps = {
  userId: string;
  className?: string;
};

export function UserStatus({ userId, className }: UserStatusProps) {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const { data, error } = await supabase
          .from("users")
          .select("online_at")
          .eq("id", userId)
          .single();

        if (error) {
          console.error("Error fetching user status:", error);
          return;
        }

        // Consider user online if they were active in the last 5 minutes
        setIsOnline(
          !!data?.online_at &&
            new Date(data.online_at).getTime() > Date.now() - 5 * 60 * 1000,
        );
      } catch (error) {
        console.error("Error in fetchStatus:", error);
      }
    };

    if (userId) {
      fetchStatus();

      // Subscribe to changes
      const channel = supabase
        .channel(`user-status-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "users",
            filter: `id=eq.${userId}`,
          },
          (payload) => {
            setIsOnline(
              !!payload.new.online_at &&
                new Date(payload.new.online_at).getTime() >
                  Date.now() - 5 * 60 * 1000,
            );
          },
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    }
  }, [userId]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-background",
              isOnline ? "bg-green-500" : "bg-gray-300",
              className,
            )}
          />
        </TooltipTrigger>
        <TooltipContent side="right" align="center">
          <p>{isOnline ? "Online" : "Offline"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
