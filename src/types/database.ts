/**
 * Supabase Database types for @supabase/supabase-js v2 + @supabase/postgrest-js v2.x
 *
 * Every table MUST include `Relationships: []` — required by GenericTable.
 * Without it, Database['public'] doesn't extend GenericSchema and the client
 * falls back to `any`, causing all queries to type as `never`.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type VenueType       = 'restaurant' | 'cafe' | 'bar' | 'hotel' | 'bakery' | 'other'
export type VenuePlan       = 'starter' | 'growth' | 'scale'
export type VenueStatus     = 'trial' | 'active' | 'suspended' | 'churned'
export type LoyaltyTier     = 'none' | 'bronze' | 'silver' | 'gold'
export type ReviewPlatform  = 'google' | 'tripadvisor' | 'internal'
export type ReviewStatus    = 'pending' | 'responded' | 'ignored'
export type CampaignStatus  = 'draft' | 'scheduled' | 'running' | 'completed' | 'paused'
export type ConversationStatus = 'open' | 'resolved' | 'escalated'
export type MessageRole     = 'user' | 'assistant' | 'system'
export type TransactionType = 'earn' | 'redeem' | 'bonus' | 'expire'
export type Priority        = 'high' | 'medium' | 'low'
export type Channel         = 'whatsapp' | 'instagram' | 'website' | 'phone' | 'sms' | 'email'
export type WAMessageType   = 'loyalty_welcome' | 'review_request' | 'campaign' | 'manual'
export type WAMessageStatus = 'sent' | 'failed' | 'delivered' | 'read'

export interface Database {
  public: {
    Tables: {

      // ── Venues ─────────────────────────────────────────────────────────────
      venues: {
        Row: {
          id: string
          name: string
          slug: string | null
          type: VenueType
          plan: VenuePlan
          status: VenueStatus
          owner_id: string | null
          phone: string | null
          email: string | null
          address: string | null
          city: string | null
          country: string
          google_place_id: string | null
          whatsapp_phone_number_id: string | null
          whatsapp_access_token: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug?: string | null
          type: VenueType
          plan?: VenuePlan
          status?: VenueStatus
          owner_id?: string | null
          phone?: string | null
          email?: string | null
          address?: string | null
          city?: string | null
          country?: string
          google_place_id?: string | null
          whatsapp_phone_number_id?: string | null
          whatsapp_access_token?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
          settings?: Json
        }
        Update: Partial<Database['public']['Tables']['venues']['Insert']>
        Relationships: []
      }

      // ── Subscriptions (Stripe) ──────────────────────────────────────────────
      subscriptions: {
        Row: {
          id: string
          user_id: string
          venue_id: string | null
          plan: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          current_period_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          venue_id?: string | null
          plan: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          current_period_end?: string | null
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['subscriptions']['Insert']>
        Relationships: []
      }

      // ── Guests ─────────────────────────────────────────────────────────────
      guests: {
        Row: {
          id: string
          venue_id: string
          name: string | null
          phone: string | null
          email: string | null
          whatsapp_opted_in: boolean
          loyalty_tier: LoyaltyTier
          loyalty_points: number
          total_visits: number
          total_spent: number
          last_visit_at: string | null
          language: string | null
          tags: string[] | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          name?: string | null
          phone?: string | null
          email?: string | null
          whatsapp_opted_in?: boolean
          loyalty_tier?: LoyaltyTier
          loyalty_points?: number
          total_visits?: number
          total_spent?: number
          last_visit_at?: string | null
          language?: string | null
          tags?: string[] | null
          notes?: string | null
        }
        Update: Partial<Database['public']['Tables']['guests']['Insert']>
        Relationships: []
      }

      // ── Visits ─────────────────────────────────────────────────────────────
      visits: {
        Row: {
          id: string
          venue_id: string
          guest_id: string
          visited_at: string
          party_size: number
          spend_amount: number
          table_number: string | null
          staff_id: string | null
          source: 'walkin' | 'reservation' | 'delivery'
          created_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          guest_id: string
          visited_at?: string
          party_size?: number
          spend_amount?: number
          table_number?: string | null
          staff_id?: string | null
          source?: 'walkin' | 'reservation' | 'delivery'
        }
        Update: Partial<Database['public']['Tables']['visits']['Insert']>
        Relationships: []
      }

      // ── Review Requests ─────────────────────────────────────────────────────
      review_requests: {
        Row: {
          id: string
          venue_id: string
          guest_id: string | null
          visit_id: string | null
          channel: Channel | null
          status: string
          sentiment: 'positive' | 'neutral' | 'negative' | null
          sent_at: string | null
          opened_at: string | null
          clicked_at: string | null
          completed_at: string | null
          review_url: string | null
          response_message_id: string | null
          guest_name: string | null
          guest_phone: string | null
          rating: number | null
          feedback: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          guest_id?: string | null
          visit_id?: string | null
          channel?: Channel | null
          status?: string
          sentiment?: 'positive' | 'neutral' | 'negative' | null
          sent_at?: string | null
          opened_at?: string | null
          clicked_at?: string | null
          completed_at?: string | null
          review_url?: string | null
          response_message_id?: string | null
          guest_name?: string | null
          guest_phone?: string | null
          rating?: number | null
          feedback?: string | null
        }
        Update: Partial<Database['public']['Tables']['review_requests']['Insert']>
        Relationships: []
      }

      // ── Reviews ─────────────────────────────────────────────────────────────
      reviews: {
        Row: {
          id: string
          venue_id: string
          guest_id: string | null
          platform: ReviewPlatform
          rating: number
          content: string | null
          author_name: string | null
          review_date: string
          status: ReviewStatus
          ai_response_draft: string | null
          owner_response: string | null
          responded_at: string | null
          google_review_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          guest_id?: string | null
          platform: ReviewPlatform
          rating: number
          content?: string | null
          author_name?: string | null
          review_date: string
          status?: ReviewStatus
          ai_response_draft?: string | null
          owner_response?: string | null
          responded_at?: string | null
          google_review_id?: string | null
        }
        Update: Partial<Database['public']['Tables']['reviews']['Insert']>
        Relationships: []
      }

      // ── Loyalty Members ─────────────────────────────────────────────────────
      loyalty_members: {
        Row: {
          id: string
          venue_id: string
          guest_id: string
          qr_code: string
          tier: LoyaltyTier
          points_balance: number
          points_earned_total: number
          enrolled_at: string
          last_activity_at: string | null
          birthday: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          guest_id: string
          qr_code: string
          tier?: LoyaltyTier
          points_balance?: number
          points_earned_total?: number
          enrolled_at?: string
          last_activity_at?: string | null
          birthday?: string | null
        }
        Update: Partial<Database['public']['Tables']['loyalty_members']['Insert']>
        Relationships: []
      }

      // ── Loyalty Transactions ────────────────────────────────────────────────
      loyalty_transactions: {
        Row: {
          id: string
          venue_id: string
          member_id: string
          type: TransactionType
          points: number
          description: string | null
          reference_id: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          member_id: string
          type: TransactionType
          points: number
          description?: string | null
          reference_id?: string | null
          created_by?: string | null
        }
        Update: never
        Relationships: []
      }

      // ── WhatsApp Messages (Twilio outbound log) ─────────────────────────────
      whatsapp_messages: {
        Row: {
          id: string
          venue_id: string
          guest_id: string | null
          phone: string
          message_type: WAMessageType
          body: string
          status: WAMessageStatus
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
          message_type: WAMessageType
          body: string
          status?: WAMessageStatus
          twilio_sid?: string | null
          error_message?: string | null
        }
        Update: Partial<Database['public']['Tables']['whatsapp_messages']['Insert']>
        Relationships: []
      }

      // ── Campaigns ───────────────────────────────────────────────────────────
      campaigns: {
        Row: {
          id: string
          venue_id: string
          name: string
          type: string
          channel: Channel
          status: CampaignStatus
          target_segment: Json
          message_template: string
          scheduled_at: string | null
          sent_count: number
          opened_count: number
          clicked_count: number
          converted_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          name: string
          type: string
          channel: Channel
          status?: CampaignStatus
          target_segment?: Json
          message_template: string
          scheduled_at?: string | null
          sent_count?: number
          opened_count?: number
          clicked_count?: number
          converted_count?: number
        }
        Update: Partial<Database['public']['Tables']['campaigns']['Insert']>
        Relationships: []
      }

      // ── Campaign Sends ──────────────────────────────────────────────────────
      campaign_sends: {
        Row: {
          id: string
          campaign_id: string
          venue_id: string
          guest_id: string
          status: string
          sent_at: string | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          venue_id: string
          guest_id: string
          status: string
          sent_at?: string | null
          error_message?: string | null
        }
        Update: Partial<Database['public']['Tables']['campaign_sends']['Insert']>
        Relationships: []
      }

      // ── Conversations ───────────────────────────────────────────────────────
      conversations: {
        Row: {
          id: string
          venue_id: string
          guest_id: string
          channel: Channel
          status: ConversationStatus
          ai_handled: boolean
          human_takeover_at: string | null
          last_message_at: string | null
          context: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          guest_id: string
          channel: Channel
          status?: ConversationStatus
          ai_handled?: boolean
          human_takeover_at?: string | null
          last_message_at?: string | null
          context?: Json
        }
        Update: Partial<Database['public']['Tables']['conversations']['Insert']>
        Relationships: []
      }

      // ── Messages ────────────────────────────────────────────────────────────
      messages: {
        Row: {
          id: string
          conversation_id: string
          venue_id: string
          role: MessageRole
          content: string
          channel_message_id: string | null
          sent_at: string
          delivered_at: string | null
          read_at: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          venue_id: string
          role: MessageRole
          content: string
          channel_message_id?: string | null
          sent_at?: string
          delivered_at?: string | null
          read_at?: string | null
          metadata?: Json
        }
        Update: never
        Relationships: []
      }

      // ── Action Items ────────────────────────────────────────────────────────
      action_items: {
        Row: {
          id: string
          venue_id: string
          title: string
          description: string | null
          type: string
          priority: Priority
          status: 'pending' | 'done' | 'dismissed'
          due_at: string | null
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
          priority: Priority
          status?: 'pending' | 'done' | 'dismissed'
          due_at?: string | null
          related_id?: string | null
          related_type?: string | null
        }
        Update: Partial<Database['public']['Tables']['action_items']['Insert']>
        Relationships: []
      }

      // ── KPI Snapshots ───────────────────────────────────────────────────────
      kpi_snapshots: {
        Row: {
          id: string
          venue_id: string
          date: string
          new_members: number
          active_members: number | null
          reviews_requested: number | null
          reviews_received: number | null
          avg_rating: number | null
          campaign_opens: number | null
          campaign_revenue: number | null
          ai_conversations: number | null
          created_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          date: string
          new_members?: number
          active_members?: number | null
          reviews_requested?: number | null
          reviews_received?: number | null
          avg_rating?: number | null
          campaign_opens?: number | null
          campaign_revenue?: number | null
          ai_conversations?: number | null
        }
        Update: Partial<Database['public']['Tables']['kpi_snapshots']['Insert']>
        Relationships: []
      }

      // ── Weekly Reports ──────────────────────────────────────────────────────
      weekly_reports: {
        Row: {
          id: string
          venue_id: string
          report_date: string
          content: string
          kpi_data: Json
          created_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          report_date: string
          content: string
          kpi_data?: Json
        }
        Update: Partial<Database['public']['Tables']['weekly_reports']['Insert']>
        Relationships: []
      }

      // ── AI Recommendations ──────────────────────────────────────────────────
      ai_recommendations: {
        Row: {
          id: string
          venue_id: string
          type: string
          title: string
          description: string
          priority: Priority
          status: 'pending' | 'actioned' | 'dismissed'
          data: Json
          generated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          venue_id: string
          type: string
          title: string
          description: string
          priority: Priority
          status?: 'pending' | 'actioned' | 'dismissed'
          data?: Json
          generated_at?: string
        }
        Update: Partial<Database['public']['Tables']['ai_recommendations']['Insert']>
        Relationships: []
      }

      // ── Leads ───────────────────────────────────────────────────────────────
      leads: {
        Row: {
          id: string
          venue_id_assigned: string | null
          name: string
          venue_name: string
          phone: string | null
          email: string | null
          city: string | null
          country: string | null
          plan_interest: VenuePlan | null
          source: string | null
          status: 'new' | 'contacted' | 'demo_scheduled' | 'proposal_sent' | 'won' | 'lost'
          notes: string | null
          assigned_to: string | null
          last_contacted_at: string | null
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
          country?: string | null
          plan_interest?: VenuePlan | null
          source?: string | null
          status?: 'new' | 'contacted' | 'demo_scheduled' | 'proposal_sent' | 'won' | 'lost'
          notes?: string | null
          assigned_to?: string | null
          last_contacted_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['leads']['Insert']>
        Relationships: []
      }

    }

    // Required by @supabase/postgrest-js v2.x GenericSchema
    Views:          Record<string, never>
    Functions:      Record<string, never>
    Enums:          Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// ── Convenience types ──────────────────────────────────────────────────────────
export type Venue              = Database['public']['Tables']['venues']['Row']
export type Subscription       = Database['public']['Tables']['subscriptions']['Row']
export type Guest              = Database['public']['Tables']['guests']['Row']
export type Visit              = Database['public']['Tables']['visits']['Row']
export type Review             = Database['public']['Tables']['reviews']['Row']
export type ReviewRequest      = Database['public']['Tables']['review_requests']['Row']
export type LoyaltyMember      = Database['public']['Tables']['loyalty_members']['Row']
export type LoyaltyTransaction = Database['public']['Tables']['loyalty_transactions']['Row']
export type WhatsAppMessage    = Database['public']['Tables']['whatsapp_messages']['Row']
export type Campaign           = Database['public']['Tables']['campaigns']['Row']
export type CampaignSend       = Database['public']['Tables']['campaign_sends']['Row']
export type Conversation       = Database['public']['Tables']['conversations']['Row']
export type Message            = Database['public']['Tables']['messages']['Row']
export type ActionItem         = Database['public']['Tables']['action_items']['Row']
export type KpiSnapshot        = Database['public']['Tables']['kpi_snapshots']['Row']
export type WeeklyReport       = Database['public']['Tables']['weekly_reports']['Row']
export type Lead               = Database['public']['Tables']['leads']['Row']
