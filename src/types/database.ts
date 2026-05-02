export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          avatar_url: string | null;
          bio: string | null;
          accent_color: string | null;
          wallpaper: string | null;
          youtube_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name: string;
          avatar_url?: string | null;
          bio?: string | null;
          accent_color?: string | null;
          wallpaper?: string | null;
          youtube_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      spaces: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          tagline: string;
          about_me: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title: string;
          tagline?: string;
          about_me?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["spaces"]["Insert"]>;
        Relationships: [];
      };
      space_items: {
        Row: {
          id: string;
          space_id: string;
          type: "note" | "about" | "image" | "drawing";
          title: string;
          content: string;
          x: number;
          y: number;
          width: number;
          height: number;
          color: string;
          rotation: number;
          image_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          space_id: string;
          type: "note" | "about" | "image" | "drawing";
          title?: string;
          content?: string;
          x?: number;
          y?: number;
          width?: number;
          height?: number;
          color?: string;
          rotation?: number;
          image_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["space_items"]["Insert"]>;
        Relationships: [];
      };
      rooms: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          description: string;
          is_public: boolean;
          invite_token: string;
          password_hash: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          title: string;
          description?: string;
          is_public?: boolean;
          invite_token?: string;
          password_hash?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rooms"]["Insert"]>;
        Relationships: [];
      };
      room_members: {
        Row: {
          room_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          room_id: string;
          user_id: string;
          joined_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["room_members"]["Insert"]>;
        Relationships: [];
      };
      mail_states: {
        Row: {
          owner_id: string;
          payload: Json;
          updated_at: string;
        };
        Insert: {
          owner_id: string;
          payload?: Json;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["mail_states"]["Insert"]>;
        Relationships: [];
      };
      asset_states: {
        Row: {
          owner_id: string;
          payload: Json;
          updated_at: string;
        };
        Insert: {
          owner_id: string;
          payload?: Json;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["asset_states"]["Insert"]>;
        Relationships: [];
      };
      store_states: {
        Row: {
          owner_id: string;
          payload: Json;
          updated_at: string;
        };
        Insert: {
          owner_id: string;
          payload?: Json;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["store_states"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_room: {
        Args: {
          p_title: string;
          p_description?: string;
          p_is_public?: boolean;
          p_password?: string | null;
        };
        Returns: {
          id: string;
          invite_token: string;
        }[];
      };
      get_room_invite_preview: {
        Args: {
          p_token: string;
        };
        Returns: {
          id: string;
          title: string;
          description: string;
          is_public: boolean;
          has_password: boolean;
          owner_display_name: string;
          owner_username: string;
        }[];
      };
      join_room_by_token: {
        Args: {
          p_token: string;
          p_password?: string | null;
        };
        Returns: {
          room_id: string;
          room_title: string;
        }[];
      };
      update_room_security: {
        Args: {
          p_room_id: string;
          p_is_public: boolean;
          p_password?: string | null;
        };
        Returns: void;
      };
      rotate_room_invite_token: {
        Args: {
          p_room_id: string;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
