import { useEffect, useState } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, Settings } from "lucide-react";
import { ChatOptions } from "./chat-options";
import { NewChatDialog } from "./new-chat-dialog";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import type { Database } from "@/types/database.types";

type Chat = Database["public"]["Tables"]["chats"]["Row"];

export default function Lobby() {
  const { signOut, user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const fetchChats = async () => {
      // First get all chats where user is creator
      const { data: createdChats, error: createdError } = await supabase
        .from("chats")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (createdError) {
        console.error("Error fetching created chats:", createdError);
        return;
      }

      // Then get all chats where user is participant
      const { data: participantData, error: participantError } = await supabase
        .from("chat_participants")
        .select("chat_id")
        .eq("user_id", user.id);

      if (participantError) {
        console.error("Error fetching participant data:", participantError);
        setChats(createdChats || []);
        return;
      }

      // Get the actual chat data for participated chats
      const participatedChatIds = participantData.map((p) => p.chat_id);
      if (participatedChatIds.length > 0) {
        const { data: participatedChats, error: participatedError } =
          await supabase
            .from("chats")
            .select("*")
            .in("id", participatedChatIds)
            .order("created_at", { ascending: false });

        if (participatedError) {
          console.error(
            "Error fetching participated chats:",
            participatedError,
          );
          setChats(createdChats || []);
          return;
        }

        // Combine and deduplicate chats
        const allChats = [
          ...(createdChats || []),
          ...(participatedChats || []),
        ];
        const uniqueChats = Array.from(
          new Map(allChats.map((chat) => [chat.id, chat])).values(),
        );
        setChats(
          uniqueChats.sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime(),
          ),
        );
      } else {
        setChats(createdChats || []);
      }
    };

    fetchChats();

    const chatsSubscription = supabase
      .channel("chats")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chats",
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setChats((current) => [payload.new as Chat, ...current]);
          } else if (payload.eventType === "DELETE") {
            setChats((current) =>
              current.filter((chat) => chat.id !== payload.old.id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      chatsSubscription.unsubscribe();
    };
  }, [user]);

  const handleChatClick = (e: React.MouseEvent, chatId: string) => {
    // Don't navigate if we're deleting this chat
    if (deletingChatId === chatId) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    navigate(`/chat/${chatId}`);
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b safe-top">
        <div className="flex items-center justify-between p-3 sm:p-4">
          <h1 className="text-xl font-semibold">Mingleo</h1>
          <div className="flex gap-2">
            <NewChatDialog />
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => navigate("/profile")}
            >
              <Settings className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => signOut()}
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Chat List */}
      <PullToRefresh
        onRefresh={async () => {
          if (!user) return;
          const { data, error } = await supabase
            .from("chats")
            .select("*")
            .eq("created_by", user.id)
            .order("created_at", { ascending: false });

          if (error) console.error("Error refreshing chats:", error);
          else setChats(data || []);
        }}
      >
        <div className="divide-y">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className="w-full p-2 sm:p-4 text-left hover:bg-accent transition-colors flex items-center space-x-2 sm:space-x-4"
              onClick={(e) => handleChatClick(e, chat.id)}
            >
              <div className="flex-1 flex items-center space-x-4">
                <UserAvatar
                  userId={chat.created_by}
                  className="w-12 h-12"
                  showStatus
                />
                <div className="flex-1 text-left">
                  <h3 className="font-medium">{chat.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Tap to open chat
                  </p>
                </div>
              </div>
              <div>
                <ChatOptions
                  chatId={chat.id}
                  chat={chat}
                  onDeleteStart={() => setDeletingChatId(chat.id)}
                  onDeleteSuccess={() => {
                    setDeletingChatId(null);
                    setChats((current) =>
                      current.filter((c) => c.id !== chat.id),
                    );
                  }}
                  hideDelete={false}
                  isParticipant={chat.created_by !== user?.id}
                />
              </div>
            </div>
          ))}
        </div>
      </PullToRefresh>
    </div>
  );
}
