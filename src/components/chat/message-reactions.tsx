import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Smile } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const EMOJI_LIST = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

type MessageReactionsProps = {
  messageId: string;
  reactions: {
    emoji: string;
    count: number;
    hasReacted: boolean;
    users?: { id: string; display_name: string }[];
  }[];
  onReactionChange: () => void;
};

export function MessageReactions({
  messageId,
  reactions,
  onReactionChange,
}: MessageReactionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  const handleReaction = async (emoji: string) => {
    if (!user) return;

    try {
      const existingReaction = reactions.find(
        (r) => r.emoji === emoji && r.hasReacted,
      );

      if (existingReaction) {
        // Remove reaction
        await supabase
          .from("reactions")
          .delete()
          .eq("message_id", messageId)
          .eq("user_id", user.id)
          .eq("emoji", emoji);
      } else {
        // Add reaction
        await supabase.from("reactions").insert({
          message_id: messageId,
          user_id: user.id,
          emoji,
        });
      }

      onReactionChange();
    } catch (error) {
      console.error("Error toggling reaction:", error);
    }

    setIsOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1">
      {reactions.map(
        (reaction) =>
          reaction.count > 0 && (
            <TooltipProvider key={reaction.emoji}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={reaction.hasReacted ? "secondary" : "ghost"}
                    size="sm"
                    className="h-8 px-2 text-xs mobile-touch-target"
                    onClick={() => handleReaction(reaction.emoji)}
                  >
                    {reaction.emoji} {reaction.count}
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  align="center"
                  className="max-w-[200px]"
                >
                  <p className="text-xs">
                    {reaction.users
                      ?.map((user) => user.display_name)
                      .join(", ")}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ),
      )}

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 w-6 p-0",
              isOpen && "bg-accent text-accent-foreground",
            )}
          >
            <Smile className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-full p-2"
          side="top"
          align="start"
          alignOffset={-20}
        >
          <div className="flex flex-wrap gap-1">
            {EMOJI_LIST.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                className="h-10 px-3 mobile-touch-target"
                onClick={() => handleReaction(emoji)}
              >
                {emoji}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
