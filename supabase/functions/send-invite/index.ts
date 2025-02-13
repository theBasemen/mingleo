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
    const { inviteeEmail, chatId, inviterId } = await req.json();

    // Create Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Get inviter and chat details
    const [{ data: inviter }, { data: chat }] = await Promise.all([
      supabaseAdmin
        .from("users")
        .select("display_name")
        .eq("id", inviterId)
        .single(),
      supabaseAdmin.from("chats").select("name").eq("id", chatId).single(),
    ]);

    if (!inviter || !chat) {
      throw new Error("Inviter or chat not found");
    }

    // Create invitation record
    const { error: inviteError } = await supabaseAdmin
      .from("invitations")
      .insert({
        chat_id: chatId,
        inviter_id: inviterId,
        invitee_email: inviteeEmail,
        status: "pending",
      });

    if (inviteError) throw inviteError;

    // Send email using Supabase's built-in email service
    const { error: emailError } = await supabaseAdmin.auth.admin.sendRawEmail({
      to: inviteeEmail,
      subject: `${inviter.display_name} invited you to join ${chat.name} on Mingleo`,
      template: "invite",
      variables: {
        inviter_name: inviter.display_name,
        chat_name: chat.name,
        invite_link: `${Deno.env.get("PUBLIC_SITE_URL")}/invite/${chatId}`,
      },
    });

    if (emailError) throw emailError;

    return new Response(
      JSON.stringify({ message: "Invitation sent successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
