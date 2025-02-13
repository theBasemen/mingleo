import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getMessaging, getToken } from "firebase/messaging";
import { initializeApp } from "firebase/app";

export function NotificationTest() {
  const [status, setStatus] = useState("");

  const testNotifications = async () => {
    try {
      setStatus("Testing Firebase initialization...");

      // Test Firebase initialization
      const firebaseConfig = {
        apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
        projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_FIREBASE_APP_ID,
      };

      const app = initializeApp(firebaseConfig);
      setStatus("Firebase initialized successfully");

      // Test notification permission
      setStatus("Requesting notification permission...");
      const permission = await Notification.requestPermission();
      setStatus(`Notification permission: ${permission}`);

      if (permission === "granted") {
        // Test FCM token generation
        setStatus("Getting FCM token...");
        const messaging = getMessaging(app);
        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        });

        if (token) {
          setStatus(
            "FCM token received successfully: " + token.slice(0, 10) + "...",
          );

          // Send a test notification
          setStatus("Sending test notification...");
          new Notification("Test Notification", {
            body: "If you see this, notifications are working!",
            icon: "/vite.svg",
          });

          setStatus("Test completed successfully!");
        } else {
          setStatus("Failed to get FCM token");
        }
      }
    } catch (error) {
      setStatus(`Error: ${error.message}`);
      console.error("Notification test error:", error);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <Button onClick={testNotifications}>Test Notifications</Button>
      {status && (
        <div className="text-sm">
          <p className="font-medium">Status:</p>
          <p className="text-muted-foreground">{status}</p>
        </div>
      )}
    </div>
  );
}
