import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

export function NewChatDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const createChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user || loading) return;

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

      const { data, error } = await supabase
        .from("chats")
        .insert({
          name: name.trim(),
          created_by: user.id,
          is_group: false,
        })
        .select()
        .single();

      if (error) throw error;

      const { error: participantError } = await supabase
        .from("chat_participants")
        .insert({
          chat_id: data.id,
          user_id: user.id,
          joined_at: new Date().toISOString(),
        });

      if (participantError) {
        console.error("Error adding participant:", participantError);
        throw participantError;
      }

      setOpen(false);
      setName("");
      // Only navigate after everything is complete
      setTimeout(() => navigate(`/chat/${data.id}`), 0);
    } catch (error) {
      console.error("Error creating chat:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0">
          <Plus className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-32px)] sm:w-auto">
        <DialogHeader>
          <DialogTitle>New Chat</DialogTitle>
          <DialogDescription>Enter a name for your new chat</DialogDescription>
        </DialogHeader>
        <form onSubmit={createChat} className="space-y-4">
          <Input
            placeholder="Chat name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
          />
          <Button
            type="submit"
            className="w-full"
            disabled={loading || !name.trim()}
          >
            {loading ? "Creating..." : "Create Chat"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
