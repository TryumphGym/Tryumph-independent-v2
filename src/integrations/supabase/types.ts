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
      account_activity_days: {
        Row: {
          user_id: string;
          day: string;
          time_zone: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          day: string;
          time_zone: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          day?: string;
          time_zone?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      account_notifications: {
        Row: {
          id: string;
          user_id: string;
          event_key: string;
          category: string;
          body: string;
          href: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_key: string;
          category: string;
          body: string;
          href?: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_key?: string;
          category?: string;
          body?: string;
          href?: string;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      account_restrictions: {
        Row: {
          user_id: string;
          scope: string;
          reason: string;
          admin_id: string;
          active: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          scope: string;
          reason: string;
          admin_id: string;
          active?: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          scope?: string;
          reason?: string;
          admin_id?: string;
          active?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
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
      audience_announcements: {
        Row: {
          id: string;
          body: string;
          audience: string;
          author_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          body: string;
          audience: string;
          author_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          body?: string;
          audience?: string;
          author_id?: string;
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
      community_ad_config: {
        Row: {
          singleton: boolean;
          enabled: boolean;
          first_after: number;
          spacing: number;
        };
        Insert: {
          singleton?: boolean;
          enabled?: boolean;
          first_after?: number;
          spacing?: number;
        };
        Update: {
          singleton?: boolean;
          enabled?: boolean;
          first_after?: number;
          spacing?: number;
        };
        Relationships: [];
      };
      community_ad_creatives: {
        Row: {
          id: string;
          title: string;
          body: string;
          external_url: string;
          enabled: boolean;
        };
        Insert: {
          id?: string;
          title: string;
          body: string;
          external_url: string;
          enabled?: boolean;
        };
        Update: {
          id?: string;
          title?: string;
          body?: string;
          external_url?: string;
          enabled?: boolean;
        };
        Relationships: [];
      };
      community_ad_placements: {
        Row: { trybe_id: string; enabled: boolean; sensitive: boolean };
        Insert: { trybe_id: string; enabled?: boolean; sensitive?: boolean };
        Update: { trybe_id?: string; enabled?: boolean; sensitive?: boolean };
        Relationships: [];
      };
      community_ad_receipts: {
        Row: {
          provider_event: string;
          provider: string;
          gross_cents: number;
          fee_cents: number;
          platform_net_cents: number | null;
          created_at: string;
        };
        Insert: {
          provider_event: string;
          provider: string;
          gross_cents: number;
          fee_cents: number;
          platform_net_cents?: number | null;
          created_at?: string;
        };
        Update: {
          provider_event?: string;
          provider?: string;
          gross_cents?: number;
          fee_cents?: number;
          platform_net_cents?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      community_ad_reports: {
        Row: {
          id: string;
          creative_id: string;
          user_id: string;
          reason: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          creative_id: string;
          user_id: string;
          reason: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          creative_id?: string;
          user_id?: string;
          reason?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      community_ad_seen: {
        Row: { session_id: string; post_id: string };
        Insert: { session_id: string; post_id: string };
        Update: { session_id?: string; post_id?: string };
        Relationships: [];
      };
      community_ad_sessions: {
        Row: {
          id: string;
          user_id: string;
          organic_count: number;
          last_ad_at: number;
          expires_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          organic_count?: number;
          last_ad_at?: number;
          expires_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          organic_count?: number;
          last_ad_at?: number;
          expires_at?: string;
        };
        Relationships: [];
      };
      community_media_config: {
        Row: {
          singleton: boolean;
          enabled: boolean;
          max_photos: number;
          max_bytes: number;
        };
        Insert: {
          singleton?: boolean;
          enabled?: boolean;
          max_photos?: number;
          max_bytes?: number;
        };
        Update: {
          singleton?: boolean;
          enabled?: boolean;
          max_photos?: number;
          max_bytes?: number;
        };
        Relationships: [];
      };
      contact_delivery_requests: {
        Row: {
          request_id: string;
          requester_hash: string;
          payload_hash: string;
          status: string;
          attempts: number;
          lease_until: string;
          provider_id: string | null;
          last_error: string | null;
          created_at: string;
        };
        Insert: {
          request_id: string;
          requester_hash: string;
          payload_hash: string;
          status?: string;
          attempts?: number;
          lease_until?: string;
          provider_id?: string | null;
          last_error?: string | null;
          created_at?: string;
        };
        Update: {
          request_id?: string;
          requester_hash?: string;
          payload_hash?: string;
          status?: string;
          attempts?: number;
          lease_until?: string;
          provider_id?: string | null;
          last_error?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      content_reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: string;
          target_id: string;
          reason: string;
          details: string;
          evidence: string | null;
          status: string;
          review_note: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          target_type: string;
          target_id: string;
          reason: string;
          details?: string;
          evidence?: string | null;
          status?: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          target_type?: string;
          target_id?: string;
          reason?: string;
          details?: string;
          evidence?: string | null;
          status?: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      creator_comment_holds: {
        Row: {
          comment_id: string;
          trainer_id: string;
          hidden: boolean;
          reason: string;
          updated_at: string;
        };
        Insert: {
          comment_id: string;
          trainer_id: string;
          hidden: boolean;
          reason: string;
          updated_at?: string;
        };
        Update: {
          comment_id?: string;
          trainer_id?: string;
          hidden?: boolean;
          reason?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      creator_commerce: {
        Row: {
          singleton: boolean;
          enabled: boolean;
          commission_bps: number;
          terms_version: string | null;
          approved_by: string | null;
          approved_at: string | null;
          min_price_cents: number;
          max_price_cents: number;
          recommended_price_cents: number;
        };
        Insert: {
          singleton?: boolean;
          enabled?: boolean;
          commission_bps?: number;
          terms_version?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          min_price_cents?: number;
          max_price_cents?: number;
          recommended_price_cents?: number;
        };
        Update: {
          singleton?: boolean;
          enabled?: boolean;
          commission_bps?: number;
          terms_version?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          min_price_cents?: number;
          max_price_cents?: number;
          recommended_price_cents?: number;
        };
        Relationships: [];
      };
      creator_customers: {
        Row: { user_id: string; customer_id: string };
        Insert: { user_id: string; customer_id: string };
        Update: { user_id?: string; customer_id?: string };
        Relationships: [];
      };
      creator_disputes: {
        Row: { id: string; order_id: string; status: string };
        Insert: { id: string; order_id: string; status: string };
        Update: { id?: string; order_id?: string; status?: string };
        Relationships: [];
      };
      creator_follow_events: {
        Row: {
          id: number;
          trainer_id: string;
          user_id: string;
          followed: boolean;
          created_at: string;
        };
        Insert: {
          id: number;
          trainer_id: string;
          user_id: string;
          followed: boolean;
          created_at?: string;
        };
        Update: {
          id?: number;
          trainer_id?: string;
          user_id?: string;
          followed?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      creator_maintenance_state: {
        Row: { singleton: boolean; cursor_at: string; cursor_id: string };
        Insert: { singleton?: boolean; cursor_at?: string; cursor_id?: string };
        Update: { singleton?: boolean; cursor_at?: string; cursor_id?: string };
        Relationships: [];
      };
      creator_offers: {
        Row: {
          trainer_id: string;
          title: string;
          description: string;
          price_cents: number;
          currency: string;
          enabled: boolean;
          blocked: boolean;
          revision: number;
          updated_at: string;
        };
        Insert: {
          trainer_id: string;
          title: string;
          description?: string;
          price_cents: number;
          currency?: string;
          enabled?: boolean;
          blocked?: boolean;
          revision?: number;
          updated_at?: string;
        };
        Update: {
          trainer_id?: string;
          title?: string;
          description?: string;
          price_cents?: number;
          currency?: string;
          enabled?: boolean;
          blocked?: boolean;
          revision?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      creator_orders: {
        Row: {
          id: string;
          user_id: string;
          trainer_id: string;
          revision: number;
          price_cents: number;
          commission_bps: number;
          terms_version: string;
          consent_version: string;
          consented_at: string;
          destination: string;
          checkout_id: string | null;
          subscription_id: string | null;
          customer_id: string | null;
          state: string;
          billing_status: string;
          cancel_at_period_end: boolean;
          renewal_stop_requested: boolean;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          trainer_id: string;
          revision: number;
          price_cents: number;
          commission_bps: number;
          terms_version: string;
          consent_version?: string;
          consented_at?: string;
          destination: string;
          checkout_id?: string | null;
          subscription_id?: string | null;
          customer_id?: string | null;
          state?: string;
          billing_status?: string;
          cancel_at_period_end?: boolean;
          renewal_stop_requested?: boolean;
          created_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          trainer_id?: string;
          revision?: number;
          price_cents?: number;
          commission_bps?: number;
          terms_version?: string;
          consent_version?: string;
          consented_at?: string;
          destination?: string;
          checkout_id?: string | null;
          subscription_id?: string | null;
          customer_id?: string | null;
          state?: string;
          billing_status?: string;
          cancel_at_period_end?: boolean;
          renewal_stop_requested?: boolean;
          created_at?: string;
          expires_at?: string;
        };
        Relationships: [];
      };
      creator_partnerships: {
        Row: {
          id: string;
          trainer_id: string;
          sender_id: string;
          name: string;
          organization: string;
          email: string;
          collaboration: string;
          description: string;
          budget: string;
          timeline: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          sender_id: string;
          name: string;
          organization: string;
          email: string;
          collaboration: string;
          description: string;
          budget?: string;
          timeline?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          sender_id?: string;
          name?: string;
          organization?: string;
          email?: string;
          collaboration?: string;
          description?: string;
          budget?: string;
          timeline?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      creator_perks: {
        Row: {
          id: string;
          category: string;
          partner: string;
          description: string;
          eligibility: string;
          benefit: string;
          expires_at: string | null;
          redemption: string;
          url: string | null;
          disclosure: string;
          credential_pattern: string;
          published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category: string;
          partner: string;
          description: string;
          eligibility: string;
          benefit: string;
          expires_at?: string | null;
          redemption: string;
          url?: string | null;
          disclosure: string;
          credential_pattern?: string;
          published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category?: string;
          partner?: string;
          description?: string;
          eligibility?: string;
          benefit?: string;
          expires_at?: string | null;
          redemption?: string;
          url?: string | null;
          disclosure?: string;
          credential_pattern?: string;
          published?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      creator_playbacks: {
        Row: {
          id: string;
          user_id: string;
          video_id: string;
          trainer_id: string;
          reported_seconds: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          video_id: string;
          trainer_id: string;
          reported_seconds?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          video_id?: string;
          trainer_id?: string;
          reported_seconds?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      creator_prices: {
        Row: {
          trainer_id: string;
          revision: number;
          price_cents: number;
          stripe_price_id: string | null;
          created_at: string;
        };
        Insert: {
          trainer_id: string;
          revision: number;
          price_cents: number;
          stripe_price_id?: string | null;
          created_at?: string;
        };
        Update: {
          trainer_id?: string;
          revision?: number;
          price_cents?: number;
          stripe_price_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      creator_receipts: {
        Row: {
          id: string;
          order_id: string;
          invoice_id: string;
          intent_id: string;
          user_id: string;
          trainer_id: string;
          destination: string;
          price_cents: number;
          fee_cents: number;
          commission_bps: number;
          refunded_cents: number;
          refund_pending: boolean;
          fulfillable: boolean;
          period_start: string;
          period_end: string;
          paid_at: string;
          payout_dirty: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          invoice_id: string;
          intent_id: string;
          user_id: string;
          trainer_id: string;
          destination: string;
          price_cents: number;
          fee_cents: number;
          commission_bps: number;
          refunded_cents?: number;
          refund_pending?: boolean;
          fulfillable: boolean;
          period_start: string;
          period_end: string;
          paid_at: string;
          payout_dirty?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          invoice_id?: string;
          intent_id?: string;
          user_id?: string;
          trainer_id?: string;
          destination?: string;
          price_cents?: number;
          fee_cents?: number;
          commission_bps?: number;
          refunded_cents?: number;
          refund_pending?: boolean;
          fulfillable?: boolean;
          period_start?: string;
          period_end?: string;
          paid_at?: string;
          payout_dirty?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      creator_refund_jobs: {
        Row: {
          receipt_id: string;
          reason: string;
          provider_id: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          receipt_id: string;
          reason: string;
          provider_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          receipt_id?: string;
          reason?: string;
          provider_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      creator_release_events: {
        Row: { video_id: string; public_at: string; recorded_at: string };
        Insert: { video_id: string; public_at: string; recorded_at?: string };
        Update: { video_id?: string; public_at?: string; recorded_at?: string };
        Relationships: [];
      };
      creator_transfer_operations: {
        Row: {
          id: string;
          order_id: string;
          sequence: number;
          kind: string;
          amount: number;
          transfer_id: string | null;
          provider_id: string | null;
          lease_until: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          sequence: number;
          kind: string;
          amount: number;
          transfer_id?: string | null;
          provider_id?: string | null;
          lease_until?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          sequence?: number;
          kind?: string;
          amount?: number;
          transfer_id?: string | null;
          provider_id?: string | null;
          lease_until?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      creator_video_access: {
        Row: {
          video_id: string;
          trainer_id: string;
          audience: string;
          public_at: string | null;
          updated_at: string;
        };
        Insert: {
          video_id: string;
          trainer_id: string;
          audience: string;
          public_at?: string | null;
          updated_at?: string;
        };
        Update: {
          video_id?: string;
          trainer_id?: string;
          audience?: string;
          public_at?: string | null;
          updated_at?: string;
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
      discoverable_lives: {
        Row: {
          id: string | null;
          trainer_id: string | null;
          trainer_name: string | null;
          title: string | null;
          category: string | null;
          level: string | null;
          starts_at: string | null;
          minutes: number | null;
          description: string | null;
          created_at: string | null;
          status: string | null;
          price_cents: number | null;
          recording_enabled: boolean | null;
          discovery_tags: string[] | null;
          equipment_notes: string | null;
          modification_notes: string | null;
          discovery_focus_tags: string[] | null;
          intensity: string | null;
          session_type: string | null;
        };
        Insert: {
          id?: string | null;
          trainer_id?: string | null;
          trainer_name?: string | null;
          title?: string | null;
          category?: string | null;
          level?: string | null;
          starts_at?: string | null;
          minutes?: number | null;
          description?: string | null;
          created_at?: string | null;
          status?: string | null;
          price_cents?: number | null;
          recording_enabled?: boolean | null;
          discovery_tags?: string[] | null;
          equipment_notes?: string | null;
          modification_notes?: string | null;
          discovery_focus_tags?: string[] | null;
          intensity?: string | null;
          session_type?: string | null;
        };
        Update: {
          id?: string | null;
          trainer_id?: string | null;
          trainer_name?: string | null;
          title?: string | null;
          category?: string | null;
          level?: string | null;
          starts_at?: string | null;
          minutes?: number | null;
          description?: string | null;
          created_at?: string | null;
          status?: string | null;
          price_cents?: number | null;
          recording_enabled?: boolean | null;
          discovery_tags?: string[] | null;
          equipment_notes?: string | null;
          modification_notes?: string | null;
          discovery_focus_tags?: string[] | null;
          intensity?: string | null;
          session_type?: string | null;
        };
        Relationships: [];
      };
      discoverable_programs: {
        Row: {
          id: string | null;
          trainer_id: string | null;
          title: string | null;
          description: string | null;
          published: boolean | null;
          created_at: string | null;
          builder_version: number | null;
          summary: Json | null;
          current_edition: string | null;
          blocked: boolean | null;
          discovery_focus_tags: string[] | null;
        };
        Insert: {
          id?: string | null;
          trainer_id?: string | null;
          title?: string | null;
          description?: string | null;
          published?: boolean | null;
          created_at?: string | null;
          builder_version?: number | null;
          summary?: Json | null;
          current_edition?: string | null;
          blocked?: boolean | null;
          discovery_focus_tags?: string[] | null;
        };
        Update: {
          id?: string | null;
          trainer_id?: string | null;
          title?: string | null;
          description?: string | null;
          published?: boolean | null;
          created_at?: string | null;
          builder_version?: number | null;
          summary?: Json | null;
          current_edition?: string | null;
          blocked?: boolean | null;
          discovery_focus_tags?: string[] | null;
        };
        Relationships: [];
      };
      discovery_categories: {
        Row: { id: string; group_name: string; label: string };
        Insert: { id: string; group_name: string; label: string };
        Update: { id?: string; group_name?: string; label?: string };
        Relationships: [];
      };
      discovery_demand: {
        Row: {
          member_key: string;
          day: string;
          source: string;
          topic: Json;
          supply: number;
        };
        Insert: {
          member_key: string;
          day?: string;
          source: string;
          topic: Json;
          supply: number;
        };
        Update: {
          member_key?: string;
          day?: string;
          source?: string;
          topic?: Json;
          supply?: number;
        };
        Relationships: [];
      };
      discovery_privacy: {
        Row: { singleton: boolean; salt: string };
        Insert: { singleton?: boolean; salt?: string };
        Update: { singleton?: boolean; salt?: string };
        Relationships: [];
      };
      friend_requests: {
        Row: {
          requester_id: string;
          recipient_id: string;
          requester_name: string;
          recipient_name: string;
          created_at: string;
        };
        Insert: {
          requester_id: string;
          recipient_id: string;
          requester_name: string;
          recipient_name: string;
          created_at?: string;
        };
        Update: {
          requester_id?: string;
          recipient_id?: string;
          requester_name?: string;
          recipient_name?: string;
          created_at?: string;
        };
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
      launch_schema_versions: {
        Row: { version: string; applied_at: string };
        Insert: { version: string; applied_at?: string };
        Update: { version?: string; applied_at?: string };
        Relationships: [];
      };
      legacy_friendship_grants: {
        Row: { user_id: string; friend_id: string };
        Insert: { user_id: string; friend_id: string };
        Update: { user_id?: string; friend_id?: string };
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
      live_payment_links: {
        Row: {
          checkout_id: string;
          user_id: string;
          session_id: string;
          created_at: string;
        };
        Insert: {
          checkout_id: string;
          user_id: string;
          session_id: string;
          created_at?: string;
        };
        Update: {
          checkout_id?: string;
          user_id?: string;
          session_id?: string;
          created_at?: string;
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
          discovery_tags: string[];
          equipment_notes: string;
          modification_notes: string;
          intensity: string;
          session_type: string;
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
          discovery_tags?: string[];
          equipment_notes?: string;
          modification_notes?: string;
          intensity?: string;
          session_type?: string;
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
          discovery_tags?: string[];
          equipment_notes?: string;
          modification_notes?: string;
          intensity?: string;
          session_type?: string;
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
      message_controls: {
        Row: {
          user_id: string;
          other_id: string;
          blocked: boolean;
          muted: boolean;
          read_at: string | null;
        };
        Insert: {
          user_id: string;
          other_id: string;
          blocked?: boolean;
          muted?: boolean;
          read_at?: string | null;
        };
        Update: {
          user_id?: string;
          other_id?: string;
          blocked?: boolean;
          muted?: boolean;
          read_at?: string | null;
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
      moderation_actions: {
        Row: {
          id: string;
          actor_id: string;
          target_type: string;
          target_id: string;
          action: string;
          note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id: string;
          target_type: string;
          target_id: string;
          action: string;
          note?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string;
          target_type?: string;
          target_id?: string;
          action?: string;
          note?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      moderation_appeals: {
        Row: {
          id: string;
          user_id: string;
          body: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          body: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          body?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          user_id: string;
          session_updates: boolean;
          credential_updates: boolean;
          friend_activity: boolean;
          share_live_activity: boolean;
          poll_updates: boolean;
          creator_updates: boolean;
          subscriber_lives: boolean;
        };
        Insert: {
          user_id: string;
          session_updates?: boolean;
          credential_updates?: boolean;
          friend_activity?: boolean;
          share_live_activity?: boolean;
          poll_updates?: boolean;
          creator_updates?: boolean;
          subscriber_lives?: boolean;
        };
        Update: {
          user_id?: string;
          session_updates?: boolean;
          credential_updates?: boolean;
          friend_activity?: boolean;
          share_live_activity?: boolean;
          poll_updates?: boolean;
          creator_updates?: boolean;
          subscriber_lives?: boolean;
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
          is_hidden: boolean;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          author_name: string;
          text: string;
          created_at?: string;
          is_hidden?: boolean;
        };
        Update: {
          id?: string;
          post_id?: string;
          author_id?: string;
          author_name?: string;
          text?: string;
          created_at?: string;
          is_hidden?: boolean;
        };
        Relationships: [];
      };
      post_likes: {
        Row: { post_id: string; user_id: string };
        Insert: { post_id: string; user_id: string };
        Update: { post_id?: string; user_id?: string };
        Relationships: [];
      };
      post_photos: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          alt: string;
          status: string;
          specialist_cleared: boolean;
          original_path: string;
          display_path: string | null;
          thumbnail_path: string | null;
          review_revision: number | null;
          processing_until: string | null;
          processing_attempts: number;
          removed_at: string | null;
          created_at: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          alt: string;
          status?: string;
          specialist_cleared?: boolean;
          original_path: string;
          display_path?: string | null;
          thumbnail_path?: string | null;
          review_revision?: number | null;
          processing_until?: string | null;
          processing_attempts?: number;
          removed_at?: string | null;
          created_at?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
        Update: {
          id?: string;
          post_id?: string;
          user_id?: string;
          alt?: string;
          status?: string;
          specialist_cleared?: boolean;
          original_path?: string;
          display_path?: string | null;
          thumbnail_path?: string | null;
          review_revision?: number | null;
          processing_until?: string | null;
          processing_attempts?: number;
          removed_at?: string | null;
          created_at?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
        };
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
          official: boolean;
          audience: string;
          media_revision: number;
          ad_safe: boolean;
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
          official?: boolean;
          audience?: string;
          media_revision?: number;
          ad_safe?: boolean;
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
          official?: boolean;
          audience?: string;
          media_revision?: number;
          ad_safe?: boolean;
        };
        Relationships: [];
      };
      private_balance_operations: {
        Row: {
          booking_id: string;
          operation_key: string;
          intent_id: string | null;
          checkout_id: string | null;
          lease_until: string;
          status: string;
          last_error: string | null;
          created_at: string;
        };
        Insert: {
          booking_id: string;
          operation_key: string;
          intent_id?: string | null;
          checkout_id?: string | null;
          lease_until?: string;
          status?: string;
          last_error?: string | null;
          created_at?: string;
        };
        Update: {
          booking_id?: string;
          operation_key?: string;
          intent_id?: string | null;
          checkout_id?: string | null;
          lease_until?: string;
          status?: string;
          last_error?: string | null;
          created_at?: string;
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
          total_cents: number | null;
          terms_version: string | null;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          member_id: string;
          day: string;
          time: string;
          expires_at?: string;
          total_cents?: number | null;
          terms_version?: string | null;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          member_id?: string;
          day?: string;
          time?: string;
          expires_at?: string;
          total_cents?: number | null;
          terms_version?: string | null;
        };
        Relationships: [];
      };
      private_booking_payments: {
        Row: {
          payment_id: string;
          booking_id: string;
          stage: string;
          intent_id: string | null;
          gross_cents: number;
          fee_cents: number;
          refunded_cents: number;
          created_at: string;
        };
        Insert: {
          payment_id: string;
          booking_id: string;
          stage: string;
          intent_id?: string | null;
          gross_cents: number;
          fee_cents: number;
          refunded_cents?: number;
          created_at?: string;
        };
        Update: {
          payment_id?: string;
          booking_id?: string;
          stage?: string;
          intent_id?: string | null;
          gross_cents?: number;
          fee_cents?: number;
          refunded_cents?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      private_payment_methods: {
        Row: {
          booking_id: string;
          customer_id: string;
          payment_method_id: string;
        };
        Insert: {
          booking_id: string;
          customer_id: string;
          payment_method_id: string;
        };
        Update: {
          booking_id?: string;
          customer_id?: string;
          payment_method_id?: string;
        };
        Relationships: [];
      };
      private_reschedule_requests: {
        Row: {
          id: string;
          booking_id: string;
          member_id: string;
          day: string;
          time: string;
          created_at: string;
          status: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          member_id: string;
          day: string;
          time: string;
          created_at?: string;
          status?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          member_id?: string;
          day?: string;
          time?: string;
          created_at?: string;
          status?: string;
        };
        Relationships: [];
      };
      private_room_shutdown_jobs: {
        Row: {
          booking_id: string;
          completed_at: string | null;
          last_error: string | null;
        };
        Insert: {
          booking_id: string;
          completed_at?: string | null;
          last_error?: string | null;
        };
        Update: {
          booking_id?: string;
          completed_at?: string | null;
          last_error?: string | null;
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
          payment_version: number;
          total_cents: number | null;
          deposit_cents: number | null;
          balance_cents: number | null;
          terms_version: string | null;
          both_present_at: string | null;
          delivered_at: string | null;
          member_confirmed_at: string | null;
          deposit_origin: string | null;
          transfer_used: boolean;
          transfer_from: string | null;
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
          payment_version?: number;
          total_cents?: number | null;
          deposit_cents?: number | null;
          balance_cents?: number | null;
          terms_version?: string | null;
          both_present_at?: string | null;
          delivered_at?: string | null;
          member_confirmed_at?: string | null;
          deposit_origin?: string | null;
          transfer_used?: boolean;
          transfer_from?: string | null;
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
          payment_version?: number;
          total_cents?: number | null;
          deposit_cents?: number | null;
          balance_cents?: number | null;
          terms_version?: string | null;
          both_present_at?: string | null;
          delivered_at?: string | null;
          member_confirmed_at?: string | null;
          deposit_origin?: string | null;
          transfer_used?: boolean;
          transfer_from?: string | null;
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
          focus_tags: string[];
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
          focus_tags?: string[];
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
          focus_tags?: string[];
        };
        Relationships: [];
      };
      program_assets: {
        Row: {
          id: string;
          trainer_id: string;
          path: string;
          title: string;
          review_status: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          path: string;
          title: string;
          review_status?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          path?: string;
          title?: string;
          review_status?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      program_audit: {
        Row: {
          id: string;
          actor: string | null;
          program_id: string | null;
          action: string;
          detail: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor?: string | null;
          program_id?: string | null;
          action: string;
          detail?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor?: string | null;
          program_id?: string | null;
          action?: string;
          detail?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      program_commerce: {
        Row: {
          singleton: boolean;
          enabled: boolean;
          commission_bps: number | null;
          terms_version: string | null;
          approved_by: string | null;
          approved_at: string | null;
        };
        Insert: {
          singleton?: boolean;
          enabled?: boolean;
          commission_bps?: number | null;
          terms_version?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
        };
        Update: {
          singleton?: boolean;
          enabled?: boolean;
          commission_bps?: number | null;
          terms_version?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
        };
        Relationships: [];
      };
      program_disputes: {
        Row: { id: string; order_id: string; status: string };
        Insert: { id: string; order_id: string; status: string };
        Update: { id?: string; order_id?: string; status?: string };
        Relationships: [];
      };
      program_download_events: {
        Row: {
          id: string;
          user_id: string;
          asset_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          asset_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          asset_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      program_download_progress: {
        Row: {
          user_id: string;
          edition_id: string;
          asset_id: string;
          completed: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          edition_id: string;
          asset_id: string;
          completed?: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          edition_id?: string;
          asset_id?: string;
          completed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      program_drafts: {
        Row: { program_id: string; document: Json; updated_at: string };
        Insert: { program_id: string; document: Json; updated_at?: string };
        Update: { program_id?: string; document?: Json; updated_at?: string };
        Relationships: [];
      };
      program_edition_assets: {
        Row: { edition_id: string; asset_id: string };
        Insert: { edition_id: string; asset_id: string };
        Update: { edition_id?: string; asset_id?: string };
        Relationships: [];
      };
      program_edition_images: {
        Row: { edition_id: string; image_id: string };
        Insert: { edition_id: string; image_id: string };
        Update: { edition_id?: string; image_id?: string };
        Relationships: [];
      };
      program_edition_videos: {
        Row: { edition_id: string; video_id: string };
        Insert: { edition_id: string; video_id: string };
        Update: { edition_id?: string; video_id?: string };
        Relationships: [];
      };
      program_editions: {
        Row: {
          id: string;
          program_id: string;
          version: number;
          document: Json;
          review_status: string;
          review_note: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          program_id: string;
          version: number;
          document: Json;
          review_status?: string;
          review_note?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          program_id?: string;
          version?: number;
          document?: Json;
          review_status?: string;
          review_note?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      program_enrollments: {
        Row: {
          user_id: string;
          program_id: string;
          edition_id: string;
          starts_at: string;
          expires_at: string | null;
          source: string;
          state: string;
          order_id: string | null;
          verification_reference: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          program_id: string;
          edition_id: string;
          starts_at?: string;
          expires_at?: string | null;
          source: string;
          state?: string;
          order_id?: string | null;
          verification_reference?: string | null;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          program_id?: string;
          edition_id?: string;
          starts_at?: string;
          expires_at?: string | null;
          source?: string;
          state?: string;
          order_id?: string | null;
          verification_reference?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      program_images: {
        Row: {
          id: string;
          trainer_id: string;
          object_path: string;
          review_status: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          object_path: string;
          review_status?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          object_path?: string;
          review_status?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      program_member_enrollments: {
        Row: {
          user_id: string | null;
          program_id: string | null;
          edition_id: string | null;
          source: string | null;
          state: string | null;
          verification_reference: string | null;
          starts_at: string | null;
          expires_at: string | null;
          created_at: string | null;
        };
        Insert: {
          user_id?: string | null;
          program_id?: string | null;
          edition_id?: string | null;
          source?: string | null;
          state?: string | null;
          verification_reference?: string | null;
          starts_at?: string | null;
          expires_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          user_id?: string | null;
          program_id?: string | null;
          edition_id?: string | null;
          source?: string | null;
          state?: string | null;
          verification_reference?: string | null;
          starts_at?: string | null;
          expires_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      program_orders: {
        Row: {
          id: string;
          program_id: string;
          edition_id: string;
          user_id: string;
          trainer_id: string;
          price_cents: number;
          access_days: number | null;
          commission_bps: number;
          terms_version: string;
          destination: string;
          checkout_id: string | null;
          intent_id: string | null;
          status: string;
          fee_cents: number | null;
          refunded_cents: number;
          refund_pending: boolean;
          payout_dirty: boolean;
          paid_at: string | null;
          created_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          program_id: string;
          edition_id: string;
          user_id: string;
          trainer_id: string;
          price_cents: number;
          access_days?: number | null;
          commission_bps: number;
          terms_version: string;
          destination: string;
          checkout_id?: string | null;
          intent_id?: string | null;
          status?: string;
          fee_cents?: number | null;
          refunded_cents?: number;
          refund_pending?: boolean;
          payout_dirty?: boolean;
          paid_at?: string | null;
          created_at?: string;
          expires_at?: string;
        };
        Update: {
          id?: string;
          program_id?: string;
          edition_id?: string;
          user_id?: string;
          trainer_id?: string;
          price_cents?: number;
          access_days?: number | null;
          commission_bps?: number;
          terms_version?: string;
          destination?: string;
          checkout_id?: string | null;
          intent_id?: string | null;
          status?: string;
          fee_cents?: number | null;
          refunded_cents?: number;
          refund_pending?: boolean;
          payout_dirty?: boolean;
          paid_at?: string | null;
          created_at?: string;
          expires_at?: string;
        };
        Relationships: [];
      };
      program_payout_operations: {
        Row: {
          id: string;
          order_id: string;
          sequence: number;
          kind: string;
          amount: number;
          transfer_id: string | null;
          provider_id: string | null;
          lease_until: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          sequence: number;
          kind: string;
          amount: number;
          transfer_id?: string | null;
          provider_id?: string | null;
          lease_until?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          sequence?: number;
          kind?: string;
          amount?: number;
          transfer_id?: string | null;
          provider_id?: string | null;
          lease_until?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      program_progress: {
        Row: {
          user_id: string;
          edition_id: string;
          step_id: string;
          completed: boolean;
          variation_id: string | null;
          elapsed_seconds: number;
          resumed_at: string;
        };
        Insert: {
          user_id: string;
          edition_id: string;
          step_id: string;
          completed?: boolean;
          variation_id?: string | null;
          elapsed_seconds?: number;
          resumed_at?: string;
        };
        Update: {
          user_id?: string;
          edition_id?: string;
          step_id?: string;
          completed?: boolean;
          variation_id?: string | null;
          elapsed_seconds?: number;
          resumed_at?: string;
        };
        Relationships: [];
      };
      program_refund_requests: {
        Row: {
          order_id: string;
          requested_by: string | null;
          reason: string;
          provider_id: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          order_id: string;
          requested_by?: string | null;
          reason: string;
          provider_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          order_id?: string;
          requested_by?: string | null;
          reason?: string;
          provider_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      program_subscription_enrollments: {
        Row: {
          user_id: string;
          edition_id: string;
          program_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          edition_id: string;
          program_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          edition_id?: string;
          program_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      program_usage: {
        Row: {
          id: string;
          user_id: string;
          edition_id: string;
          step_id: string;
          video_id: string;
          reported_seconds: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          edition_id: string;
          step_id: string;
          video_id: string;
          reported_seconds?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          edition_id?: string;
          step_id?: string;
          video_id?: string;
          reported_seconds?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      public_workout_catalog: {
        Row: {
          id: string | null;
          user_id: string | null;
          title: string | null;
          category: string | null;
          level: string | null;
          path: string | null;
          created_at: string | null;
          minutes: number | null;
          equipment: string | null;
          pregnancy_safe: boolean | null;
          playlist: string | null;
          breaks: number[] | null;
          break_seconds: number | null;
          required_equipment: string[] | null;
          optional_equipment: string[] | null;
          description: string | null;
          spotify_url: string | null;
          review_status: string | null;
          access_scope: string | null;
          discovery_tags: string[] | null;
          discovery_focus_tags: string[] | null;
          intensity: string | null;
          modification_notes: string | null;
        };
        Insert: {
          id?: string | null;
          user_id?: string | null;
          title?: string | null;
          category?: string | null;
          level?: string | null;
          path?: string | null;
          created_at?: string | null;
          minutes?: number | null;
          equipment?: string | null;
          pregnancy_safe?: boolean | null;
          playlist?: string | null;
          breaks?: number[] | null;
          break_seconds?: number | null;
          required_equipment?: string[] | null;
          optional_equipment?: string[] | null;
          description?: string | null;
          spotify_url?: string | null;
          review_status?: string | null;
          access_scope?: string | null;
          discovery_tags?: string[] | null;
          discovery_focus_tags?: string[] | null;
          intensity?: string | null;
          modification_notes?: string | null;
        };
        Update: {
          id?: string | null;
          user_id?: string | null;
          title?: string | null;
          category?: string | null;
          level?: string | null;
          path?: string | null;
          created_at?: string | null;
          minutes?: number | null;
          equipment?: string | null;
          pregnancy_safe?: boolean | null;
          playlist?: string | null;
          breaks?: number[] | null;
          break_seconds?: number | null;
          required_equipment?: string[] | null;
          optional_equipment?: string[] | null;
          description?: string | null;
          spotify_url?: string | null;
          review_status?: string | null;
          access_scope?: string | null;
          discovery_tags?: string[] | null;
          discovery_focus_tags?: string[] | null;
          intensity?: string | null;
          modification_notes?: string | null;
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
          last_error: string | null;
          attempts: number;
        };
        Insert: {
          checkout_id: string;
          reason: string;
          requested_at?: string;
          completed_at?: string | null;
          provider_id?: string | null;
          target_cents?: number | null;
          last_error?: string | null;
          attempts?: number;
        };
        Update: {
          checkout_id?: string;
          reason?: string;
          requested_at?: string;
          completed_at?: string | null;
          provider_id?: string | null;
          target_cents?: number | null;
          last_error?: string | null;
          attempts?: number;
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
      school_tutorials: {
        Row: {
          id: string;
          audience: string;
          category: string;
          title: string;
          instructions: string;
          screenshots: Json;
          video_id: string | null;
          published: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          audience: string;
          category: string;
          title: string;
          instructions?: string;
          screenshots?: Json;
          video_id?: string | null;
          published?: boolean;
          updated_at?: string;
        };
        Update: {
          id?: string;
          audience?: string;
          category?: string;
          title?: string;
          instructions?: string;
          screenshots?: Json;
          video_id?: string | null;
          published?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      spotlight_campaigns: {
        Row: {
          id: string;
          trainer_id: string;
          target_type: string;
          target_id: string;
          package_id: string;
          budget_cents: number;
          tags: string[];
          status: string;
          admin_eligible: boolean;
          admin_note: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          target_type: string;
          target_id: string;
          package_id: string;
          budget_cents: number;
          tags?: string[];
          status?: string;
          admin_eligible?: boolean;
          admin_note?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          target_type?: string;
          target_id?: string;
          package_id?: string;
          budget_cents?: number;
          tags?: string[];
          status?: string;
          admin_eligible?: boolean;
          admin_note?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      spotlight_packages: {
        Row: {
          id: string;
          days: number;
          price_cents: number;
          available: boolean;
          inventory: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          days: number;
          price_cents: number;
          available?: boolean;
          inventory?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          days?: number;
          price_cents?: number;
          available?: boolean;
          inventory?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriber_live_access: {
        Row: {
          session_id: string;
          user_id: string;
          reserved_at: string;
          attended_at: string | null;
          paid_rebooked_at: string | null;
        };
        Insert: {
          session_id: string;
          user_id: string;
          reserved_at?: string;
          attended_at?: string | null;
          paid_rebooked_at?: string | null;
        };
        Update: {
          session_id?: string;
          user_id?: string;
          reserved_at?: string;
          attended_at?: string | null;
          paid_rebooked_at?: string | null;
        };
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
      trainer_credential_requirements: {
        Row: {
          trainer_id: string;
          credential_name: string;
          created_by: string;
        };
        Insert: {
          trainer_id: string;
          credential_name: string;
          created_by: string;
        };
        Update: {
          trainer_id?: string;
          credential_name?: string;
          created_by?: string;
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
          fulfillment_pending: boolean;
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
          fulfillment_pending?: boolean;
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
          fulfillment_pending?: boolean;
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
          builder_version: number;
          summary: Json;
          current_edition: string | null;
          blocked: boolean;
        };
        Insert: {
          id?: string;
          trainer_id: string;
          title: string;
          description?: string;
          published?: boolean;
          created_at?: string;
          builder_version?: number;
          summary?: Json;
          current_edition?: string | null;
          blocked?: boolean;
        };
        Update: {
          id?: string;
          trainer_id?: string;
          title?: string;
          description?: string;
          published?: boolean;
          created_at?: string;
          builder_version?: number;
          summary?: Json;
          current_edition?: string | null;
          blocked?: boolean;
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
          access_scope: string;
          discovery_tags: string[];
          intensity: string;
          modification_notes: string;
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
          access_scope?: string;
          discovery_tags?: string[];
          intensity?: string;
          modification_notes?: string;
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
          access_scope?: string;
          discovery_tags?: string[];
          intensity?: string;
          modification_notes?: string;
        };
        Relationships: [];
      };
      trybe_memberships: {
        Row: { user_id: string; trybe_id: string; joined_at: string };
        Insert: { user_id: string; trybe_id: string; joined_at?: string };
        Update: { user_id?: string; trybe_id?: string; joined_at?: string };
        Relationships: [];
      };
      trybe_poll_ballots: {
        Row: { poll_id: string; user_id: string; updated_at: string };
        Insert: { poll_id: string; user_id: string; updated_at?: string };
        Update: { poll_id?: string; user_id?: string; updated_at?: string };
        Relationships: [];
      };
      trybe_poll_choices: {
        Row: { poll_id: string; user_id: string; option_id: string };
        Insert: { poll_id: string; user_id: string; option_id: string };
        Update: { poll_id?: string; user_id?: string; option_id?: string };
        Relationships: [];
      };
      trybe_poll_notice_jobs: {
        Row: {
          poll_id: string;
          cursor_id: string | null;
          finished_at: string | null;
          created_at: string;
        };
        Insert: {
          poll_id: string;
          cursor_id?: string | null;
          finished_at?: string | null;
          created_at?: string;
        };
        Update: {
          poll_id?: string;
          cursor_id?: string | null;
          finished_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      trybe_poll_options: {
        Row: { poll_id: string; id: string; position: number; label: string };
        Insert: {
          poll_id: string;
          id?: string;
          position: number;
          label: string;
        };
        Update: {
          poll_id?: string;
          id?: string;
          position?: number;
          label?: string;
        };
        Relationships: [];
      };
      trybe_polls: {
        Row: {
          post_id: string;
          question: string;
          description: string;
          max_selections: number;
          expires_at: string | null;
          closed_at: string | null;
          revision: number;
        };
        Insert: {
          post_id: string;
          question: string;
          description?: string;
          max_selections?: number;
          expires_at?: string | null;
          closed_at?: string | null;
          revision?: number;
        };
        Update: {
          post_id?: string;
          question?: string;
          description?: string;
          max_selections?: number;
          expires_at?: string | null;
          closed_at?: string | null;
          revision?: number;
        };
        Relationships: [];
      };
      trybes: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          kind: string;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          owner_id: string;
          kind?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          owner_id?: string;
          kind?: string;
          created_at?: string;
        };
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
          access_scope: string;
        };
        Insert: {
          guid: string;
          user_id: string;
          library_id: string;
          created_at?: string;
          access_scope?: string;
        };
        Update: {
          guid?: string;
          user_id?: string;
          library_id?: string;
          created_at?: string;
          access_scope?: string;
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
      workout_comments: {
        Row: {
          id: string;
          video_id: string;
          author_id: string;
          author_name: string;
          text: string;
          parent_id: string | null;
          hidden: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          video_id: string;
          author_id: string;
          author_name: string;
          text: string;
          parent_id?: string | null;
          hidden?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          video_id?: string;
          author_id?: string;
          author_name?: string;
          text?: string;
          parent_id?: string | null;
          hidden?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      workout_feedback: {
        Row: {
          video_id: string;
          user_id: string;
          tags: string[];
          excluded: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          video_id: string;
          user_id: string;
          tags: string[];
          excluded?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          video_id?: string;
          user_id?: string;
          tags?: string[];
          excluded?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workout_feedback_blocks: {
        Row: { video_id: string; user_id: string };
        Insert: { video_id: string; user_id: string };
        Update: { video_id?: string; user_id?: string };
        Relationships: [];
      };
      workout_feedback_config: {
        Row: { singleton: boolean; min_members: number; agreement_bps: number };
        Insert: {
          singleton?: boolean;
          min_members?: number;
          agreement_bps?: number;
        };
        Update: {
          singleton?: boolean;
          min_members?: number;
          agreement_bps?: number;
        };
        Relationships: [];
      };
      workout_feedback_totals: {
        Row: { video_id: string; respondents: number; counts: Json };
        Insert: { video_id: string; respondents?: number; counts?: Json };
        Update: { video_id?: string; respondents?: number; counts?: Json };
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
      accept_friend_request: {
        Args: { p_requester_id: string };
        Returns: undefined;
      };
      account_can_act: {
        Args: { p_id: string; p_content?: boolean };
        Returns: boolean;
      };
      adjust_creator_receipt: {
        Args: {
          p_receipt: string;
          p_refunded: number;
          p_dispute?: string;
          p_status?: string;
        };
        Returns: undefined;
      };
      adjust_program_payment: {
        Args: {
          p_order: string;
          p_checkout: string;
          p_intent: string;
          p_refunded: number;
          p_dispute: string;
          p_status: string;
        };
        Returns: undefined;
      };
      admin_profile_directory: {
        Args: Record<never, never>;
        Returns: {
          id: string;
          name: string;
          role: string;
          created_at: string;
        }[];
      };
      admin_review_post_photo: {
        Args: { p_photo: string; p_approve: boolean; p_reason: string };
        Returns: undefined;
      };
      apply_checkout_refund: {
        Args: {
          p_checkout_id: string;
          p_refund_cents: number;
          p_fully_refunded: boolean;
        };
        Returns: undefined;
      };
      apply_checkout_refund_legacy: {
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
      apply_payment_dispute_legacy: {
        Args: { p_id: string; p_checkout_id: string; p_status: string };
        Returns: undefined;
      };
      apply_private_balance: {
        Args: {
          p_booking: string;
          p_intent: string;
          p_gross: number;
          p_fee: number;
        };
        Returns: undefined;
      };
      apply_private_deposit: {
        Args: {
          p_checkout: string;
          p_hold: string;
          p_member: string;
          p_gross: number;
          p_fee: number;
          p_customer: string;
          p_method: string;
          p_intent: string;
        };
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
      approve_creator_terms: {
        Args: {
          p_owner: string;
          p_enabled: boolean;
          p_bps: number;
          p_terms: string;
        };
        Returns: undefined;
      };
      approve_private_reschedule: {
        Args: { p_request: string; p_approve: boolean };
        Returns: string;
      };
      approve_program_terms: {
        Args: {
          p_owner: string;
          p_enabled: boolean;
          p_bps: number;
          p_terms: string;
        };
        Returns: undefined;
      };
      approve_program_terms_v58: {
        Args: {
          p_owner: string;
          p_enabled: boolean;
          p_bps: number;
          p_terms: string;
        };
        Returns: undefined;
      };
      assert_fitness_claims: {
        Args: { p_user: string; p_claims: string };
        Returns: undefined;
      };
      attach_creator_subscription: {
        Args: {
          p_order: string;
          p_checkout: string;
          p_subscription: string;
          p_customer: string;
          p_status: string;
          p_cancel: boolean;
        };
        Returns: undefined;
      };
      attach_program_checkout: {
        Args: { p_order: string; p_checkout: string; p_intent: string };
        Returns: undefined;
      };
      begin_creator_order: {
        Args: { p_user: string; p_trainer: string };
        Returns: Database["public"]["Tables"]["creator_orders"]["Row"][];
      };
      begin_post_photo: {
        Args: { p_post: string; p_alt: string; p_ext: string };
        Returns: Database["public"]["Tables"]["post_photos"]["Row"][];
      };
      begin_program_order: {
        Args: { p_user: string; p_program: string };
        Returns: Database["public"]["Tables"]["program_orders"]["Row"][];
      };
      can_edit_menu: { Args: { _client: string }; Returns: boolean };
      can_see_trybe: { Args: { _trybe: string }; Returns: boolean };
      can_send_message: {
        Args: { p_sender: string; p_recipient: string };
        Returns: boolean;
      };
      cancel_private_session: {
        Args: { p_checkout_id: string; p_user_id: string };
        Returns: undefined;
      };
      cancel_program_order: {
        Args: { p_order: string; p_checkout: string };
        Returns: undefined;
      };
      checkpoint_program_step: {
        Args: {
          p_edition: string;
          p_step: string;
          p_elapsed: number;
          p_variation?: string;
        };
        Returns: undefined;
      };
      claim_contact_delivery: {
        Args: {
          p_request: string;
          p_requester_hash: string;
          p_payload_hash: string;
        };
        Returns: string;
      };
      claim_creator_payout: {
        Args: { p_order: string };
        Returns: Database["public"]["Tables"]["creator_transfer_operations"]["Row"][];
      };
      claim_earning_operation: {
        Args: { p_id: string };
        Returns: Database["public"]["Tables"]["trainer_earnings"]["Row"][];
      };
      claim_post_photo_processing: {
        Args: { p_user: string; p_photo: string };
        Returns: Database["public"]["Tables"]["post_photos"]["Row"][];
      };
      claim_private_balance: {
        Args: { p_booking: string };
        Returns: Database["public"]["Tables"]["private_balance_operations"]["Row"][];
      };
      claim_program_payout: {
        Args: { p_order: string };
        Returns: Database["public"]["Tables"]["program_payout_operations"]["Row"][];
      };
      claim_recording_import: {
        Args: { p_egress_id: string };
        Returns: Database["public"]["Tables"]["live_recordings"]["Row"][];
      };
      close_trybe_poll: {
        Args: { p_id: string; p_reason?: string };
        Returns: Json;
      };
      community_ad_slot: {
        Args: { p_session: string; p_user: string; p_posts: string[] };
        Returns: string;
      };
      complete_program_download: {
        Args: { p_edition: string; p_asset: string; p_completed: boolean };
        Returns: undefined;
      };
      configure_creator_prices: {
        Args: { p_min: number; p_max: number; p_recommended: number };
        Returns: undefined;
      };
      configure_workout_feedback: {
        Args: { p_min: number; p_bps: number };
        Returns: undefined;
      };
      confirm_private_delivery: {
        Args: { p_booking: string };
        Returns: undefined;
      };
      confirm_program_order: {
        Args: {
          p_order: string;
          p_checkout: string;
          p_intent: string;
          p_gross: number;
          p_fee: number;
          p_refunded: number;
        };
        Returns: undefined;
      };
      consume_attended_live_token: {
        Args: { p_user_id: string; p_session_id: string };
        Returns: undefined;
      };
      consume_attended_live_token_v53: {
        Args: { p_user_id: string; p_session_id: string };
        Returns: undefined;
      };
      creator_business_metrics: {
        Args: { p_start: string; p_end: string };
        Returns: Json;
      };
      creator_can_read_post: {
        Args: { p_user: string; p_post: string };
        Returns: boolean;
      };
      creator_can_sell: { Args: { p_trainer: string }; Returns: boolean };
      creator_comment_visible: { Args: { p_id: string }; Returns: boolean };
      creator_dashboard: { Args: Record<never, never>; Returns: Json };
      creator_demand_insights: {
        Args: { p_days?: number; p_audience?: boolean };
        Returns: Json;
      };
      creator_has_access: {
        Args: { p_user: string; p_trainer: string };
        Returns: boolean;
      };
      creator_live_video_count: {
        Args: { p_trainer: string };
        Returns: number;
      };
      creator_notify: {
        Args: {
          p_user: string;
          p_key: string;
          p_body: string;
          p_href?: string;
        };
        Returns: undefined;
      };
      creator_offer_details: { Args: { p_trainer: string }; Returns: Json };
      creator_price_limits: { Args: Record<never, never>; Returns: Json };
      creator_program_access: {
        Args: { p_user: string; p_edition: string };
        Returns: boolean;
      };
      creator_program_analytics: { Args: Record<never, never>; Returns: Json };
      creator_program_deadline: {
        Args: { p_user: string; p_edition: string };
        Returns: string;
      };
      creator_renewal_batch: {
        Args: { p_limit?: number };
        Returns: Database["public"]["Tables"]["creator_orders"]["Row"][];
      };
      creator_video_public: { Args: { p_video: string }; Returns: boolean };
      creator_video_token: {
        Args: { p_user: string; p_video: string };
        Returns: { path: string; deadline: string; is_public: boolean }[];
      };
      creator_workouts: { Args: { p_trainer: string }; Returns: Json };
      delete_community_post: { Args: { p_post: string }; Returns: undefined };
      deliver_trybe_poll_notices: {
        Args: { p_limit?: number };
        Returns: number;
      };
      discovery_focus: {
        Args: { p_tags: string[]; p_text: string };
        Returns: string[];
      };
      enroll_fitness_program: { Args: { p_id: string }; Returns: string };
      enroll_fitness_program_v58: { Args: { p_id: string }; Returns: string };
      feedback_can_access: {
        Args: { p_user: string; p_video: string };
        Returns: boolean;
      };
      finalize_delivered_private_sessions: {
        Args: Record<never, never>;
        Returns: undefined;
      };
      finish_creator_payout: {
        Args: { p_operation: string; p_provider: string };
        Returns: undefined;
      };
      finish_earning_operation: {
        Args: { p_id: string; p_key: string; p_provider_id: string };
        Returns: undefined;
      };
      finish_program_payout: {
        Args: { p_operation: string; p_provider: string };
        Returns: undefined;
      };
      generate_credential_alerts: {
        Args: Record<never, never>;
        Returns: undefined;
      };
      generate_live_session_reminders: {
        Args: Record<never, never>;
        Returns: undefined;
      };
      get_live_checkout_intent: {
        Args: { p_user_id: string; p_session_id: string };
        Returns: string;
      };
      grant_external_program: {
        Args: {
          p_edition: string;
          p_member: string;
          p_reference: string;
          p_confirmed?: string;
        };
        Returns: undefined;
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
      is_creator_subscriber: { Args: { p_trainer: string }; Returns: boolean };
      joinable_trybe: { Args: { p_id: string }; Returns: boolean };
      live_subscription_deadline: {
        Args: { p_user: string; p_session: string };
        Returns: string;
      };
      maintain_private_bookings: {
        Args: Record<never, never>;
        Returns: undefined;
      };
      message_contact_names: {
        Args: Record<never, never>;
        Returns: { id: string; name: string }[];
      };
      moderate_comment: {
        Args: { p_id: string; p_hidden: boolean; p_note: string };
        Returns: undefined;
      };
      moderate_creator_comment: {
        Args: { p_id: string; p_hidden: boolean; p_reason: string };
        Returns: undefined;
      };
      moderate_creator_offer: {
        Args: { p_trainer: string; p_blocked: boolean; p_reason: string };
        Returns: undefined;
      };
      moderate_fitness_program: {
        Args: { p_id: string; p_blocked: boolean; p_note: string };
        Returns: undefined;
      };
      moderate_trybe_post: {
        Args: { p_post_id: string; p_action: string; p_value: boolean };
        Returns: undefined;
      };
      moderate_workout_comment: {
        Args: { p_id: string; p_hidden: boolean; p_reason: string };
        Returns: undefined;
      };
      moderate_workout_feedback: {
        Args: {
          p_video: string;
          p_user: string;
          p_excluded: boolean;
          p_reason: string;
        };
        Returns: undefined;
      };
      notify_account: {
        Args: {
          p_user: string;
          p_key: string;
          p_category: string;
          p_body: string;
          p_href?: string;
        };
        Returns: undefined;
      };
      notify_friend_attendance: {
        Args: { p_user: string; p_session: string };
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
      pick_workout_catalog: {
        Args: {
          p_minutes: number;
          p_equipment: string[];
          p_style?: string;
          p_level?: string;
          p_focus?: string[];
          p_intensity?: string;
          p_approximate?: boolean;
        };
        Returns: Json;
      };
      poll_member: { Args: { p_trybe: string }; Returns: boolean };
      poll_owned_trybes: {
        Args: Record<never, never>;
        Returns: { id: string; name: string }[];
      };
      poll_owner: { Args: { p_trybe: string }; Returns: boolean };
      poll_view: { Args: { p_id: string }; Returns: Json };
      poll_view_v59: { Args: { p_id: string }; Returns: Json };
      post_photo_access: {
        Args: { p_user: string; p_photo: string; p_review?: boolean };
        Returns: {
          path: string;
          thumbnail: string;
          alt: string;
          deadline: string;
        }[];
      };
      post_photos_ready: { Args: { p_post: string }; Returns: boolean };
      prepare_deposit_booking: {
        Args: {
          p_trainer: string;
          p_member: string;
          p_day: string;
          p_time: string;
          p_terms: string;
        };
        Returns: string;
      };
      program_access: { Args: { p_edition: string }; Returns: boolean };
      program_admin_report: { Args: Record<never, never>; Returns: Json };
      program_asset_access: {
        Args: { p_user: string; p_edition: string; p_asset: string };
        Returns: { path: string; deadline: string }[];
      };
      program_media_access: {
        Args: {
          p_user: string;
          p_edition: string;
          p_step: string;
          p_variation?: string;
        };
        Returns: {
          id: string;
          path: string;
          access_scope: string;
          ads_allowed: boolean;
          access_expires_at: string;
          image_path: string;
        }[];
      };
      program_member: { Args: { p_program: string }; Returns: boolean };
      program_metrics: { Args: Record<never, never>; Returns: Json };
      program_subscription_benefit: {
        Args: { p_id: string };
        Returns: boolean;
      };
      program_validate: {
        Args: { p_data: Json; p_trainer: string; p_allow_empty?: boolean };
        Returns: undefined;
      };
      program_validate_demo: {
        Args: { p_demo: Json; p_trainer: string; p_draft: boolean };
        Returns: undefined;
      };
      program_validate_v58: {
        Args: { p_data: Json; p_trainer: string; p_allow_empty?: boolean };
        Returns: undefined;
      };
      program_validate_v62: {
        Args: { p_data: Json; p_trainer: string; p_allow_empty?: boolean };
        Returns: undefined;
      };
      public_post_photo_access: {
        Args: { p_photo: string };
        Returns: {
          path: string;
          thumbnail: string;
          alt: string;
          deadline: string;
        }[];
      };
      publish_official_announcement: {
        Args: { p_body: string };
        Returns: string;
      };
      publish_targeted_announcement: {
        Args: { p_body: string; p_audience: string };
        Returns: string;
      };
      purge_discovery_demand: { Args: Record<never, never>; Returns: number };
      read_post_photos: { Args: { p_posts: string[] }; Returns: Json };
      read_trybe_polls: { Args: { p_ids: string[] }; Returns: Json };
      reconcile_included_live_payment: {
        Args: { p_checkout: string };
        Returns: undefined;
      };
      record_account_activity: { Args: { p_time_zone: string }; Returns: Json };
      record_creator_invoice: {
        Args: {
          p_order: string;
          p_invoice: string;
          p_intent: string;
          p_gross: number;
          p_fee: number;
          p_refunded: number;
          p_start: string;
          p_end: string;
          p_paid: string;
        };
        Returns: string;
      };
      record_creator_releases: { Args: Record<never, never>; Returns: number };
      record_discovery_demand: {
        Args: {
          p_source: string;
          p_query?: string;
          p_tags?: string[];
          p_category?: string;
          p_equipment?: string[];
          p_length?: number;
          p_difficulty?: string;
          p_min_length?: number;
          p_exact?: boolean;
          p_categories?: string[];
        };
        Returns: undefined;
      };
      record_private_both_present: {
        Args: { p_booking: string };
        Returns: boolean;
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
      register_program_asset: {
        Args: { p_path: string; p_title: string };
        Returns: string;
      };
      register_program_image: { Args: { p_path: string }; Returns: string };
      release_private_hold: {
        Args: { p_id: string; p_member_id: string };
        Returns: undefined;
      };
      remove_post_photo: { Args: { p_photo: string }; Returns: undefined };
      remove_workout_feedback: {
        Args: { p_video: string };
        Returns: undefined;
      };
      reorder_program_workouts: {
        Args: { p_program_id: string; p_video_ids: string[] };
        Returns: undefined;
      };
      reply_creator_comment: {
        Args: { p_id: string; p_text: string };
        Returns: string;
      };
      report_creator_playback: {
        Args: { p_id: string; p_seconds: number };
        Returns: undefined;
      };
      report_program_usage: {
        Args: { p_id: string; p_seconds: number };
        Returns: undefined;
      };
      request_creator_refund: {
        Args: { p_receipt: string; p_reason: string };
        Returns: undefined;
      };
      request_private_reschedule: {
        Args: { p_booking: string; p_day: string; p_time: string };
        Returns: string;
      };
      request_program_refund: {
        Args: { p_order: string; p_reason: string };
        Returns: undefined;
      };
      reserve_class_recording: {
        Args: { p_session_id: string };
        Returns: boolean;
      };
      reserve_live_class: {
        Args: { p_user_id: string; p_session_id: string };
        Returns: undefined;
      };
      reserve_live_class_v53: {
        Args: { p_user_id: string; p_session_id: string };
        Returns: undefined;
      };
      restore_won_disputes: { Args: Record<never, never>; Returns: undefined };
      restrict_account: {
        Args: {
          p_id: string;
          p_scope: string;
          p_active: boolean;
          p_reason: string;
        };
        Returns: undefined;
      };
      review_content_report: {
        Args: { p_id: string; p_status: string; p_note: string };
        Returns: undefined;
      };
      review_fitness_program: {
        Args: { p_edition: string; p_status: string; p_note: string };
        Returns: undefined;
      };
      review_moderation_appeal: {
        Args: { p_id: string; p_status: string; p_note: string };
        Returns: undefined;
      };
      review_post_photo: {
        Args: {
          p_photo: string;
          p_status: string;
          p_revision: number;
          p_display: string;
          p_thumb: string;
          p_specialist: boolean;
        };
        Returns: undefined;
      };
      review_program_asset: {
        Args: { p_id: string; p_status: string };
        Returns: undefined;
      };
      review_program_image: {
        Args: { p_id: string; p_status: string };
        Returns: undefined;
      };
      review_trainer_video: {
        Args: { p_video_id: string; p_status: string; p_note: string };
        Returns: undefined;
      };
      save_creator_offer: {
        Args: {
          p_title: string;
          p_description: string;
          p_price: number;
          p_enabled: boolean;
        };
        Returns: undefined;
      };
      save_creator_post: {
        Args: { p_text: string; p_audience: string };
        Returns: string;
      };
      save_fitness_program: {
        Args: { p_data: Json; p_id?: string };
        Returns: string;
      };
      save_program_workouts: {
        Args: { p_program_id: string; p_video_ids: string[] };
        Returns: undefined;
      };
      save_spotlight_draft: {
        Args: {
          p_type: string;
          p_target: string;
          p_package: string;
          p_budget: number;
          p_tags: string[];
          p_id?: string;
          p_cancel?: boolean;
        };
        Returns: string;
      };
      save_trybe_poll: {
        Args: {
          p_trybe: string;
          p_question: string;
          p_description: string;
          p_options: string[];
          p_max: number;
          p_expires?: string;
          p_notify?: boolean;
          p_public?: boolean;
          p_id?: string;
          p_revision?: number;
        };
        Returns: string;
      };
      save_workout_comment: {
        Args: { p_video: string; p_text: string; p_parent?: string };
        Returns: string;
      };
      save_workout_feedback: {
        Args: { p_video: string; p_tags: string[] };
        Returns: undefined;
      };
      set_creator_video_audience: {
        Args: { p_video: string; p_audience: string; p_public_at?: string };
        Returns: undefined;
      };
      set_fitness_program_visibility: {
        Args: { p_id: string; p_published: boolean };
        Returns: undefined;
      };
      set_live_reservation: {
        Args: { p_session: string; p_reserved: boolean };
        Returns: undefined;
      };
      set_program_progress: {
        Args: { p_edition: string; p_step: string; p_completed?: boolean };
        Returns: undefined;
      };
      settle_paid_checkout: {
        Args: { p_kind: string; p_args: Json; p_refunded?: number };
        Returns: undefined;
      };
      settle_paid_checkout_v54: {
        Args: { p_kind: string; p_args: Json; p_refunded?: number };
        Returns: undefined;
      };
      share_menu: { Args: { _code: string }; Returns: string };
      start_creator_playback: { Args: { p_video: string }; Returns: string };
      start_program_usage: {
        Args: {
          p_user: string;
          p_edition: string;
          p_step: string;
          p_variation?: string;
        };
        Returns: string;
      };
      start_subscriber_live: {
        Args: {
          p_title: string;
          p_minutes?: number;
          p_category?: string;
          p_level?: string;
          p_tags?: string[];
          p_description?: string;
          p_recording?: boolean;
        };
        Returns: string;
      };
      submit_creator_partnership: {
        Args: {
          p_trainer: string;
          p_name: string;
          p_organization: string;
          p_email: string;
          p_type: string;
          p_description: string;
          p_budget?: string;
          p_timeline?: string;
        };
        Returns: string;
      };
      submit_fitness_program: { Args: { p_id: string }; Returns: string };
      sync_program_entitlement: {
        Args: { p_order: string };
        Returns: undefined;
      };
      sync_wallet_balance: { Args: { p_user_id: string }; Returns: undefined };
      trainer_attendance_count: {
        Args: { p_trainer_id: string };
        Returns: number;
      };
      trainer_is_eligible: {
        Args: { p_user_id: string; p_live?: boolean };
        Returns: boolean;
      };
      unfriend_user: { Args: { p_friend_id: string }; Returns: undefined };
      update_creator_partnership: {
        Args: { p_id: string; p_status: string };
        Returns: undefined;
      };
      valid_discovery_tags: { Args: { p_tags: string[] }; Returns: boolean };
      valid_iso_date: { Args: { p_value: string }; Returns: boolean };
      vote_trybe_poll: {
        Args: { p_id: string; p_options: string[]; p_revision: number };
        Returns: Json;
      };
      workout_comment_access: {
        Args: { p_user: string; p_video: string };
        Returns: boolean;
      };
      workout_community_tags: { Args: { p_ids: string[] }; Returns: Json };
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
