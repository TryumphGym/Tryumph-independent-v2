export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      certifications: {
        Row: {
          issuing_organization: string | null
          document_path: string | null
          verified_at: string | null
          verified_by: string | null
          created_at: string
          credential_id: string
          expires: string
          id: string
          name: string
          note: string
          status: string
          trainer_name: string
          user_id: string
        }
        Insert: {
          issuing_organization?: string | null
          document_path?: string | null
          verified_at?: string | null
          verified_by?: string | null
          created_at?: string
          credential_id?: string
          expires?: string
          id?: string
          name: string
          note?: string
          status?: string
          trainer_name?: string
          user_id: string
        }
        Update: {
          issuing_organization?: string | null
          document_path?: string | null
          verified_at?: string | null
          verified_by?: string | null
          created_at?: string
          credential_id?: string
          expires?: string
          id?: string
          name?: string
          note?: string
          status?: string
          trainer_name?: string
          user_id?: string
        }
        Relationships: []
      }
      cron_tokens: {
        Row: {
          name: string
          token: string
        }
        Insert: {
          name: string
          token?: string
        }
        Update: {
          name?: string
          token?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          friend_name: string
          partner: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          friend_name: string
          partner?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          friend_name?: string
          partner?: boolean
          user_id?: string
        }
        Relationships: []
      }
      live_sessions: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          level: string
          minutes: number
          starts_at: string
          title: string
          trainer_id: string
          trainer_name: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          level?: string
          minutes?: number
          starts_at: string
          title: string
          trainer_id: string
          trainer_name: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          level?: string
          minutes?: number
          starts_at?: string
          title?: string
          trainer_id?: string
          trainer_name?: string
        }
        Relationships: []
      }
      meal_plans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          plan: Json
          target: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          plan?: Json
          target?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          plan?: Json
          target?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      menu_shares: {
        Row: {
          client_id: string
          client_name: string
          created_at: string
          nutritionist_id: string
          nutritionist_name: string
        }
        Insert: {
          client_id: string
          client_name?: string
          created_at?: string
          nutritionist_id: string
          nutritionist_name?: string
        }
        Update: {
          client_id?: string
          client_name?: string
          created_at?: string
          nutritionist_id?: string
          nutritionist_name?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          id: string
          recipient_id: string
          sender_id: string
          sender_name: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          recipient_id: string
          sender_id: string
          sender_name: string
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          recipient_id?: string
          sender_id?: string
          sender_name?: string
          text?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          author_id: string
          author_name: string
          created_at: string
          id: string
          post_id: string
          text: string
        }
        Insert: {
          author_id: string
          author_name: string
          created_at?: string
          id?: string
          post_id: string
          text: string
        }
        Update: {
          author_id?: string
          author_name?: string
          created_at?: string
          id?: string
          post_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          post_id: string
          user_id: string
        }
        Insert: {
          post_id: string
          user_id: string
        }
        Update: {
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string | null
          author_name: string
          created_at: string
          id: string
          kind: string
          text: string
          trybe: string
        }
        Insert: {
          author_id?: string | null
          author_name: string
          created_at?: string
          id?: string
          kind?: string
          text: string
          trybe: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          created_at?: string
          id?: string
          kind?: string
          text?: string
          trybe?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_days: Json
          avatar_url: string | null
          bookings: Json
          created_at: string
          dr_gap: string | null
          extra: Json
          goal: string | null
          height: number | null
          history: Json
          id: string
          joined: Json
          ledger: Json
          level: string | null
          name: string
          partners: Json
          postpartum: boolean
          prefs: string | null
          reservations: Json
          role: string
          scheduled: Json
          tokens: number
          updated_at: string
          watch_later: Json
          weeks_postpartum: string | null
          weigh_ins: Json
          weight: number | null
        }
        Insert: {
          active_days?: Json
          avatar_url?: string | null
          bookings?: Json
          created_at?: string
          dr_gap?: string | null
          extra?: Json
          goal?: string | null
          height?: number | null
          history?: Json
          id: string
          joined?: Json
          ledger?: Json
          level?: string | null
          name?: string
          partners?: Json
          postpartum?: boolean
          prefs?: string | null
          reservations?: Json
          role?: string
          scheduled?: Json
          tokens?: number
          updated_at?: string
          watch_later?: Json
          weeks_postpartum?: string | null
          weigh_ins?: Json
          weight?: number | null
        }
        Update: {
          active_days?: Json
          avatar_url?: string | null
          bookings?: Json
          created_at?: string
          dr_gap?: string | null
          extra?: Json
          goal?: string | null
          height?: number | null
          history?: Json
          id?: string
          joined?: Json
          ledger?: Json
          level?: string | null
          name?: string
          partners?: Json
          postpartum?: boolean
          prefs?: string | null
          reservations?: Json
          role?: string
          scheduled?: Json
          tokens?: number
          updated_at?: string
          watch_later?: Json
          weeks_postpartum?: string | null
          weigh_ins?: Json
          weight?: number | null
        }
        Relationships: []
      }
      push_reminders: {
        Row: {
          body: string
          fire_at: string
          id: string
          live_id: string
          sent: boolean
          user_id: string
        }
        Insert: {
          body: string
          fire_at: string
          id?: string
          live_id: string
          sent?: boolean
          user_id: string
        }
        Update: {
          body?: string
          fire_at?: string
          id?: string
          live_id?: string
          sent?: boolean
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          author_id: string | null
          author_name: string
          created_at: string
          id: string
          reply: string | null
          stars: number
          text: string
          trainer_id: string
        }
        Insert: {
          author_id?: string | null
          author_name: string
          created_at?: string
          id?: string
          reply?: string | null
          stars?: number
          text: string
          trainer_id: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          created_at?: string
          id?: string
          reply?: string | null
          stars?: number
          text?: string
          trainer_id?: string
        }
        Relationships: []
      }
      trainer_accounts: {
        Row: {
          created_at: string
          payouts_enabled: boolean
          slug: string | null
          stripe_account_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          payouts_enabled?: boolean
          slug?: string | null
          stripe_account_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          payouts_enabled?: boolean
          slug?: string | null
          stripe_account_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trainer_busy: {
        Row: {
          created_at: string
          day: string
          source: string
          time: string
          trainer_id: string
        }
        Insert: {
          created_at?: string
          day: string
          source?: string
          time?: string
          trainer_id: string
        }
        Update: {
          created_at?: string
          day?: string
          source?: string
          time?: string
          trainer_id?: string
        }
        Relationships: []
      }
      trainer_earnings: {
        Row: {
          created_at: string
          fee_cents: number
          gross_cents: number
          id: string
          net_cents: number
          payout_cents: number
          ref: string
          share_pct: number
          source: string
          status: string
          trainer_slug: string
          transfer_id: string | null
        }
        Insert: {
          created_at?: string
          fee_cents: number
          gross_cents: number
          id?: string
          net_cents: number
          payout_cents: number
          ref: string
          share_pct: number
          source: string
          status?: string
          trainer_slug: string
          transfer_id?: string | null
        }
        Update: {
          created_at?: string
          fee_cents?: number
          gross_cents?: number
          id?: string
          net_cents?: number
          payout_cents?: number
          ref?: string
          share_pct?: number
          source?: string
          status?: string
          trainer_slug?: string
          transfer_id?: string | null
        }
        Relationships: []
      }
      trainer_videos: {
        Row: {
          break_seconds: number
          breaks: number[]
          category: string
          created_at: string
          equipment: string
          id: string
          level: string
          minutes: number
          path: string
          playlist: string
          pregnancy_safe: boolean
          title: string
          user_id: string
        }
        Insert: {
          break_seconds?: number
          breaks?: number[]
          category?: string
          created_at?: string
          equipment?: string
          id?: string
          level?: string
          minutes?: number
          path: string
          playlist?: string
          pregnancy_safe?: boolean
          title: string
          user_id: string
        }
        Update: {
          break_seconds?: number
          breaks?: number[]
          category?: string
          created_at?: string
          equipment?: string
          id?: string
          level?: string
          minutes?: number
          path?: string
          playlist?: string
          pregnancy_safe?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      waitlist_entries: {
        Row: {
          created_at: string
          email: string
          heard_from: string | null
          id: string
          live_class_interest: string | null
          notify_new_coaches: boolean
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          heard_from?: string | null
          id?: string
          live_class_interest?: string | null
          notify_new_coaches?: boolean
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          heard_from?: string | null
          id?: string
          live_class_interest?: string | null
          notify_new_coaches?: boolean
          role?: string
        }
        Relationships: []
      }
      youth_consents: {
        Row: {
          contributor_age: number
          contributor_name: string
          created_at: string
          guardian_email: string
          guardian_name: string
          guardian_signature: string
          id: string
          release_agreed: boolean
          status: string
          user_id: string
        }
        Insert: {
          contributor_age: number
          contributor_name: string
          created_at?: string
          guardian_email: string
          guardian_name: string
          guardian_signature: string
          id?: string
          release_agreed?: boolean
          status?: string
          user_id: string
        }
        Update: {
          contributor_age?: number
          contributor_name?: string
          created_at?: string
          guardian_email?: string
          guardian_name?: string
          guardian_signature?: string
          id?: string
          release_agreed?: boolean
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_menu: { Args: { _client: string }; Returns: boolean }
      can_see_trybe: { Args: { _trybe: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      partner_reservations: {
        Args: never
        Returns: {
          friend_id: string
          friend_name: string
          reservations: Json
        }[]
      }
      share_menu: { Args: { _code: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
