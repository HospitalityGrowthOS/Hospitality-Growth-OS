// Generated from the live Supabase schema — do not edit by hand.
// Regenerate with: npm run gen:types
//
// Every table carries `Relationships: []` because @supabase/postgrest-js
// requires it to recognise the schema as a GenericSchema; without it every
// query resolves to `never`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      action_items: {
        Row: {
          id: string
          venue_id: string
          title: string
          description: string | null
          type: string
          priority: string
          status: string
          due_at: string | null
          completed_at: string | null
          completed_by: string | null
          related_id: string | null
          related_type: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          title: string
          description?: string | null
          type: string
          priority?: string
          status?: string
          due_at?: string | null
          completed_at?: string | null
          completed_by?: string | null
          related_id?: string | null
          related_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          venue_id?: string
          title?: string
          description?: string | null
          type?: string
          priority?: string
          status?: string
          due_at?: string | null
          completed_at?: string | null
          completed_by?: string | null
          related_id?: string | null
          related_type?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_recommendations: {
        Row: {
          id: string
          venue_id: string
          type: string
          title: string
          description: string
          priority: string
          status: string
          data: Json
          generated_at: string
          model_used: string | null
          actioned_at: string | null
          actioned_by: string | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          type: string
          title: string
          description: string
          priority?: string
          status?: string
          data: Json
          generated_at?: string
          model_used?: string | null
          actioned_at?: string | null
          actioned_by?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          venue_id?: string
          type?: string
          title?: string
          description?: string
          priority?: string
          status?: string
          data?: Json
          generated_at?: string
          model_used?: string | null
          actioned_at?: string | null
          actioned_by?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          id: string
          venue_id: string
          guest_id: string | null
          event_type: string
          properties: Json
          session_id: string | null
          ip_address: string | null
          user_agent: string | null
          occurred_at: string
          created_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          guest_id?: string | null
          event_type: string
          properties: Json
          session_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          occurred_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          venue_id?: string
          guest_id?: string | null
          event_type?: string
          properties?: Json
          session_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          occurred_at?: string
          created_at?: string
        }
        Relationships: []
      }
      campaign_sends: {
        Row: {
          id: string
          campaign_id: string
          venue_id: string
          guest_id: string
          status: string
          error_message: string | null
          sent_at: string | null
          delivered_at: string | null
          read_at: string | null
          clicked_at: string | null
          converted_at: string | null
          conversion_amount: number | null
          provider_message_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          venue_id: string
          guest_id: string
          status?: string
          error_message?: string | null
          sent_at?: string | null
          delivered_at?: string | null
          read_at?: string | null
          clicked_at?: string | null
          converted_at?: string | null
          conversion_amount?: number | null
          provider_message_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          venue_id?: string
          guest_id?: string
          status?: string
          error_message?: string | null
          sent_at?: string | null
          delivered_at?: string | null
          read_at?: string | null
          clicked_at?: string | null
          converted_at?: string | null
          conversion_amount?: number | null
          provider_message_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          id: string
          venue_id: string
          created_by: string | null
          name: string
          type: string
          channel: string
          status: string
          target_segment: Json
          message_template: string
          media_url: string | null
          whatsapp_template_name: string | null
          scheduled_at: string | null
          started_at: string | null
          completed_at: string | null
          audience_count: number
          sent_count: number
          delivered_count: number
          opened_count: number
          clicked_count: number
          converted_count: number
          revenue_attributed: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          created_by?: string | null
          name: string
          type: string
          channel?: string
          status?: string
          target_segment: Json
          message_template: string
          media_url?: string | null
          whatsapp_template_name?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          audience_count?: number
          sent_count?: number
          delivered_count?: number
          opened_count?: number
          clicked_count?: number
          converted_count?: number
          revenue_attributed?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          venue_id?: string
          created_by?: string | null
          name?: string
          type?: string
          channel?: string
          status?: string
          target_segment?: Json
          message_template?: string
          media_url?: string | null
          whatsapp_template_name?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          audience_count?: number
          sent_count?: number
          delivered_count?: number
          opened_count?: number
          clicked_count?: number
          converted_count?: number
          revenue_attributed?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          venue_id: string
          guest_id: string | null
          channel: string
          status: string
          ai_handled: boolean
          human_takeover_at: string | null
          human_assigned_to: string | null
          context: Json
          last_message_at: string | null
          message_count: number
          resolution_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          guest_id?: string | null
          channel?: string
          status?: string
          ai_handled?: boolean
          human_takeover_at?: string | null
          human_assigned_to?: string | null
          context: Json
          last_message_at?: string | null
          message_count?: number
          resolution_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          venue_id?: string
          guest_id?: string | null
          channel?: string
          status?: string
          ai_handled?: boolean
          human_takeover_at?: string | null
          human_assigned_to?: string | null
          context?: Json
          last_message_at?: string | null
          message_count?: number
          resolution_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      guest_loyalty_view: {
        Row: {
          id: string | null
          venue_id: string | null
          name: string | null
          phone: string | null
          email: string | null
          loyalty_tier: string | null
          loyalty_points: number | null
          total_visits: number | null
          total_spent: number | null
          last_visit_at: string | null
          whatsapp_opted_in: boolean | null
          member_id: string | null
          qr_code: string | null
          points_balance: number | null
          points_earned_total: number | null
          enrolled_at: string | null
          last_activity_at: string | null
        }
        Insert: {
          id?: string | null
          venue_id?: string | null
          name?: string | null
          phone?: string | null
          email?: string | null
          loyalty_tier?: string | null
          loyalty_points?: number | null
          total_visits?: number | null
          total_spent?: number | null
          last_visit_at?: string | null
          whatsapp_opted_in?: boolean | null
          member_id?: string | null
          qr_code?: string | null
          points_balance?: number | null
          points_earned_total?: number | null
          enrolled_at?: string | null
          last_activity_at?: string | null
        }
        Update: {
          id?: string | null
          venue_id?: string | null
          name?: string | null
          phone?: string | null
          email?: string | null
          loyalty_tier?: string | null
          loyalty_points?: number | null
          total_visits?: number | null
          total_spent?: number | null
          last_visit_at?: string | null
          whatsapp_opted_in?: boolean | null
          member_id?: string | null
          qr_code?: string | null
          points_balance?: number | null
          points_earned_total?: number | null
          enrolled_at?: string | null
          last_activity_at?: string | null
        }
        Relationships: []
      }
      guests: {
        Row: {
          id: string
          venue_id: string
          name: string
          phone: string | null
          email: string | null
          language: string
          tags: string[] | null
          notes: string | null
          whatsapp_opted_in: boolean
          whatsapp_opted_in_at: string | null
          loyalty_tier: string
          loyalty_points: number
          total_visits: number
          total_spent: number
          last_visit_at: string | null
          first_visit_at: string | null
          last_review_requested_at: string | null
          review_opt_out: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          name: string
          phone?: string | null
          email?: string | null
          language?: string
          tags?: string[] | null
          notes?: string | null
          whatsapp_opted_in?: boolean
          whatsapp_opted_in_at?: string | null
          loyalty_tier?: string
          loyalty_points?: number
          total_visits?: number
          total_spent?: number
          last_visit_at?: string | null
          first_visit_at?: string | null
          last_review_requested_at?: string | null
          review_opt_out?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          venue_id?: string
          name?: string
          phone?: string | null
          email?: string | null
          language?: string
          tags?: string[] | null
          notes?: string | null
          whatsapp_opted_in?: boolean
          whatsapp_opted_in_at?: string | null
          loyalty_tier?: string
          loyalty_points?: number
          total_visits?: number
          total_spent?: number
          last_visit_at?: string | null
          first_visit_at?: string | null
          last_review_requested_at?: string | null
          review_opt_out?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      kpi_snapshots: {
        Row: {
          id: string
          venue_id: string
          date: string
          new_members: number
          active_members: number
          total_members: number
          points_earned: number
          points_redeemed: number
          reviews_requested: number
          reviews_received: number
          avg_rating: number | null
          new_google_reviews: number
          campaigns_sent: number
          campaign_opens: number
          campaign_clicks: number
          campaign_revenue: number
          ai_conversations: number
          ai_resolved: number
          human_escalations: number
          total_visits: number
          estimated_revenue: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          date: string
          new_members?: number
          active_members?: number
          total_members?: number
          points_earned?: number
          points_redeemed?: number
          reviews_requested?: number
          reviews_received?: number
          avg_rating?: number | null
          new_google_reviews?: number
          campaigns_sent?: number
          campaign_opens?: number
          campaign_clicks?: number
          campaign_revenue?: number
          ai_conversations?: number
          ai_resolved?: number
          human_escalations?: number
          total_visits?: number
          estimated_revenue?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          venue_id?: string
          date?: string
          new_members?: number
          active_members?: number
          total_members?: number
          points_earned?: number
          points_redeemed?: number
          reviews_requested?: number
          reviews_received?: number
          avg_rating?: number | null
          new_google_reviews?: number
          campaigns_sent?: number
          campaign_opens?: number
          campaign_clicks?: number
          campaign_revenue?: number
          ai_conversations?: number
          ai_resolved?: number
          human_escalations?: number
          total_visits?: number
          estimated_revenue?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          id: string
          venue_id_assigned: string | null
          name: string
          venue_name: string
          phone: string | null
          email: string | null
          city: string | null
          country: string
          plan_interest: string | null
          source: string
          status: string
          notes: string | null
          assigned_to: string | null
          last_contacted_at: string | null
          next_follow_up_at: string | null
          demo_scheduled_at: string | null
          proposal_sent_at: string | null
          closed_at: string | null
          lost_reason: string | null
          linkedin_url: string | null
          google_place_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id_assigned?: string | null
          name: string
          venue_name: string
          phone?: string | null
          email?: string | null
          city?: string | null
          country?: string
          plan_interest?: string | null
          source?: string
          status?: string
          notes?: string | null
          assigned_to?: string | null
          last_contacted_at?: string | null
          next_follow_up_at?: string | null
          demo_scheduled_at?: string | null
          proposal_sent_at?: string | null
          closed_at?: string | null
          lost_reason?: string | null
          linkedin_url?: string | null
          google_place_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          venue_id_assigned?: string | null
          name?: string
          venue_name?: string
          phone?: string | null
          email?: string | null
          city?: string | null
          country?: string
          plan_interest?: string | null
          source?: string
          status?: string
          notes?: string | null
          assigned_to?: string | null
          last_contacted_at?: string | null
          next_follow_up_at?: string | null
          demo_scheduled_at?: string | null
          proposal_sent_at?: string | null
          closed_at?: string | null
          lost_reason?: string | null
          linkedin_url?: string | null
          google_place_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_members: {
        Row: {
          id: string
          venue_id: string
          guest_id: string
          qr_code: string
          tier: string
          points_balance: number
          points_earned_total: number
          points_redeemed_total: number
          enrolled_at: string
          last_activity_at: string | null
          birthday: string | null
          tier_upgraded_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          guest_id: string
          qr_code?: string
          tier?: string
          points_balance?: number
          points_earned_total?: number
          points_redeemed_total?: number
          enrolled_at?: string
          last_activity_at?: string | null
          birthday?: string | null
          tier_upgraded_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          venue_id?: string
          guest_id?: string
          qr_code?: string
          tier?: string
          points_balance?: number
          points_earned_total?: number
          points_redeemed_total?: number
          enrolled_at?: string
          last_activity_at?: string | null
          birthday?: string | null
          tier_upgraded_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_rewards: {
        Row: {
          id: string
          venue_id: string
          name: string
          description: string | null
          points_cost: number
          type: string
          is_active: boolean
          valid_until: string | null
          stock_limit: number | null
          redemption_count: number
          image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          name: string
          description?: string | null
          points_cost: number
          type?: string
          is_active?: boolean
          valid_until?: string | null
          stock_limit?: number | null
          redemption_count?: number
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          venue_id?: string
          name?: string
          description?: string | null
          points_cost?: number
          type?: string
          is_active?: boolean
          valid_until?: string | null
          stock_limit?: number | null
          redemption_count?: number
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      loyalty_transactions: {
        Row: {
          id: string
          venue_id: string
          member_id: string
          type: string
          points: number
          balance_after: number
          description: string
          reference_id: string | null
          reference_type: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          member_id: string
          type: string
          points: number
          balance_after: number
          description: string
          reference_id?: string | null
          reference_type?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          venue_id?: string
          member_id?: string
          type?: string
          points?: number
          balance_after?: number
          description?: string
          reference_id?: string | null
          reference_type?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          venue_id: string
          role: string
          content: string
          channel_message_id: string | null
          sent_at: string | null
          delivered_at: string | null
          read_at: string | null
          failed_at: string | null
          error_code: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          venue_id: string
          role: string
          content: string
          channel_message_id?: string | null
          sent_at?: string | null
          delivered_at?: string | null
          read_at?: string | null
          failed_at?: string | null
          error_code?: string | null
          metadata: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          venue_id?: string
          role?: string
          content?: string
          channel_message_id?: string | null
          sent_at?: string | null
          delivered_at?: string | null
          read_at?: string | null
          failed_at?: string | null
          error_code?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          venue_id: string
          profile_id: string | null
          type: string
          title: string
          body: string | null
          icon: string | null
          is_read: boolean
          read_at: string | null
          related_id: string | null
          related_type: string | null
          action_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          profile_id?: string | null
          type: string
          title: string
          body?: string | null
          icon?: string | null
          is_read?: boolean
          read_at?: string | null
          related_id?: string | null
          related_type?: string | null
          action_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          venue_id?: string
          profile_id?: string | null
          type?: string
          title?: string
          body?: string | null
          icon?: string | null
          is_read?: boolean
          read_at?: string | null
          related_id?: string | null
          related_type?: string | null
          action_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          venue_id: string | null
          role: string
          full_name: string
          email: string
          avatar_url: string | null
          phone: string | null
          is_active: boolean
          last_login_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          venue_id?: string | null
          role?: string
          full_name: string
          email: string
          avatar_url?: string | null
          phone?: string | null
          is_active?: boolean
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          venue_id?: string | null
          role?: string
          full_name?: string
          email?: string
          avatar_url?: string | null
          phone?: string | null
          is_active?: boolean
          last_login_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      review_requests: {
        Row: {
          id: string
          venue_id: string
          guest_id: string | null
          status: string
          rating: number | null
          feedback: string | null
          guest_name: string | null
          guest_phone: string | null
          created_at: string
          completed_at: string | null
          visit_id: string | null
          channel: string
          scheduled_for: string | null
          sent_at: string | null
          clicked_at: string | null
          review_url: string | null
        }
        Insert: {
          id?: string
          venue_id: string
          guest_id?: string | null
          status?: string
          rating?: number | null
          feedback?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          created_at?: string
          completed_at?: string | null
          visit_id?: string | null
          channel?: string
          scheduled_for?: string | null
          sent_at?: string | null
          clicked_at?: string | null
          review_url?: string | null
        }
        Update: {
          id?: string
          venue_id?: string
          guest_id?: string | null
          status?: string
          rating?: number | null
          feedback?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          created_at?: string
          completed_at?: string | null
          visit_id?: string | null
          channel?: string
          scheduled_for?: string | null
          sent_at?: string | null
          clicked_at?: string | null
          review_url?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          id: string
          venue_id: string
          guest_id: string | null
          platform: string
          rating: number
          content: string | null
          author_name: string | null
          review_date: string | null
          status: string
          ai_response_draft: string | null
          owner_response: string | null
          responded_at: string | null
          google_review_id: string | null
          external_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          guest_id?: string | null
          platform?: string
          rating: number
          content?: string | null
          author_name?: string | null
          review_date?: string | null
          status?: string
          ai_response_draft?: string | null
          owner_response?: string | null
          responded_at?: string | null
          google_review_id?: string | null
          external_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          venue_id?: string
          guest_id?: string | null
          platform?: string
          rating?: number
          content?: string | null
          author_name?: string | null
          review_date?: string | null
          status?: string
          ai_response_draft?: string | null
          owner_response?: string | null
          responded_at?: string | null
          google_review_id?: string | null
          external_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          venue_id: string | null
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          current_period_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          venue_id?: string | null
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          venue_id?: string | null
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      venue_review_summary: {
        Row: {
          venue_id: string | null
          total_reviews: number | null
          avg_rating: number | null
          five_star: number | null
          four_star: number | null
          low_star: number | null
          pending_response: number | null
          latest_review_date: string | null
        }
        Insert: {
          venue_id?: string | null
          total_reviews?: number | null
          avg_rating?: number | null
          five_star?: number | null
          four_star?: number | null
          low_star?: number | null
          pending_response?: number | null
          latest_review_date?: string | null
        }
        Update: {
          venue_id?: string | null
          total_reviews?: number | null
          avg_rating?: number | null
          five_star?: number | null
          four_star?: number | null
          low_star?: number | null
          pending_response?: number | null
          latest_review_date?: string | null
        }
        Relationships: []
      }
      venues: {
        Row: {
          id: string
          name: string
          slug: string
          type: string
          plan: string
          status: string
          phone: string | null
          email: string | null
          address: string | null
          city: string | null
          country: string
          timezone: string
          locale: string
          google_place_id: string | null
          whatsapp_phone_number_id: string | null
          whatsapp_access_token: string | null
          instagram_account_id: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          current_period_ends_at: string | null
          settings: Json
          created_at: string
          updated_at: string
          owner_id: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          type?: string
          plan?: string
          status?: string
          phone?: string | null
          email?: string | null
          address?: string | null
          city?: string | null
          country?: string
          timezone?: string
          locale?: string
          google_place_id?: string | null
          whatsapp_phone_number_id?: string | null
          whatsapp_access_token?: string | null
          instagram_account_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          current_period_ends_at?: string | null
          settings: Json
          created_at?: string
          updated_at?: string
          owner_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          type?: string
          plan?: string
          status?: string
          phone?: string | null
          email?: string | null
          address?: string | null
          city?: string | null
          country?: string
          timezone?: string
          locale?: string
          google_place_id?: string | null
          whatsapp_phone_number_id?: string | null
          whatsapp_access_token?: string | null
          instagram_account_id?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          current_period_ends_at?: string | null
          settings?: Json
          created_at?: string
          updated_at?: string
          owner_id?: string | null
        }
        Relationships: []
      }
      visits: {
        Row: {
          id: string
          venue_id: string
          guest_id: string
          staff_id: string | null
          visited_at: string
          party_size: number
          spend_amount: number | null
          table_number: string | null
          source: string
          pos_receipt_id: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          guest_id: string
          staff_id?: string | null
          visited_at?: string
          party_size?: number
          spend_amount?: number | null
          table_number?: string | null
          source?: string
          pos_receipt_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          venue_id?: string
          guest_id?: string
          staff_id?: string | null
          visited_at?: string
          party_size?: number
          spend_amount?: number | null
          table_number?: string | null
          source?: string
          pos_receipt_id?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      weekly_reports: {
        Row: {
          id: string
          venue_id: string
          week_start: string
          week_end: string
          summary: string
          highlights: Json
          concerns: Json
          recommendations: Json
          metrics: Json
          generated_at: string
          model_used: string | null
          sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          week_start: string
          week_end: string
          summary: string
          highlights: Json
          concerns: Json
          recommendations: Json
          metrics: Json
          generated_at?: string
          model_used?: string | null
          sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          venue_id?: string
          week_start?: string
          week_end?: string
          summary?: string
          highlights?: Json
          concerns?: Json
          recommendations?: Json
          metrics?: Json
          generated_at?: string
          model_used?: string | null
          sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          id: string
          venue_id: string
          guest_id: string | null
          phone: string
          message_type: string
          body: string
          status: string
          twilio_sid: string | null
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          guest_id?: string | null
          phone: string
          message_type: string
          body: string
          status?: string
          twilio_sid?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          venue_id?: string
          guest_id?: string | null
          phone?: string
          message_type?: string
          body?: string
          status?: string
          twilio_sid?: string | null
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// ── Convenience aliases ───────────────────────────────────────────────────────
type T = Database['public']['Tables']
export type Venue = T['venues']['Row']
export type Guest = T['guests']['Row']
export type Visit = T['visits']['Row']
export type LoyaltyMember = T['loyalty_members']['Row']
export type LoyaltyTransaction = T['loyalty_transactions']['Row']
export type LoyaltyReward = T['loyalty_rewards']['Row']
export type Review = T['reviews']['Row']
export type ReviewRequest = T['review_requests']['Row']
export type Campaign = T['campaigns']['Row']
export type CampaignSend = T['campaign_sends']['Row']
export type Conversation = T['conversations']['Row']
export type Message = T['messages']['Row']
export type ActionItem = T['action_items']['Row']
export type AiRecommendation = T['ai_recommendations']['Row']
export type AnalyticsEvent = T['analytics_events']['Row']
export type KpiSnapshot = T['kpi_snapshots']['Row']
export type Notification = T['notifications']['Row']
export type Profile = T['profiles']['Row']
export type Subscription = T['subscriptions']['Row']
export type WeeklyReport = T['weekly_reports']['Row']
export type WhatsAppMessage = T['whatsapp_messages']['Row']
export type Lead = T['leads']['Row']
