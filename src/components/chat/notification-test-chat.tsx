import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export function NotificationTestChat() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const sendTestMessage = async () => {
    if (!message.trim() || !user || loading) return;

    setLoading(true);
    try {
      // First check if user exists in users table
      const { data: existingUser, error: userCheckError } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .single();

      if (userCheckError || !existingUser) {
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

      // Create a test chat if it doesn't exist
      const { data: existingChat } = await supabase
        .from("chats")
        .select("id")
        .eq("name", "Notification Test Chat")
        .single();

      let chatId = existingChat?.id;

      if (!chatId) {
        const { data: newChat, error: chatError } = await supabase
          .from("chats")
          .insert({
            name: "Notification Test Chat",
            created_by: user.id,
            is_group: false,
          })
          .select()
          .single();

        if (chatError) throw chatError;
        chatId = newChat.id;

        // Add current user as participant
        await supabase.from("chat_participants").insert({
          chat_id: chatId,
          user_id: user.id,
          role: "owner",
          joined_at: new Date().toISOString(),
        });
      }

      // Send test message
      const { error: messageError } = await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: user.id,
        content: message,
        content_type: "text",
      });

      if (messageError) throw messageError;

      setMessage("");
      alert(
        "Test message sent! You should receive a notification if you're not currently viewing the test chat.",
      );
    } catch (error) {
      console.error("Error sending test message:", error);
      alert("Failed to send test message");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Chat Notifications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Send a test message to trigger a notification. You'll receive the
            notification if you're not currently viewing the test chat.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Enter test message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendTestMessage()}
            />
            <Button
              onClick={sendTestMessage}
              disabled={loading || !message.trim()}
            >
              {loading ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
