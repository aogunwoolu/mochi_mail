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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
