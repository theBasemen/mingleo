import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const setupNotifications = async (userId: string) => {
      if ("Notification" in window) {
        try {
          const { requestNotificationPermission } = await import(
            "./notifications"
          );
          await requestNotificationPermission(userId);
        } catch (error) {
          console.error("Error setting up notifications:", error);
        }
      }
    };

    // Check active sessions and sets the user
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);

      // Update online status immediately when session is found
      if (session?.user) {
        await Promise.all([
          supabase
            .from("users")
            .update({ online_at: new Date().toISOString() })
            .eq("id", session.user.id),
          setupNotifications(session.user.id),
        ]);
      }

      // If user is logged in, start updating their online status
      if (session?.user) {
        // Update immediately
        supabase
          .from("users")
          .update({ online_at: new Date().toISOString() })
          .eq("id", session.user.id);

        // Then update every 4 minutes
        interval = setInterval(
          () => {
            supabase
              .from("users")
              .update({ online_at: new Date().toISOString() })
              .eq("id", session.user.id);
          },
          4 * 60 * 1000,
        );
      }
    });

    // Listen for changes on auth state (signed in, signed out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);

      // Clear interval if user logs out
      if (!session?.user) {
        clearInterval(interval);
      }
    });

    return () => {
      subscription.unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const signUp = async (
    email: string,
    password: string,
    displayName: string,
  ) => {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
      {
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      },
    );

    if (signUpError) throw signUpError;

    // Create user record in the users table
    const { error: createUserError } = await supabase.from("users").insert({
      id: signUpData.user?.id,
      email,
      display_name: displayName,
    });

    if (createUserError) {
      console.error("Error creating user record:", createUserError);
      throw createUserError;
    }

    // Automatically sign in after successful signup
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) throw signInError;

    navigate("/");
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    navigate("/");
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    navigate("/login");
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
