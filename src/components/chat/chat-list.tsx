import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";

type Chat = Database["public"]["Tables"]["chats"]["Row"];

interface ChatListProps {
  chats: Chat[];
  selectedChat: Chat | null;
  onSelectChat: (chat: Chat) => void;
}

export default function ChatList({
  chats,
  selectedChat,
  onSelectChat,
}: ChatListProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      {chats.map((chat) => (
        <button
          key={chat.id}
          onClick={() => onSelectChat(chat)}
          className={cn(
            "w-full p-4 text-left hover:bg-accent transition-colors",
            selectedChat?.id === chat.id && "bg-accent",
          )}
        >
          <h3 className="font-medium truncate">{chat.name}</h3>
          {/* Add last message preview, timestamp, etc. here */}
        </button>
      ))}
    </div>
  );
}
