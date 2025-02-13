import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { Loader2, UserMinus, Clock } from "lucide-react";
import type { Database } from "@/types/database.types";

type Chat = Database["public"]["Tables"]["chats"]["Row"];
type ChatParticipant =
  Database["public"]["Tables"]["chat_participants"]["Row"] & {
    users: { display_name: string; email: string };
  };

interface ChatSettingsDialogProps {
  chat: Chat;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatSettingsDialog({
  chat,
  open,
  onOpenChange,
}: ChatSettingsDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [settings, setSettings] = useState({
    participantsCanInvite: chat.participants_can_invite,
    invitationExpiryHours: chat.invitation_expiry_hours || 0,
    onlyAdminsCanRemoveMessages: chat.only_admins_can_remove_messages,
    onlyAdminsCanEditSettings: chat.only_admins_can_edit_settings,
  });

  useEffect(() => {
    if (!open) return;

    const fetchParticipants = async () => {
      const { data, error } = await supabase
        .from("chat_participants")
        .select("*, users:user_id(display_name, email)")
        .eq("chat_id", chat.id);

      if (error) {
        console.error("Error fetching participants:", error);
        return;
      }

      setParticipants(data as ChatParticipant[]);
    };

    fetchParticipants();
  }, [chat.id, open]);

  const updateSettings = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("chats")
        .update({
          participants_can_invite: settings.participantsCanInvite,
          invitation_expiry_hours: settings.invitationExpiryHours || null,
          only_admins_can_remove_messages: settings.onlyAdminsCanRemoveMessages,
          only_admins_can_edit_settings: settings.onlyAdminsCanEditSettings,
        })
        .eq("id", chat.id);

      if (error) throw error;
    } catch (error) {
      console.error("Error updating settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const removeParticipant = async (participantId: string) => {
    if (!user || loading) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("chat_participants")
        .delete()
        .eq("chat_id", chat.id)
        .eq("user_id", participantId);

      if (error) throw error;

      setParticipants((current) =>
        current.filter((p) => p.user_id !== participantId),
      );
    } catch (error) {
      console.error("Error removing participant:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateParticipantRole = async (
    participantId: string,
    newRole: string,
  ) => {
    if (!user || loading) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("chat_participants")
        .update({ role: newRole })
        .eq("chat_id", chat.id)
        .eq("user_id", participantId);

      if (error) throw error;

      setParticipants((current) =>
        current.map((p) =>
          p.user_id === participantId ? { ...p, role: newRole } : p,
        ),
      );
    } catch (error) {
      console.error("Error updating participant role:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-32px)] sm:w-auto max-w-2xl max-h-[calc(100vh-32px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chat Settings</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Participants can invite</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow participants to invite new members
                  </p>
                </div>
                <Switch
                  checked={settings.participantsCanInvite}
                  onCheckedChange={(checked) =>
                    setSettings((s) => ({
                      ...s,
                      participantsCanInvite: checked,
                    }))
                  }
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable invitation expiry</Label>
                    <p className="text-sm text-muted-foreground">
                      Set a time limit for invitations
                    </p>
                  </div>
                  <Switch
                    checked={settings.invitationExpiryHours > 0}
                    onCheckedChange={(checked) =>
                      setSettings((s) => ({
                        ...s,
                        invitationExpiryHours: checked ? 24 : 0,
                      }))
                    }
                  />
                </div>

                {settings.invitationExpiryHours > 0 && (
                  <div className="space-y-2">
                    <Label>Expiry duration (hours)</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="number"
                        min="1"
                        placeholder="Hours"
                        value={settings.invitationExpiryHours}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            invitationExpiryHours: Math.max(
                              1,
                              parseInt(e.target.value) || 1,
                            ),
                          }))
                        }
                      />
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Only admins can remove messages</Label>
                  <p className="text-sm text-muted-foreground">
                    Restrict message deletion to admins
                  </p>
                </div>
                <Switch
                  checked={settings.onlyAdminsCanRemoveMessages}
                  onCheckedChange={(checked) =>
                    setSettings((s) => ({
                      ...s,
                      onlyAdminsCanRemoveMessages: checked,
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Only admins can edit settings</Label>
                  <p className="text-sm text-muted-foreground">
                    Restrict settings changes to admins
                  </p>
                </div>
                <Switch
                  checked={settings.onlyAdminsCanEditSettings}
                  onCheckedChange={(checked) =>
                    setSettings((s) => ({
                      ...s,
                      onlyAdminsCanEditSettings: checked,
                    }))
                  }
                />
              </div>

              <Button
                onClick={updateSettings}
                disabled={loading}
                className="w-full"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Settings
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="members" className="space-y-4">
            <div className="space-y-4">
              {participants.map((participant) => (
                <div
                  key={participant.user_id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center space-x-4">
                    <UserAvatar
                      userId={participant.user_id}
                      className="h-10 w-10"
                    />
                    <div>
                      <p className="font-medium">
                        {participant.users?.display_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {participant.users?.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Select
                      value={participant.role}
                      onValueChange={(value) =>
                        updateParticipantRole(participant.user_id, value)
                      }
                      disabled={
                        participant.user_id === chat.created_by ||
                        participant.user_id === user?.id
                      }
                    >
                      <SelectTrigger className="w-[110px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">
                          <Badge>Owner</Badge>
                        </SelectItem>
                        <SelectItem value="admin">
                          <Badge variant="secondary">Admin</Badge>
                        </SelectItem>
                        <SelectItem value="member">
                          <Badge variant="outline">Member</Badge>
                        </SelectItem>
                      </SelectContent>
                    </Select>

                    {participant.user_id !== chat.created_by &&
                      participant.user_id !== user?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeParticipant(participant.user_id)}
                          disabled={loading}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
