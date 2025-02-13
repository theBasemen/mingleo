import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreVertical, UserPlus, Trash2, Settings } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { InviteDialog } from "./invite-dialog";
import { ChatSettingsDialog } from "./chat-settings-dialog";
import type { Database } from "@/types/database.types";

type Chat = Database["public"]["Tables"]["chats"]["Row"];

interface ChatOptionsProps {
  chatId: string;
  chat: Chat;
  onDeleteStart?: () => void;
  onDeleteSuccess?: () => void;
  hideDelete?: boolean;
  isParticipant?: boolean;
}

export function ChatOptions({
  chatId,
  chat,
  onDeleteStart,
  onDeleteSuccess,
  hideDelete,
  isParticipant,
}: ChatOptionsProps) {
  const navigate = useNavigate();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { user } = useAuth();

  const leaveChat = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm("Are you sure you want to leave this chat?")) return;

    try {
      onDeleteStart?.();

      // Just update the left_at timestamp instead of deleting
      const { error: participantError } = await supabase
        .from("chat_participants")
        .update({ left_at: new Date().toISOString() })
        .eq("chat_id", chatId)
        .eq("user_id", user?.id);

      if (participantError) {
        console.error("Error leaving chat:", participantError);
        throw participantError;
      }

      onDeleteSuccess?.();
      navigate("/");
    } catch (error) {
      console.error("Error in leaving process:", error);
      alert("Failed to leave chat. Please try again.");
    }
  };

  const deleteChat = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm("Are you sure you want to delete this chat?")) return;

    try {
      onDeleteStart?.();

      // With CASCADE, we only need to delete the chat
      const { error: chatError } = await supabase
        .from("chats")
        .delete()
        .eq("id", chatId);

      if (chatError) {
        console.error("Error deleting chat:", chatError);
        throw chatError;
      }

      onDeleteSuccess?.();
      navigate("/");
    } catch (error) {
      console.error("Error in deletion process:", error);
      alert("Failed to delete chat. Please try again.");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="mobile-touch-target"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <DropdownMenuItem
            className="mobile-touch-target"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setInviteOpen(true);
            }}
          >
            <UserPlus className="mr-2 h-5 w-5" />
            Invite User
          </DropdownMenuItem>
          {chat.created_by === user?.id && (
            <DropdownMenuItem
              className="mobile-touch-target"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setSettingsOpen(true);
              }}
            >
              <Settings className="mr-2 h-5 w-5" />
              Settings
            </DropdownMenuItem>
          )}
          {chat.created_by === user?.id ? (
            !hideDelete && (
              <DropdownMenuItem
                className="text-destructive mobile-touch-target"
                onClick={deleteChat}
              >
                <Trash2 className="mr-2 h-5 w-5" />
                Delete Chat
              </DropdownMenuItem>
            )
          ) : (
            <DropdownMenuItem
              className="text-destructive mobile-touch-target"
              onClick={leaveChat}
            >
              <Trash2 className="mr-2 h-5 w-5" />
              Leave Chat
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <InviteDialog
        chatId={chatId}
        chatName={chat.name}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
      {chat.created_by === user?.id && (
        <ChatSettingsDialog
          chat={chat}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        />
      )}
    </>
  );
}
