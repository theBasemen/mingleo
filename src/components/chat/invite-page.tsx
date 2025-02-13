import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/types/database.types";

type Chat = Database["public"]["Tables"]["chats"]["Row"];

type PageData = {
  chat: Chat | null;
  inviter?: {
    id: string;
    display_name: string;
    avatar_url?: string;
  };
};

export default function InvitePage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pageData, setPageData] = useState<PageData>({ chat: null });
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!chatId) return;

    const fetchData = async () => {
      try {
        // Fetch chat data
        const { data: chat, error: chatError } = await supabase
          .from("chats")
          .select("*")
          .eq("id", chatId)
          .single();

        if (chatError) throw chatError;

        // Fetch inviter info
        const { data: inviter, error: inviterError } = await supabase
          .from("users")
          .select("id, display_name, avatar_url")
          .eq("id", chat.created_by)
          .single();

        if (inviterError) throw inviterError;

        setPageData({ chat, inviter });
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [chatId]);

  const joinChat = async () => {
    if (!user || !pageData.chat || joining) return;

    setJoining(true);
    try {
      // Check if already a participant
      const { data: existingParticipant } = await supabase
        .from("chat_participants")
        .select("*")
        .eq("chat_id", pageData.chat.id)
        .eq("user_id", user.id)
        .single();

      if (existingParticipant) {
        navigate(`/chat/${pageData.chat.id}`, { replace: true });
        return;
      }

      // Join the chat
      const { error: joinError } = await supabase
        .from("chat_participants")
        .insert({
          chat_id: pageData.chat.id,
          user_id: user.id,
          role: "member",
          joined_at: new Date().toISOString(),
        });

      if (joinError) throw joinError;

      // Update invitation status if it exists
      if (user.email) {
        await supabase
          .from("invitations")
          .update({ status: "accepted" })
          .eq("chat_id", pageData.chat.id)
          .eq("invitee_email", user.email);
      }

      // Navigate directly to chat with replace to avoid history issues
      navigate(`/chat/${pageData.chat.id}`, { replace: true });
    } catch (error) {
      console.error("Error joining chat:", error);
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <p>Loading...</p>
      </div>
    );
  }

  if (!pageData.chat) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-4">
        <h2 className="text-xl font-semibold mb-2">Chat not found</h2>
        <p className="text-muted-foreground mb-4">
          This chat may no longer exist or you may not have permission to join.
        </p>
        <Button onClick={() => navigate("/")}>Return to Lobby</Button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background p-4">
      <div className="max-w-md w-full">
        <div className="bg-card text-card-foreground rounded-lg border shadow-lg overflow-hidden">
          {/* Header with decorative gradient */}
          <div className="relative h-32 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 flex items-center justify-center">
            {pageData.inviter && (
              <div className="absolute -bottom-12">
                <UserAvatar
                  userId={pageData.inviter.id}
                  className="w-24 h-24 border-4 border-background"
                />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="pt-16 px-6 pb-6 text-center space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              Join {pageData.chat.name}
            </h2>
            {pageData.inviter && (
              <p className="text-muted-foreground">
                {pageData.inviter.display_name} has invited you to join their
                conversation
              </p>
            )}

            {user ? (
              <Button
                onClick={joinChat}
                className="w-full"
                size="lg"
                disabled={joining}
              >
                {joining ? "Joining..." : "Accept Invitation"}
              </Button>
            ) : (
              <div className="space-y-3">
                <Button
                  onClick={() =>
                    navigate(`/login?redirect=/invite/${pageData.chat.id}`)
                  }
                  className="w-full"
                  size="lg"
                >
                  Sign in to Join
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    navigate(`/signup?redirect=/invite/${pageData.chat.id}`)
                  }
                  className="w-full"
                  size="lg"
                >
                  Create Account
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
