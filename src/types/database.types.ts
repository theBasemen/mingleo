export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          created_at: string;
          email: string;
          display_name: string;
          avatar_url: string;
          last_seen: string;
        };
        Insert: {
          id: string;
          created_at?: string;
          email: string;
          display_name: string;
          avatar_url?: string;
          last_seen?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          email?: string;
          display_name?: string;
          avatar_url?: string;
          last_seen?: string;
        };
      };
      chats: {
        Row: {
          id: string;
          created_at: string;
          name: string;
          is_group: boolean;
          created_by: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          name: string;
          is_group: boolean;
          created_by: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          name?: string;
          is_group?: boolean;
          created_by?: string;
        };
      };
      chat_participants: {
        Row: {
          chat_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          chat_id: string;
          user_id: string;
          joined_at?: string;
        };
        Update: {
          chat_id?: string;
          user_id?: string;
          joined_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          created_at: string;
          chat_id: string;
          sender_id: string;
          content: string;
          content_type: "text" | "image" | "video" | "file";
          media_url?: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          chat_id: string;
          sender_id: string;
          content: string;
          content_type: "text" | "image" | "video" | "file";
          media_url?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          chat_id?: string;
          sender_id?: string;
          content?: string;
          content_type?: "text" | "image" | "video" | "file";
          media_url?: string;
        };
      };
      reactions: {
        Row: {
          id: string;
          created_at: string;
          message_id: string;
          user_id: string;
          emoji: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          message_id: string;
          user_id: string;
          emoji: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          message_id?: string;
          user_id?: string;
          emoji?: string;
        };
      };
    };
  };
}
