import { initializeApp } from "firebase/app";
import { supabase } from "./supabase";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let messaging: any = null;

// Check if the browser supports notifications and Firebase messaging
const isSupported = async () => {
  try {
    if (typeof window === "undefined") return false;
    if (!("Notification" in window)) return false;

    // Only import Firebase messaging if the browser supports it
    const { getMessaging, getToken, onMessage } = await import(
      "firebase/messaging"
    );
    const firebaseApp = initializeApp(firebaseConfig);
    messaging = getMessaging(firebaseApp);
    return true;
  } catch (error) {
    console.log("Notifications not supported");
    return false;
  }
};

export async function requestNotificationPermission(userId: string) {
  try {
    const supported = await isSupported();
    if (!supported) return false;

    const { getToken } = await import("firebase/messaging");

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      // Get FCM token
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      });

      // Store token in Supabase
      await supabase.from("user_push_tokens").upsert(
        {
          user_id: userId,
          push_token: token,
          created_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        },
      );

      return true;
    }
    return false;
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return false;
  }
}

export async function setupMessageListener(
  onMessageReceived: (payload: any) => void,
) {
  try {
    const supported = await isSupported();
    if (!supported) return;

    const { onMessage } = await import("firebase/messaging");
    onMessage(messaging, (payload) => {
      onMessageReceived(payload);
    });
  } catch (error) {
    console.error("Error setting up message listener:", error);
  }
}
