import { useCallback, useEffect, useRef, useState } from "react";
import { setupMessageListener } from "@/lib/notifications";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Send,
  Image,
  X,
  Paperclip,
  AlertCircle,
} from "lucide-react";
import { ChatOptions } from "./chat-options";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { PullToRefresh } from "@/components/ui/pull-to-refresh";
import { UserAvatar } from "@/components/ui/user-avatar";
import { MessageReactions } from "./message-reactions";
import type { Database } from "@/types/database.types";

type Chat = Database["public"]["Tables"]["chats"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"] & {
  reactions?: {
    emoji: string;
    count: number;
    hasReacted: boolean;
    users?: { id: string; display_name: string }[];
  }[];
};

const EMOJI_LIST = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export default function ChatView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromInvite = location.state?.fromInvite;
  const [chat, setChat] = useState<Chat | null>(null);
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isDeleted, setIsDeleted] = useState(false);

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_FILE_TYPES = {
    image: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    document: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "application/zip",
    ],
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!id || !user) return;

    // If we're coming from an invitation, clear the state
    if (fromInvite) {
      window.history.replaceState({}, "");
    }

    const fetchChat = async () => {
      const { data, error } = await supabase
        .from("chats")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("Error fetching chat:", error);
        if (error.code === "PGRST116") {
          setIsDeleted(true);
        }
        return;
      }

      setChat(data);
    };

    fetchChat();

    const chatSubscription = supabase
      .channel(`chat:${id}`)
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "chats",
          filter: `id=eq.${id}`,
        },
        () => {
          setIsDeleted(true);
        },
      )
      .subscribe();

    return () => {
      chatSubscription.unsubscribe();
    };
  }, [id, user, fromInvite]);

  const fetchMessages = useCallback(async () => {
    if (!chat || !user) return;

    try {
      // First check if we're a participant
      const { data: participant } = await supabase
        .from("chat_participants")
        .select("*")
        .eq("chat_id", chat.id)
        .eq("user_id", user.id)
        .single();

      // If not a participant or previously left, add/update participant record
      if (!participant || participant.left_at) {
        await supabase.from("chat_participants").upsert(
          {
            chat_id: chat.id,
            user_id: user.id,
            role: chat.created_by === user.id ? "owner" : "member",
            joined_at: new Date().toISOString(),
            left_at: null,
          },
          {
            onConflict: "chat_id,user_id",
          },
        );
      }

      const { data: messages, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chat.id)
        .order("created_at", { ascending: true });

      if (messagesError) {
        console.error("Error fetching messages:", messagesError);
        return;
      }

      let reactions = [];
      // Only fetch reactions if there are messages
      if (messages && messages.length > 0) {
        // First get all reactions
        const { data: reactionsData, error: reactionsError } = await supabase
          .from("reactions")
          .select("*")
          .in(
            "message_id",
            messages.map((m) => m.id),
          );

        if (reactionsError) {
          console.error("Error fetching reactions:", reactionsError);
          return;
        }

        // Then get user info for those reactions
        const userIds = [
          ...new Set(reactionsData?.map((r) => r.user_id) || []),
        ];
        if (userIds.length > 0) {
          const { data: usersData, error: usersError } = await supabase
            .from("users")
            .select("id, display_name")
            .in("id", userIds);

          if (usersError) {
            console.error("Error fetching users:", usersError);
            return;
          }

          // Map users to reactions
          reactions =
            reactionsData?.map((reaction) => ({
              ...reaction,
              users: usersData?.find((u) => u.id === reaction.user_id),
            })) || [];
        }
      }

      const processedMessages = messages?.map((message) => {
        const messageReactions = reactions?.filter(
          (r) => r.message_id === message.id,
        );

        const reactionCounts = EMOJI_LIST.map((emoji) => {
          const emojiReactions =
            messageReactions?.filter((r) => r.emoji === emoji) || [];
          return {
            emoji,
            count: emojiReactions.length,
            hasReacted: emojiReactions.some((r) => r.user_id === user.id),
            users: emojiReactions.map((r) => ({
              id: r.users?.id || r.user_id,
              display_name: r.users?.display_name || "Unknown User",
            })),
          };
        });

        return {
          ...message,
          reactions: reactionCounts,
        };
      });

      setMessages(processedMessages || []);
    } catch (error) {
      console.error("Error in fetchMessages:", error);
    }
  }, [chat, user]);

  useEffect(() => {
    if (!chat || !user) return;

    let messageListener: ((payload: any) => void) | null = null;

    const setupNotifications = () => {
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          messageListener = (payload) => {
            if (payload.data?.chatId && payload.data.chatId !== chat.id) {
              new Notification(payload.notification.title, {
                body: payload.notification.body,
                icon: "/vite.svg",
                data: payload.data,
              });
            }
          };
          setupMessageListener(messageListener);
        }
      }
    };

    setupNotifications();

    // Initial fetch of messages
    fetchMessages();

    const messagesSubscription = supabase
      .channel(`messages:${chat.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chat.id}`,
        },
        (payload) => {
          setMessages((current) => [
            ...current,
            { ...payload.new, reactions: [] },
          ]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chat.id}`,
        },
        (payload) => {
          setMessages((current) =>
            current.filter((m) => m.id !== payload.old.id),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "reactions",
        },
        () => {
          fetchMessages();
        },
      )
      .subscribe();

    return () => {
      messagesSubscription.unsubscribe();
    };
  }, [chat, user, fetchMessages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !selectedFile) || !user || !chat || sending)
      return;

    setFileError("");

    setSending(true);
    try {
      // First ensure user exists in users table
      const { data: existingUser, error: userCheckError } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!existingUser) {
        // Create user record if it doesn't exist
        const { error: userCreateError } = await supabase.from("users").insert({
          id: user.id,
          email: user.email,
          display_name: user.user_metadata?.display_name || user.email,
          online_at: new Date().toISOString(),
        });

        if (userCreateError) {
          console.error("Error creating user:", userCreateError);
          throw userCreateError;
        }
      }

      // Then verify we are a participant or create the participant record
      const { data: participant, error: participantError } = await supabase
        .from("chat_participants")
        .select("*")
        .eq("chat_id", chat.id)
        .eq("user_id", user.id)
        .single();

      if (!participant || participant.left_at) {
        // Add/update as participant if not already or if previously left
        const { error: insertError } = await supabase
          .from("chat_participants")
          .upsert(
            {
              chat_id: chat.id,
              user_id: user.id,
              joined_at: new Date().toISOString(),
              left_at: null,
            },
            {
              onConflict: "chat_id,user_id",
            },
          );

        if (insertError) {
          console.error("Error joining chat:", insertError);
          return;
        }
      }

      let mediaUrl = "";
      let contentType: "text" | "image" | "file" = "text";

      if (selectedFile) {
        const file = selectedFile;
        const fileExt = file.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random()}.${fileExt}`;
        const bucket = ALLOWED_FILE_TYPES.image.includes(file.type)
          ? "chat-images"
          : "chat-files";

        const { error: uploadError, data } = await supabase.storage
          .from(bucket)
          .upload(fileName, file);

        if (uploadError) throw uploadError;
        mediaUrl = data.path;
        contentType = ALLOWED_FILE_TYPES.image.includes(file.type)
          ? "image"
          : "file";
      }

      const { error } = await supabase.from("messages").insert({
        chat_id: chat.id,
        sender_id: user.id,
        content: newMessage.trim(),
        content_type: contentType,
        media_url: mediaUrl || undefined,
      });

      if (error) throw error;
      setNewMessage("");
      setSelectedFile(null);
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  if (isDeleted) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background p-4">
        <h2 className="text-xl font-semibold mb-2">Chat not found</h2>
        <p className="text-muted-foreground mb-4">
          This chat may have been deleted
        </p>
        <Button onClick={() => navigate("/")}>Return to Lobby</Button>
      </div>
    );
  }

  if (!chat) return null;

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b flex items-center gap-2 p-3 sm:p-4 pt-safe">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 mobile-touch-target"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <UserAvatar userId={chat.created_by} className="w-8 h-8" showStatus />
          <h2 className="text-xl font-semibold">{chat.name}</h2>
        </div>
        <div className="ml-auto">
          <div className="flex items-center gap-2">
            {typeof window !== "undefined" &&
              "Notification" in window &&
              Notification.permission === "default" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      const permission = await Notification.requestPermission();
                      if (permission === "granted") {
                        setupMessageListener((payload) => {
                          if (
                            payload.data?.chatId &&
                            payload.data.chatId !== chat.id
                          ) {
                            new Notification(payload.notification.title, {
                              body: payload.notification.body,
                              icon: "/vite.svg",
                              data: payload.data,
                            });
                          }
                        });
                      }
                    } catch (error) {
                      console.error(
                        "Error requesting notification permission:",
                        error,
                      );
                    }
                  }}
                >
                  Enable Notifications
                </Button>
              )}
            <ChatOptions
              chatId={chat.id}
              chat={chat}
              onDeleteSuccess={() => {
                setIsDeleted(true);
              }}
            />
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <PullToRefresh onRefresh={fetchMessages}>
          <div className="p-3 sm:p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex",
                  message.sender_id === user?.id
                    ? "justify-end"
                    : "justify-start",
                )}
              >
                <div className="flex items-start gap-2">
                  {message.sender_id !== user?.id && (
                    <UserAvatar
                      userId={message.sender_id}
                      className="w-8 h-8"
                      showStatus
                    />
                  )}
                  <div
                    className={cn(
                      "max-w-[92%] sm:max-w-[85%] rounded-lg p-3 sm:p-4",
                      message.sender_id === user?.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted",
                    )}
                  >
                    {message.media_url && (
                      <div className="mb-2">
                        {message.content_type === "image" ? (
                          <img
                            src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/chat-images/${message.media_url}`}
                            alt="Shared"
                            className="rounded-lg max-w-full"
                          />
                        ) : (
                          message.content_type === "file" && (
                            <a
                              href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/chat-files/${message.media_url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                            >
                              <Paperclip className="h-5 w-5" />
                              <span className="text-sm truncate">
                                {message.media_url
                                  .split("-")
                                  .slice(2)
                                  .join("-")}
                              </span>
                            </a>
                          )
                        )}
                      </div>
                    )}
                    {message.content && (
                      <p className="break-words">{message.content}</p>
                    )}
                    {message.reactions && (
                      <div className="mt-1">
                        <MessageReactions
                          messageId={message.id}
                          reactions={message.reactions}
                          onReactionChange={fetchMessages}
                        />
                      </div>
                    )}
                  </div>
                  {message.sender_id === user?.id && (
                    <UserAvatar
                      userId={message.sender_id}
                      className="w-8 h-8"
                      showStatus
                    />
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </PullToRefresh>
      </div>

      {/* Message Input */}
      <div className="sticky bottom-0 left-0 right-0 border-t bg-background pb-safe">
        <form onSubmit={sendMessage} className="p-3 sm:p-4 space-y-2">
          {selectedFile && (
            <div className="relative w-32 h-32 rounded-lg overflow-hidden bg-muted flex items-center justify-center">
              {ALLOWED_FILE_TYPES.image.includes(selectedFile.type) ? (
                <img
                  src={URL.createObjectURL(selectedFile)}
                  alt="Selected"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-4">
                  <Paperclip className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-xs truncate">{selectedFile.name}</p>
                </div>
              )}
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6"
                onClick={() => setSelectedFile(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
          {fileError && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p>{fileError}</p>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={imageInputRef}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              setFileError("");

              if (file.size > MAX_FILE_SIZE) {
                setFileError("File size must be less than 10MB");
                return;
              }

              if (!ALLOWED_FILE_TYPES.image.includes(file.type)) {
                setFileError("Only image files are allowed");
                return;
              }

              setSelectedFile(file);
            }}
          />
          <input
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
            className="hidden"
            ref={fileInputRef}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              setFileError("");

              if (file.size > MAX_FILE_SIZE) {
                setFileError("File size must be less than 10MB");
                return;
              }

              if (!ALLOWED_FILE_TYPES.document.includes(file.type)) {
                setFileError("Unsupported file type");
                return;
              }

              setSelectedFile(file);
            }}
          />
          <div className="flex gap-2">
            <div className="flex-1 flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 mobile-touch-target"
                onClick={() => imageInputRef.current?.click()}
              >
                <Image className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 mobile-touch-target"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-5 w-5" />
              </Button>
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                disabled={sending}
                className="min-h-[44px]"
              />
            </div>
            <Button
              type="submit"
              disabled={sending || (!newMessage.trim() && !selectedFile)}
              className="mobile-touch-target"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
