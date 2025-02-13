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
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { Check, Copy } from "lucide-react";

interface InviteDialogProps {
  chatId: string;
  chatName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteDialog({
  chatId,
  chatName,
  open,
  onOpenChange,
}: InviteDialogProps) {
  const [emails, setEmails] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();

  const inviteLink = `${window.location.origin}/invite/${chatId}`;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emails.trim() || !user || loading) return;

    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      // Split emails and clean them
      const emailList = emails
        .split(/[,;\n]/)
        .map((email) => email.trim())
        .filter((email) => email.length > 0);

      // Validate email format
      const invalidEmails = emailList.filter(
        (email) => !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
      );

      if (invalidEmails.length > 0) {
        setError(`Invalid email format: ${invalidEmails.join(", ")}`);
        return;
      }

      // Check for existing participants
      const { data: existingParticipants } = await supabase
        .from("chat_participants")
        .select("user_id, users!inner(email)")
        .eq("chat_id", chatId);

      const existingEmails = new Set(
        existingParticipants?.map((p) => p.users.email) || [],
      );

      // Filter out existing participants
      const newEmails = emailList.filter((email) => !existingEmails.has(email));

      if (newEmails.length === 0) {
        setError("All these users are already participants in the chat");
        return;
      }

      // Create invitations
      const { error: inviteError } = await supabase.from("invitations").insert(
        newEmails.map((email) => ({
          chat_id: chatId,
          inviter_id: user.id,
          invitee_email: email,
          status: "pending",
          created_at: new Date().toISOString(),
        })),
      );

      if (inviteError) throw inviteError;

      setSuccess(true);
      setEmails("");
    } catch (error) {
      console.error("Error sending invitations:", error);
      setError("Failed to send invitations. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      // Show toast notification
      const toast = document.createElement("div");
      toast.className =
        "fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded shadow-lg transition-opacity duration-300";
      toast.textContent = "Link copied to clipboard!";
      document.body.appendChild(toast);

      // Fade out and remove after 2 seconds
      setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-32px)] sm:w-auto max-h-[calc(100vh-32px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invite to {chatName}</DialogTitle>
          <DialogDescription>
            Send an invitation via email or share the invite link
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Invite Link Section */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Invite Link</label>
            <div className="flex gap-2">
              <Input value={inviteLink} readOnly className="flex-1" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={copyLink}
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Email Invite Form */}
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Invite via Email</label>
              <textarea
                className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Enter email addresses (separated by commas, semicolons, or new lines)
Example:
user1@example.com
user2@example.com"
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
                disabled={loading}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && (
              <p className="text-sm text-green-600">
                Invitation sent successfully!
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !emails.trim()}
            >
              {loading ? "Sending..." : "Send Invitation"}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
