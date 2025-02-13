import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NotificationTest } from "../notification-test";
import { NotificationTestChat } from "../chat/notification-test-chat";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Camera } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type ProfileData = {
  display_name: string;
  bio: string;
  avatar_url?: string;
  email: string;
};

export default function Profile() {
  const { user } = useAuth();
  const { userId } = useParams();
  const isOwnProfile = !userId || userId === user?.id;
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    display_name: "",
    bio: "",
    email: "",
  });
  const navigate = useNavigate();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const profileId = userId || user?.id;
    if (!profileId) return;

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", profileId)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        return;
      }

      if (mounted) {
        setProfileData({
          display_name: data.display_name || "",
          bio: data.bio || "",
          avatar_url: data.avatar_url,
          email: data.email || user.email || "",
        });
        setImageError(false);

        if (data.avatar_url && mounted) {
          const { data: urlData } = supabase.storage
            .from("avatars")
            .getPublicUrl(data.avatar_url);
          if (urlData?.publicUrl) {
            setAvatarUrl(urlData.publicUrl);
          }
        }
      }
    };

    fetchProfile();

    return () => {
      mounted = false;
    };
  }, [user, userId]);

  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${user?.id}-${Date.now()}${fileExt ? `.${fileExt}` : ""}`;

    // First check if the file already exists and remove it
    if (profileData.avatar_url) {
      try {
        const oldPath = profileData.avatar_url.split("/").pop();
        if (oldPath) {
          await supabase.storage.from("avatars").remove([oldPath]);
        }
      } catch (error) {
        console.error("Error removing old avatar:", error);
      }
    }

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw uploadError;
    }

    return fileName;
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview immediately
    const preview = URL.createObjectURL(file);
    setAvatarPreview(preview);
    setImageError(false);

    try {
      setLoading(true);
      const fileName = await uploadImage(file);
      const path = `${fileName}`;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);
      if (urlData?.publicUrl) {
        setAvatarUrl(urlData.publicUrl);
      }

      setProfileData((prev) => ({
        ...prev,
        avatar_url: path,
      }));
    } catch (error) {
      console.error(`Error uploading avatar:`, error);
      setImageError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || loading) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("users").upsert({
        id: user.id,
        email: profileData.email || user.email,
        display_name: profileData.display_name,
        bio: profileData.bio,
        avatar_url: profileData.avatar_url,
      });

      if (error) throw error;
      navigate("/");
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-4 sm:py-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="icon"
          className="mb-4 sm:mb-8"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {/* Avatar */}
        <div className="flex justify-center mb-6">
          <div className="relative inline-block">
            <div className="relative">
              {!imageError && (avatarPreview || avatarUrl) ? (
                <img
                  src={avatarPreview || avatarUrl || ""}
                  alt="Avatar"
                  className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-background object-cover"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-background bg-muted flex items-center justify-center">
                  <span className="text-3xl sm:text-4xl font-semibold">
                    {profileData.display_name?.charAt(0) ||
                      user.email?.charAt(0)}
                  </span>
                </div>
              )}
              {isOwnProfile && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="absolute bottom-0 right-0"
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <Camera className="h-4 w-4" />
                </Button>
              )}
            </div>
            {isOwnProfile && (
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={avatarInputRef}
                onChange={handleImageChange}
              />
            )}
          </div>
        </div>

        {/* Form */}
        {isOwnProfile ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                placeholder="Enter your name"
                value={profileData.display_name}
                onChange={(e) =>
                  setProfileData((prev) => ({
                    ...prev,
                    display_name: e.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                placeholder="Tell us about yourself"
                value={profileData.bio}
                onChange={(e) =>
                  setProfileData((prev) => ({ ...prev, bio: e.target.value }))
                }
                className="resize-none"
                rows={4}
              />
            </div>

            <div className="space-y-4 pb-20">
              <div className="flex flex-col sm:flex-row gap-2">
                <Button
                  type="submit"
                  className="w-full sm:w-auto sm:flex-1"
                  disabled={loading}
                >
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/")}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
              </div>

              <div className="pt-4 border-t">
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full"
                  disabled={loading}
                  onClick={async () => {
                    if (
                      !user ||
                      !confirm(
                        "Are you sure you want to delete your profile? This cannot be undone.",
                      )
                    )
                      return;

                    setLoading(true);
                    try {
                      // Delete avatar if exists
                      if (profileData.avatar_url) {
                        await supabase.storage
                          .from("avatars")
                          .remove([profileData.avatar_url]);
                      }

                      // Delete in correct order to avoid foreign key constraints
                      // 1. First delete all messages in user's chats
                      await supabase
                        .from("messages")
                        .delete()
                        .eq("sender_id", user.id);

                      // 2. Delete all chat participants
                      await supabase
                        .from("chat_participants")
                        .delete()
                        .eq("user_id", user.id);

                      // 3. Delete user's chats
                      await supabase
                        .from("chats")
                        .delete()
                        .eq("created_by", user.id);

                      // 4. Finally delete the user
                      await supabase.from("users").delete().eq("id", user.id);

                      // Delete user's auth account using RPC
                      const { error } = await supabase.rpc("delete_user");
                      if (error) throw error;

                      // Sign out
                      await supabase.auth.signOut();
                      navigate("/login");
                    } catch (error) {
                      console.error("Error deleting profile:", error);
                      alert("Failed to delete profile. Please try again.");
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Delete Profile
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h3 className="font-medium mb-2">Notification Settings</h3>
              <div className="space-y-4">
                <NotificationTest />
                <NotificationTestChat />
              </div>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <p className="text-lg">{profileData.display_name}</p>
            </div>

            {profileData.bio && (
              <div className="space-y-2">
                <Label>Bio</Label>
                <p className="whitespace-pre-wrap">{profileData.bio}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
