import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { type, table, record } = payload;

    // Only process new messages
    if (type !== "INSERT" || table !== "messages" || !record) {
      return new Response("Ignored", { status: 200, headers: corsHeaders });
    }

    // Create Supabase client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Get message details
    const { data: messageData } = await supabaseAdmin
      .from("messages")
      .select(
        `
        content,
        sender:users!sender_id(display_name),
        chat:chats!chat_id(name),
        chat_participants!chat_id(user_id)
      `,
      )
      .eq("id", record.id)
      .single();

    if (!messageData) throw new Error("Message not found");

    // Get push tokens for all participants except sender
    const { data: tokens } = await supabaseAdmin
      .from("user_push_tokens")
      .select("push_token")
      .in(
        "user_id",
        messageData.chat_participants
          .map((p: any) => p.user_id)
          .filter((id: string) => id !== record.sender_id),
      );

    if (!tokens?.length)
      return new Response("No tokens to notify", { headers: corsHeaders });

    // Send to Firebase Cloud Messaging
    const notifications = tokens.map((token: any) =>
      fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `key=${Deno.env.get("FIREBASE_SERVER_KEY")}`,
        },
        body: JSON.stringify({
          to: token.push_token,
          notification: {
            title: `${messageData.sender.display_name} in ${messageData.chat.name}`,
            body: messageData.content,
            click_action: `${Deno.env.get("PUBLIC_SITE_URL")}/chat/${record.chat_id}`,
          },
          data: {
            chatId: record.chat_id,
          },
        }),
      }),
    );

    await Promise.all(notifications);

    return new Response("Notifications sent", { headers: corsHeaders });
  } catch (error) {
    console.error("Error in send-notification:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
