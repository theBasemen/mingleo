import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, Plus } from "lucide-react";
import ChatList from "./chat-list";
import ChatView from "./chat-view";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database.types";

type Chat = Database["public"]["Tables"]["chats"]["Row"];

export default function ChatLayout() {
  const { signOut, user } = useAuth();
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);

  useEffect(() => {
    if (!user) return;

    // Fetch initial chats
    const fetchChats = async () => {
      const { data, error } = await supabase
        .from("chats")
        .select("*")
        .eq("created_by", user.id)
        .order("created_at", { ascending: false });

      if (error) console.error("Error fetching chats:", error);
      else setChats(data || []);
    };

    fetchChats();

    // Subscribe to new chats
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

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <h1 className="text-xl font-semibold">Chats</h1>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={() => {}}
            >
              <Plus className="h-5 w-5" />
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
        <ChatList
          chats={chats}
          selectedChat={selectedChat}
          onSelectChat={setSelectedChat}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {selectedChat ? (
          <ChatView />
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-muted-foreground">
              Select a chat or start a new conversation
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
