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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          payload: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          payload?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      loyalty_levels: {
        Row: {
          created_at: string
          emoji: string
          gradient: string
          key: string
          multiplier: number
          name: string
          sort_order: number
          stars: number
          threshold: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          emoji: string
          gradient?: string
          key: string
          multiplier: number
          name: string
          sort_order: number
          stars?: number
          threshold: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          emoji?: string
          gradient?: string
          key?: string
          multiplier?: number
          name?: string
          sort_order?: number
          stars?: number
          threshold?: number
          updated_at?: string
        }
        Relationships: []
      }
      mission_completions: {
        Row: {
          completed_at: string
          id: string
          mission_id: string
          points: number
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          mission_id: string
          points: number
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          mission_id?: string
          points?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mission_completions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mission_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      missions: {
        Row: {
          active: boolean
          created_at: string
          description: string
          id: string
          points: number
          title: string
          updated_at: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          id?: string
          points: number
          title: string
          updated_at?: string
          url?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          id?: string
          points?: number
          title?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount_uzs: number
          base_amount_uzs: number
          cancel_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          expires_at: string
          id: string
          order_no: number
          product_type: Database["public"]["Enums"]["product_type"]
          quantity: number
          recipient_username: string
          status: Database["public"]["Enums"]["order_status"]
          unit_price_uzs: number
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_uzs: number
          base_amount_uzs: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          order_no?: number
          product_type: Database["public"]["Enums"]["product_type"]
          quantity: number
          recipient_username: string
          status?: Database["public"]["Enums"]["order_status"]
          unit_price_uzs: number
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_uzs?: number
          base_amount_uzs?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          order_no?: number
          product_type?: Database["public"]["Enums"]["product_type"]
          quantity?: number
          recipient_username?: string
          status?: Database["public"]["Enums"]["order_status"]
          unit_price_uzs?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          created_at: string
          declared_amount_uzs: number
          id: string
          method: string
          order_id: string
          payer_note: string | null
          receipt_url: string | null
          reject_reason: string | null
          status: Database["public"]["Enums"]["payment_status"]
          submitted_at: string | null
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          declared_amount_uzs: number
          id?: string
          method?: string
          order_id: string
          payer_note?: string | null
          receipt_url?: string | null
          reject_reason?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          declared_amount_uzs?: number
          id?: string
          method?: string
          order_id?: string
          payer_note?: string | null
          receipt_url?: string | null
          reject_reason?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      points_ledger: {
        Row: {
          created_at: string
          id: string
          mission_id: string | null
          note: string
          order_id: string | null
          points: number
          referral_id: string | null
          reward_request_id: string | null
          type: Database["public"]["Enums"]["ledger_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mission_id?: string | null
          note?: string
          order_id?: string | null
          points: number
          referral_id?: string | null
          reward_request_id?: string | null
          type: Database["public"]["Enums"]["ledger_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mission_id?: string | null
          note?: string
          order_id?: string | null
          points?: number
          referral_id?: string | null
          reward_request_id?: string | null
          type?: Database["public"]["Enums"]["ledger_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_mission_fk"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_referral_fk"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_request_fk"
            columns: ["reward_request_id"]
            isOneToOne: false
            referencedRelation: "reward_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "points_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          points_awarded: number
          qualified_at: string | null
          referred_id: string
          referrer_id: string
          rewarded_at: string | null
          status: Database["public"]["Enums"]["referral_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          points_awarded?: number
          qualified_at?: string | null
          referred_id: string
          referrer_id: string
          rewarded_at?: string | null
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          points_awarded?: number
          qualified_at?: string | null
          referred_id?: string
          referrer_id?: string
          rewarded_at?: string | null
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_requests: {
        Row: {
          cost_points: number
          created_at: string
          handled_by: string | null
          id: string
          level_emoji: string | null
          level_key: string | null
          level_name: string | null
          output_stars: number
          reject_reason: string | null
          request_no: number
          reward_id: string | null
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cost_points: number
          created_at?: string
          handled_by?: string | null
          id?: string
          level_emoji?: string | null
          level_key?: string | null
          level_name?: string | null
          output_stars: number
          reject_reason?: string | null
          request_no?: number
          reward_id?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cost_points?: number
          created_at?: string
          handled_by?: string | null
          id?: string
          level_emoji?: string | null
          level_key?: string | null
          level_name?: string | null
          output_stars?: number
          reject_reason?: string | null
          request_no?: number
          reward_id?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_requests_handled_by_fkey"
            columns: ["handled_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_requests_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          active: boolean
          cost_points: number
          created_at: string
          id: string
          output_stars: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          cost_points: number
          created_at?: string
          id?: string
          output_stars: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          cost_points?: number
          created_at?: string
          id?: string
          output_stars?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          first_name: string | null
          id: string
          is_blocked: boolean
          language_code: string | null
          last_name: string | null
          last_seen_at: string
          photo_url: string | null
          referral_code: string
          referred_by: string | null
          telegram_id: number
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          first_name?: string | null
          id?: string
          is_blocked?: boolean
          language_code?: string | null
          last_name?: string | null
          last_seen_at?: string
          photo_url?: string | null
          referral_code: string
          referred_by?: string | null
          telegram_id: number
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          first_name?: string | null
          id?: string
          is_blocked?: boolean
          language_code?: string | null
          last_name?: string | null
          last_seen_at?: string
          photo_url?: string | null
          referral_code?: string
          referred_by?: string | null
          telegram_id?: number
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_mission: {
        Args: { _mission_id: string; _user_id: string }
        Returns: {
          completed_at: string
          id: string
          mission_id: string
          points: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "mission_completions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_order: {
        Args: { _actor?: string; _order_id: string }
        Returns: {
          amount_uzs: number
          base_amount_uzs: number
          cancel_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          expires_at: string
          id: string
          order_no: number
          product_type: Database["public"]["Enums"]["product_type"]
          quantity: number
          recipient_username: string
          status: Database["public"]["Enums"]["order_status"]
          unit_price_uzs: number
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      expire_stale_orders: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      level_for: {
        Args: { _value: number }
        Returns: {
          created_at: string
          emoji: string
          gradient: string
          key: string
          multiplier: number
          name: string
          sort_order: number
          stars: number
          threshold: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "loyalty_levels"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      redeem_reward: {
        Args: { _reward_id: string; _user_id: string }
        Returns: {
          cost_points: number
          created_at: string
          handled_by: string | null
          id: string
          level_emoji: string | null
          level_key: string | null
          level_name: string | null
          output_stars: number
          reject_reason: string | null
          request_no: number
          reward_id: string | null
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "reward_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reject_reward_request: {
        Args: { _actor: string; _reason?: string; _request_id: string }
        Returns: {
          cost_points: number
          created_at: string
          handled_by: string | null
          id: string
          level_emoji: string | null
          level_key: string | null
          level_name: string | null
          output_stars: number
          reject_reason: string | null
          request_no: number
          reward_id: string | null
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "reward_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      user_points: { Args: { _user_id: string }; Returns: number }
      user_progress_value: { Args: { _user_id: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "user"
      ledger_type:
        | "earn"
        | "referral"
        | "mission"
        | "redeem"
        | "refund"
        | "adjust"
      order_status:
        | "draft"
        | "awaiting_payment"
        | "processing"
        | "completed"
        | "cancelled"
        | "expired"
      payment_status: "pending" | "submitted" | "verified" | "rejected"
      product_type: "stars" | "premium_3" | "premium_6" | "premium_12"
      referral_status: "pending" | "qualified" | "rewarded"
      request_status: "pending" | "approved" | "completed" | "rejected"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "user"],
      ledger_type: [
        "earn",
        "referral",
        "mission",
        "redeem",
        "refund",
        "adjust",
      ],
      order_status: [
        "draft",
        "awaiting_payment",
        "processing",
        "completed",
        "cancelled",
        "expired",
      ],
      payment_status: ["pending", "submitted", "verified", "rejected"],
      product_type: ["stars", "premium_3", "premium_6", "premium_12"],
      referral_status: ["pending", "qualified", "rewarded"],
      request_status: ["pending", "approved", "completed", "rejected"],
    },
  },
} as const
