// Generated from the ordered migrations with npm run db:types. No remote database access.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];
export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      ad_settlement_events: {
        Row: {
          id: string;
          network: string;
          network_event_id: string;
          video_id: string;
          trainer_id: string;
          break_second: number;
          gross_cents: number;
          fee_cents: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          network: string;
          network_event_id: string;
          video_id: string;
          trainer_id: string;
          break_second: number;
          gross_cents: number;
          fee_cents: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          network?: string;
          network_event_id?: string;
          video_id?: string;
          trainer_id?: string;
          break_second?: number;
          gross_cents?: number;
          fee_cents?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      certifications: {
        Row: {
          id: string;
          user_id: string;
          trainer_name: string;
          name: string;
          credential_id: string;
          expires: string;
          status: string;
          note: string;
          created_at: string;
          issuing_organization: string | null;
          document_path: string | null;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          trainer_name?: string;
          name: string;
          credential_id?: string;
          expires?: string;
          status?: string;
          note?: string;
          created_at?: string;
          issuing_organization?: string | null;
          document_path?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          trainer_name?: string;
          name?: string;
          credential_id?: string;
          expires?: string;
          status?: string;
          note?: string;
          created_at?: string;
          issuing_organization?: string | null;
          document_path?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [];
      };
      checkout_payment_state: {
        Row: {
          checkout_id: string;
          kind: string;
          user_id: string;
          gross_cents: number;
          fee_cents: number;
          refunded_cents: number;
          quantity: number;
          created_at: string;
        };
        Insert: {
          checkout_id: string;
          kind: string;
          user_id: string;
          gross_cents: number;
          fee_cents: number;
          refunded_cents?: number;
          quantity?: number;
          created_at?: string;
        };
        Update: {
          checkout_id?: string;
          kind?: string;
          user_id?: string;
          gross_cents?: number;
          fee_cents?: number;
          refunded_cents?: number;
          quantity?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      credential_reviews: {
        Row: {
          id: string;
          credential_id: string;
          reviewer_id: string;
          status: string;
          note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          credential_id: string;
          reviewer_id: string;
          status: string;
          note?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          credential_id?: string;
          reviewer_id?: string;
          status?: string;
          note?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      cron_tokens: {
        Row: { name: string; token: string };
        Insert: { name: string; token?: string };
        Update: { name?: string; token?: string };
        Relationships: [];
      };
      friendships: {
        Row: {
          user_id: string;
          friend_id: string;
          friend_name: string;
          partner: boolean;
          created_at: string;
        };
        Insert: {
          user_id: string;
          friend_id: string;
          friend_name: string;
          partner?: boolean;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          friend_id?: string;
          friend_name?: string;
          partner?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      live_checkout_intents: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string;
          expires_at?: string;
        };
        Relationships: [];
      };
      live_recordings: {
        Row: {
          egress_id: string;
          session_id: string;
          trainer_id: string;
          status: string;
          created_at: string;
          updated_at: string;
          object_key: string | null;
          bunny_guid: string | null;
          trainer_video_id: string | null;
          import_status: string;
          import_lease_until: string | null;
        };
        Insert: {
          egress_id: string;
          session_id: string;
          trainer_id: string;
          status: string;
          created_at?: string;
          updated_at?: string;
          object_key?: string | null;
          bunny_guid?: string | null;
          trainer_video_id?: string | null;
          import_status?: string;
          import_lease_until?: string | null;
        };
        Update: {
          egress_id?: string;
          session_id?: string;
          trainer_id?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
          object_key?: string | null;
          bunny_guid?: string | null;
          trainer_video_id?: string | null;
          import_status?: string;
          import_lease_until?: string | null;
        };
        Relationships: [];
      };
      live_room_access: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          stripe_checkout_session_id: string | null;
          status: string;
          created_at: string;
          wallet_lot_id: string | null;
          first_joined_at: string | null;
          wallet_redemption_id: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          stripe_checkout_session_id?: string | null;
          status?: string;
          created_at?: string;
          wallet_lot_id?: string | null;
          first_joined_at?: string | null;
          wallet_redemption_id?: string | null;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          stripe_checkout_session_id?: string | null;
          status?: string;
          created_at?: string;
          wallet_lot_id?: string | null;
          first_joined_at?: string | null;
          wallet_redemption_id?: string | null;
        };
        Relationships: [];
      };
      live_sessions: {
        Row: {
          id: string;
          trainer_id: string;
          trainer_name: string;
          title: string;
          category: string;
          level: string;
          starts_at: string;
          minutes: number;
          description: string;
          created_at: string;
          status: string;
          price_cents: number;
          recording_enabled: boolean;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          trainer_name: string;
          title: string;
          category?: string;
          level?: string;
          starts_at: string;
          minutes?: number;
          description?: string;
          created_at?: string;
          status?: string;
          price_cents?: number;
          recording_enabled?: boolean;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          trainer_name?: string;
          title?: string;
          category?: string;
          level?: string;
          starts_at?: string;
          minutes?: number;
          description?: string;
          created_at?: string;
          status?: string;
          price_cents?: number;
          recording_enabled?: boolean;
        };
        Relationships: [];
      };
      meal_plans: {
        Row: {
          user_id: string;
          plan: Json;
          target: Json;
          approved_by: string | null;
          approved_at: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          plan?: Json;
          target?: Json;
          approved_by?: string | null;
          approved_at?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          plan?: Json;
          target?: Json;
          approved_by?: string | null;
          approved_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      menu_shares: {
        Row: {
          client_id: string;
          nutritionist_id: string;
          client_name: string;
          nutritionist_name: string;
          created_at: string;
        };
        Insert: {
          client_id: string;
          nutritionist_id: string;
          client_name?: string;
          nutritionist_name?: string;
          created_at?: string;
        };
        Update: {
          client_id?: string;
          nutritionist_id?: string;
          client_name?: string;
          nutritionist_name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          sender_id: string;
          recipient_id: string;
          sender_name: string;
          text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          recipient_id: string;
          sender_name: string;
          text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          sender_id?: string;
          recipient_id?: string;
          sender_name?: string;
          text?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      payment_disputes: {
        Row: {
          id: string;
          checkout_id: string;
          status: string;
          wallet_remaining: number | null;
          wallet_revoked: number | null;
          reconciled: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          checkout_id: string;
          status: string;
          wallet_remaining?: number | null;
          wallet_revoked?: number | null;
          reconciled?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          checkout_id?: string;
          status?: string;
          wallet_remaining?: number | null;
          wallet_revoked?: number | null;
          reconciled?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      post_comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          author_name: string;
          text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          author_name: string;
          text: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          author_id?: string;
          author_name?: string;
          text?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      post_likes: {
        Row: { post_id: string; user_id: string };
        Insert: { post_id: string; user_id: string };
        Update: { post_id?: string; user_id?: string };
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          author_id: string | null;
          author_name: string;
          trybe: string;
          kind: string;
          text: string;
          created_at: string;
          is_hidden: boolean;
          is_pinned: boolean;
          visibility: string;
        };
        Insert: {
          id?: string;
          author_id?: string | null;
          author_name: string;
          trybe: string;
          kind?: string;
          text: string;
          created_at?: string;
          is_hidden?: boolean;
          is_pinned?: boolean;
          visibility?: string;
        };
        Update: {
          id?: string;
          author_id?: string | null;
          author_name?: string;
          trybe?: string;
          kind?: string;
          text?: string;
          created_at?: string;
          is_hidden?: boolean;
          is_pinned?: boolean;
          visibility?: string;
        };
        Relationships: [];
      };
      private_booking_holds: {
        Row: {
          id: string;
          trainer_id: string;
          member_id: string;
          day: string;
          time: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          member_id: string;
          day: string;
          time: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          member_id?: string;
          day?: string;
          time?: string;
          expires_at?: string;
        };
        Relationships: [];
      };
      private_session_access: {
        Row: {
          checkout_id: string;
          trainer_id: string;
          member_id: string;
          day: string;
          time: string;
          starts_at: string;
          status: string;
          created_at: string;
        };
        Insert: {
          checkout_id: string;
          trainer_id: string;
          member_id: string;
          day: string;
          time: string;
          starts_at: string;
          status: string;
          created_at?: string;
        };
        Update: {
          checkout_id?: string;
          trainer_id?: string;
          member_id?: string;
          day?: string;
          time?: string;
          starts_at?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          name: string;
          role: string;
          tokens: number;
          height: number | null;
          weight: number | null;
          goal: string | null;
          level: string | null;
          prefs: string | null;
          postpartum: boolean;
          dr_gap: string | null;
          weeks_postpartum: string | null;
          active_days: Json;
          reservations: Json;
          joined: Json;
          watch_later: Json;
          history: Json;
          partners: Json;
          ledger: Json;
          bookings: Json;
          weigh_ins: Json;
          scheduled: Json;
          created_at: string;
          updated_at: string;
          extra: Json;
          avatar_url: string | null;
        };
        Insert: {
          id: string;
          name?: string;
          role?: string;
          tokens?: number;
          height?: number | null;
          weight?: number | null;
          goal?: string | null;
          level?: string | null;
          prefs?: string | null;
          postpartum?: boolean;
          dr_gap?: string | null;
          weeks_postpartum?: string | null;
          active_days?: Json;
          reservations?: Json;
          joined?: Json;
          watch_later?: Json;
          history?: Json;
          partners?: Json;
          ledger?: Json;
          bookings?: Json;
          weigh_ins?: Json;
          scheduled?: Json;
          created_at?: string;
          updated_at?: string;
          extra?: Json;
          avatar_url?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          role?: string;
          tokens?: number;
          height?: number | null;
          weight?: number | null;
          goal?: string | null;
          level?: string | null;
          prefs?: string | null;
          postpartum?: boolean;
          dr_gap?: string | null;
          weeks_postpartum?: string | null;
          active_days?: Json;
          reservations?: Json;
          joined?: Json;
          watch_later?: Json;
          history?: Json;
          partners?: Json;
          ledger?: Json;
          bookings?: Json;
          weigh_ins?: Json;
          scheduled?: Json;
          created_at?: string;
          updated_at?: string;
          extra?: Json;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      push_reminders: {
        Row: {
          id: string;
          user_id: string;
          live_id: string;
          body: string;
          fire_at: string;
          sent: boolean;
        };
        Insert: {
          id?: string;
          user_id: string;
          live_id: string;
          body: string;
          fire_at: string;
          sent?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          live_id?: string;
          body?: string;
          fire_at?: string;
          sent?: boolean;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          endpoint: string;
          user_id: string;
          p256dh: string;
          auth: string;
          created_at: string;
        };
        Insert: {
          endpoint: string;
          user_id: string;
          p256dh: string;
          auth: string;
          created_at?: string;
        };
        Update: {
          endpoint?: string;
          user_id?: string;
          p256dh?: string;
          auth?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      recording_start_locks: {
        Row: { session_id: string; reserved_at: string };
        Insert: { session_id: string; reserved_at?: string };
        Update: { session_id?: string; reserved_at?: string };
        Relationships: [];
      };
      refund_jobs: {
        Row: {
          checkout_id: string;
          reason: string;
          requested_at: string;
          completed_at: string | null;
          provider_id: string | null;
          target_cents: number | null;
        };
        Insert: {
          checkout_id: string;
          reason: string;
          requested_at?: string;
          completed_at?: string | null;
          provider_id?: string | null;
          target_cents?: number | null;
        };
        Update: {
          checkout_id?: string;
          reason?: string;
          requested_at?: string;
          completed_at?: string | null;
          provider_id?: string | null;
          target_cents?: number | null;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          id: string;
          trainer_id: string;
          author_id: string | null;
          author_name: string;
          text: string;
          stars: number;
          reply: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          author_id?: string | null;
          author_name: string;
          text: string;
          stars?: number;
          reply?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          author_id?: string | null;
          author_name?: string;
          text?: string;
          stars?: number;
          reply?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      room_shutdown_jobs: {
        Row: { session_id: string; completed_at: string | null };
        Insert: { session_id: string; completed_at?: string | null };
        Update: { session_id?: string; completed_at?: string | null };
        Relationships: [];
      };
      trainer_accounts: {
        Row: {
          user_id: string;
          slug: string | null;
          stripe_account_id: string | null;
          payouts_enabled: boolean;
          created_at: string;
        };
        Insert: {
          user_id: string;
          slug?: string | null;
          stripe_account_id?: string | null;
          payouts_enabled?: boolean;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          slug?: string | null;
          stripe_account_id?: string | null;
          payouts_enabled?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      trainer_busy: {
        Row: {
          trainer_id: string;
          day: string;
          time: string;
          source: string;
          created_at: string;
        };
        Insert: {
          trainer_id: string;
          day: string;
          time?: string;
          source?: string;
          created_at?: string;
        };
        Update: {
          trainer_id?: string;
          day?: string;
          time?: string;
          source?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      trainer_earnings: {
        Row: {
          id: string;
          trainer_slug: string;
          source: string;
          ref: string;
          gross_cents: number;
          fee_cents: number;
          net_cents: number;
          share_pct: number;
          payout_cents: number;
          status: string;
          transfer_id: string | null;
          created_at: string;
          transfer_reversed_cents: number;
          reversal_target_cents: number;
          withheld_cents: number;
          operation_key: string | null;
          operation_kind: string | null;
          operation_amount: number | null;
          operation_target: number | null;
          operation_lease_until: string | null;
          adjustment_for: string | null;
        };
        Insert: {
          id?: string;
          trainer_slug: string;
          source: string;
          ref: string;
          gross_cents: number;
          fee_cents: number;
          net_cents: number;
          share_pct: number;
          payout_cents: number;
          status?: string;
          transfer_id?: string | null;
          created_at?: string;
          transfer_reversed_cents?: number;
          reversal_target_cents?: number;
          withheld_cents?: number;
          operation_key?: string | null;
          operation_kind?: string | null;
          operation_amount?: number | null;
          operation_target?: number | null;
          operation_lease_until?: string | null;
          adjustment_for?: string | null;
        };
        Update: {
          id?: string;
          trainer_slug?: string;
          source?: string;
          ref?: string;
          gross_cents?: number;
          fee_cents?: number;
          net_cents?: number;
          share_pct?: number;
          payout_cents?: number;
          status?: string;
          transfer_id?: string | null;
          created_at?: string;
          transfer_reversed_cents?: number;
          reversal_target_cents?: number;
          withheld_cents?: number;
          operation_key?: string | null;
          operation_kind?: string | null;
          operation_amount?: number | null;
          operation_target?: number | null;
          operation_lease_until?: string | null;
          adjustment_for?: string | null;
        };
        Relationships: [];
      };
      trainer_program_workouts: {
        Row: { program_id: string; video_id: string; position: number };
        Insert: { program_id: string; video_id: string; position: number };
        Update: { program_id?: string; video_id?: string; position?: number };
        Relationships: [];
      };
      trainer_programs: {
        Row: {
          id: string;
          trainer_id: string;
          title: string;
          description: string;
          published: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          title: string;
          description?: string;
          published?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          title?: string;
          description?: string;
          published?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      trainer_store_items: {
        Row: {
          id: string;
          trainer_id: string;
          title: string;
          description: string;
          price_cents: number;
          image_url: string | null;
          external_url: string;
          item_type: string;
          published: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          title: string;
          description?: string;
          price_cents?: number;
          image_url?: string | null;
          external_url: string;
          item_type?: string;
          published?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          title?: string;
          description?: string;
          price_cents?: number;
          image_url?: string | null;
          external_url?: string;
          item_type?: string;
          published?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      trainer_videos: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          category: string;
          level: string;
          path: string;
          created_at: string;
          minutes: number;
          breaks: number[];
          equipment: string;
          pregnancy_safe: boolean;
          playlist: string;
          break_seconds: number;
          goals: string[];
          review_status: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          review_note: string;
          required_equipment: string[] | null;
          optional_equipment: string[] | null;
          description: string;
          spotify_url: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          category?: string;
          level?: string;
          path: string;
          created_at?: string;
          minutes?: number;
          breaks?: number[];
          equipment?: string;
          pregnancy_safe?: boolean;
          playlist?: string;
          break_seconds?: number;
          goals?: string[];
          review_status?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          review_note?: string;
          required_equipment?: string[] | null;
          optional_equipment?: string[] | null;
          description?: string;
          spotify_url?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          category?: string;
          level?: string;
          path?: string;
          created_at?: string;
          minutes?: number;
          breaks?: number[];
          equipment?: string;
          pregnancy_safe?: boolean;
          playlist?: string;
          break_seconds?: number;
          goals?: string[];
          review_status?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          review_note?: string;
          required_equipment?: string[] | null;
          optional_equipment?: string[] | null;
          description?: string;
          spotify_url?: string | null;
        };
        Relationships: [];
      };
      trybe_memberships: {
        Row: { user_id: string; trybe_id: string; joined_at: string };
        Insert: { user_id: string; trybe_id: string; joined_at?: string };
        Update: { user_id?: string; trybe_id?: string; joined_at?: string };
        Relationships: [];
      };
      user_roles: {
        Row: { id: string; user_id: string; role: string };
        Insert: { id?: string; user_id: string; role: string };
        Update: { id?: string; user_id?: string; role?: string };
        Relationships: [];
      };
      video_uploads: {
        Row: {
          guid: string;
          user_id: string;
          library_id: string;
          created_at: string;
        };
        Insert: {
          guid: string;
          user_id: string;
          library_id: string;
          created_at?: string;
        };
        Update: {
          guid?: string;
          user_id?: string;
          library_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      waitlist_entries: {
        Row: {
          id: string;
          email: string;
          role: string;
          created_at: string;
          heard_from: string | null;
          live_class_interest: string | null;
          notify_new_coaches: boolean;
        };
        Insert: {
          id?: string;
          email: string;
          role?: string;
          created_at?: string;
          heard_from?: string | null;
          live_class_interest?: string | null;
          notify_new_coaches?: boolean;
        };
        Update: {
          id?: string;
          email?: string;
          role?: string;
          created_at?: string;
          heard_from?: string | null;
          live_class_interest?: string | null;
          notify_new_coaches?: boolean;
        };
        Relationships: [];
      };
      wallet_redemptions: {
        Row: {
          id: string;
          lot_id: string;
          unit_index: number;
          user_id: string;
          session_id: string;
          cancelled: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          lot_id: string;
          unit_index: number;
          user_id: string;
          session_id: string;
          cancelled?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          lot_id?: string;
          unit_index?: number;
          user_id?: string;
          session_id?: string;
          cancelled?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      wallet_token_lots: {
        Row: {
          id: string;
          user_id: string;
          purchased: number;
          remaining: number;
          gross_cents: number;
          fee_cents: number;
          created_at: string;
          revoked: number;
          frozen: boolean;
        };
        Insert: {
          id: string;
          user_id: string;
          purchased: number;
          remaining: number;
          gross_cents: number;
          fee_cents: number;
          created_at?: string;
          revoked?: number;
          frozen?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          purchased?: number;
          remaining?: number;
          gross_cents?: number;
          fee_cents?: number;
          created_at?: string;
          revoked?: number;
          frozen?: boolean;
        };
        Relationships: [];
      };
      wallet_token_units: {
        Row: {
          lot_id: string;
          unit_index: number;
          state: string;
          redemption_id: string | null;
        };
        Insert: {
          lot_id: string;
          unit_index: number;
          state: string;
          redemption_id?: string | null;
        };
        Update: {
          lot_id?: string;
          unit_index?: number;
          state?: string;
          redemption_id?: string | null;
        };
        Relationships: [];
      };
      water_break_campaigns: {
        Row: {
          id: string;
          title: string;
          creative_url: string;
          destination_url: string;
          active: boolean;
          start_at: string | null;
          end_at: string | null;
          created_at: string;
          creative_type: string;
        };
        Insert: {
          id?: string;
          title: string;
          creative_url: string;
          destination_url: string;
          active?: boolean;
          start_at?: string | null;
          end_at?: string | null;
          created_at?: string;
          creative_type?: string;
        };
        Update: {
          id?: string;
          title?: string;
          creative_url?: string;
          destination_url?: string;
          active?: boolean;
          start_at?: string | null;
          end_at?: string | null;
          created_at?: string;
          creative_type?: string;
        };
        Relationships: [];
      };
      water_break_events: {
        Row: {
          id: string;
          campaign_id: string;
          video_id: string;
          viewer_id: string | null;
          break_second: number;
          event_type: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          video_id: string;
          viewer_id?: string | null;
          break_second: number;
          event_type: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          video_id?: string;
          viewer_id?: string | null;
          break_second?: number;
          event_type?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      water_break_impressions: {
        Row: {
          id: string;
          campaign_id: string;
          video_id: string;
          playback_id: string;
          break_second: number;
          recorded_at: string;
          viewer_id: string | null;
          impression_day: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          video_id: string;
          playback_id: string;
          break_second: number;
          recorded_at?: string;
          viewer_id?: string | null;
          impression_day?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          video_id?: string;
          playback_id?: string;
          break_second?: number;
          recorded_at?: string;
          viewer_id?: string | null;
          impression_day?: string;
        };
        Relationships: [];
      };
      youth_consents: {
        Row: {
          id: string;
          user_id: string;
          contributor_name: string;
          contributor_age: number;
          guardian_name: string;
          guardian_email: string;
          guardian_signature: string;
          release_agreed: boolean;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          contributor_name: string;
          contributor_age: number;
          guardian_name: string;
          guardian_email: string;
          guardian_signature: string;
          release_agreed?: boolean;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          contributor_name?: string;
          contributor_age?: number;
          guardian_name?: string;
          guardian_email?: string;
          guardian_signature?: string;
          release_agreed?: boolean;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      apply_checkout_refund: {
        Args: {
          p_checkout_id: string;
          p_refund_cents: number;
          p_fully_refunded: boolean;
        };
        Returns: undefined;
      };
      apply_paid_live_checkout: {
        Args: {
          p_checkout_id: string;
          p_user_id: string;
          p_session_id: string;
          p_gross_cents: number;
          p_fee_cents: number;
        };
        Returns: undefined;
      };
      apply_paid_private_booking: {
        Args: {
          p_checkout_id: string;
          p_user_id: string;
          p_trainer_id: string;
          p_day: string;
          p_time: string;
          p_gross_cents: number;
          p_fee_cents: number;
          p_trainer_cents: number;
          p_hold_id?: string;
        };
        Returns: undefined;
      };
      apply_paid_token_checkout: {
        Args: {
          p_checkout_id: string;
          p_user_id: string;
          p_tokens: number;
          p_gross_cents: number;
          p_fee_cents: number;
        };
        Returns: undefined;
      };
      apply_payment_dispute: {
        Args: { p_id: string; p_checkout_id: string; p_status: string };
        Returns: undefined;
      };
      apply_verified_ad_settlement: {
        Args: {
          p_network: string;
          p_network_event_id: string;
          p_video_id: string;
          p_trainer_id: string;
          p_break_second: number;
          p_gross_cents: number;
          p_fee_cents: number;
          p_trainer_cents: number;
        };
        Returns: undefined;
      };
      can_edit_menu: { Args: { _client: string }; Returns: boolean };
      can_see_trybe: { Args: { _trybe: string }; Returns: boolean };
      cancel_private_session: {
        Args: { p_checkout_id: string; p_user_id: string };
        Returns: undefined;
      };
      claim_earning_operation: {
        Args: { p_id: string };
        Returns: Database["public"]["Tables"]["trainer_earnings"]["Row"][];
      };
      claim_recording_import: {
        Args: { p_egress_id: string };
        Returns: Database["public"]["Tables"]["live_recordings"]["Row"][];
      };
      finish_earning_operation: {
        Args: { p_id: string; p_key: string; p_provider_id: string };
        Returns: undefined;
      };
      get_live_checkout_intent: {
        Args: { p_user_id: string; p_session_id: string };
        Returns: string;
      };
      has_role: { Args: { _user_id: string; _role: string }; Returns: boolean };
      hold_private_booking: {
        Args: {
          p_trainer_id: string;
          p_member_id: string;
          p_day: string;
          p_time: string;
        };
        Returns: string;
      };
      joinable_trybe: { Args: { p_id: string }; Returns: boolean };
      moderate_trybe_post: {
        Args: { p_post_id: string; p_action: string; p_value: boolean };
        Returns: undefined;
      };
      partner_reservations: {
        Args: Record<never, never>;
        Returns: {
          friend_id: string;
          friend_name: string;
          reservations: Json;
        }[];
      };
      record_water_break_impression: {
        Args: {
          p_campaign_id: string;
          p_video_id: string;
          p_break_second: number;
          p_playback_id: string;
          p_viewer_id: string;
        };
        Returns: undefined;
      };
      redeem_paid_live_token: {
        Args: { p_user_id: string; p_session_id: string };
        Returns: undefined;
      };
      release_private_hold: {
        Args: { p_id: string; p_member_id: string };
        Returns: undefined;
      };
      reorder_program_workouts: {
        Args: { p_program_id: string; p_video_ids: string[] };
        Returns: undefined;
      };
      reserve_class_recording: {
        Args: { p_session_id: string };
        Returns: boolean;
      };
      restore_won_disputes: { Args: Record<never, never>; Returns: undefined };
      review_trainer_video: {
        Args: { p_video_id: string; p_status: string; p_note: string };
        Returns: undefined;
      };
      save_program_workouts: {
        Args: { p_program_id: string; p_video_ids: string[] };
        Returns: undefined;
      };
      share_menu: { Args: { _code: string }; Returns: string };
      sync_wallet_balance: { Args: { p_user_id: string }; Returns: undefined };
      trainer_attendance_count: {
        Args: { p_trainer_id: string };
        Returns: number;
      };
      trainer_is_eligible: {
        Args: { p_user_id: string; p_live?: boolean };
        Returns: boolean;
      };
      valid_iso_date: { Args: { p_value: string }; Returns: boolean };
    };
    Enums: { app_role: "admin" | "moderator" | "user" };
    CompositeTypes: Record<never, never>;
  };
};
type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const;
