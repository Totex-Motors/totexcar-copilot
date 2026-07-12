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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          ano_fabricacao: number | null
          ano_modelo: number | null
          chassi: string | null
          combustivel: string | null
          cor: string | null
          created_at: string | null
          current_balance: number | null
          hodometro: number | null
          id: string
          initial_balance: number | null
          ipva_vencimento: string | null
          is_active: boolean | null
          licenciamento_vencimento: string | null
          marca: string | null
          modelo: string | null
          name: string
          placa: string | null
          renavam: string | null
          seguradora: string | null
          seguro_vencimento: string | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          ano_fabricacao?: number | null
          ano_modelo?: number | null
          chassi?: string | null
          combustivel?: string | null
          cor?: string | null
          created_at?: string | null
          current_balance?: number | null
          hodometro?: number | null
          id?: string
          initial_balance?: number | null
          ipva_vencimento?: string | null
          is_active?: boolean | null
          licenciamento_vencimento?: string | null
          marca?: string | null
          modelo?: string | null
          name: string
          placa?: string | null
          renavam?: string | null
          seguradora?: string | null
          seguro_vencimento?: string | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          ano_fabricacao?: number | null
          ano_modelo?: number | null
          chassi?: string | null
          combustivel?: string | null
          cor?: string | null
          created_at?: string | null
          current_balance?: number | null
          hodometro?: number | null
          id?: string
          initial_balance?: number | null
          ipva_vencimento?: string | null
          is_active?: boolean | null
          licenciamento_vencimento?: string | null
          marca?: string | null
          modelo?: string | null
          name?: string
          placa?: string | null
          renavam?: string | null
          seguradora?: string | null
          seguro_vencimento?: string | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          ai_model: string | null
          ai_provider: string | null
          anthropic_api_key: string | null
          app_url: string | null
          asaas_api_key: string | null
          asaas_sandbox: boolean | null
          asaas_webhook_token: string | null
          buyback_fipe_pct: number | null
          ecosystem_discount_pct: number | null
          gemini_api_key: string | null
          id: number
          integration_api_key: string | null
          member_annual_price: number | null
          member_monthly_price: number | null
          openai_api_key: string | null
          os_webhook_url: string | null
          payment_provider: string | null
          placa_api_bearer: string | null
          placa_api_device: string | null
          placa_api_url: string | null
          plan_annual_price: number | null
          referral_buyer_offer: string | null
          plan_monthly_price: number | null
          plan_name: string | null
          uazapi_number: string | null
          uazapi_token: string | null
          uazapi_url: string | null
          updated_at: string | null
        }
        Insert: {
          ai_model?: string | null
          ai_provider?: string | null
          anthropic_api_key?: string | null
          app_url?: string | null
          asaas_api_key?: string | null
          asaas_sandbox?: boolean | null
          asaas_webhook_token?: string | null
          buyback_fipe_pct?: number | null
          ecosystem_discount_pct?: number | null
          gemini_api_key?: string | null
          id?: number
          integration_api_key?: string | null
          member_annual_price?: number | null
          member_monthly_price?: number | null
          openai_api_key?: string | null
          os_webhook_url?: string | null
          payment_provider?: string | null
          placa_api_bearer?: string | null
          placa_api_device?: string | null
          placa_api_url?: string | null
          plan_annual_price?: number | null
          referral_buyer_offer?: string | null
          plan_monthly_price?: number | null
          plan_name?: string | null
          uazapi_number?: string | null
          uazapi_token?: string | null
          uazapi_url?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_model?: string | null
          ai_provider?: string | null
          anthropic_api_key?: string | null
          app_url?: string | null
          asaas_api_key?: string | null
          asaas_sandbox?: boolean | null
          asaas_webhook_token?: string | null
          buyback_fipe_pct?: number | null
          ecosystem_discount_pct?: number | null
          gemini_api_key?: string | null
          id?: number
          integration_api_key?: string | null
          member_annual_price?: number | null
          member_monthly_price?: number | null
          openai_api_key?: string | null
          os_webhook_url?: string | null
          payment_provider?: string | null
          placa_api_bearer?: string | null
          placa_api_device?: string | null
          placa_api_url?: string | null
          plan_annual_price?: number | null
          referral_buyer_offer?: string | null
          plan_monthly_price?: number | null
          plan_name?: string | null
          uazapi_number?: string | null
          uazapi_token?: string | null
          uazapi_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string | null
          icon: string | null
          id: number
          is_system: boolean | null
          name: string
          type: string | null
        }
        Insert: {
          color?: string | null
          icon?: string | null
          id?: number
          is_system?: boolean | null
          name: string
          type?: string | null
        }
        Update: {
          color?: string | null
          icon?: string | null
          id?: number
          is_system?: boolean | null
          name?: string
          type?: string | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean | null
          code: string
          created_at: string | null
          dealership: string | null
          discount_pct: number | null
          id: string
          label: string | null
          max_uses: number | null
          used_count: number | null
        }
        Insert: {
          active?: boolean | null
          code: string
          created_at?: string | null
          dealership?: string | null
          discount_pct?: number | null
          id?: string
          label?: string | null
          max_uses?: number | null
          used_count?: number | null
        }
        Update: {
          active?: boolean | null
          code?: string
          created_at?: string | null
          dealership?: string | null
          discount_pct?: number | null
          id?: string
          label?: string | null
          max_uses?: number | null
          used_count?: number | null
        }
        Relationships: []
      }
      inventory: {
        Row: {
          active: boolean
          brand: string | null
          color: string | null
          dealership: string | null
          external_id: string | null
          id: string
          km: number | null
          model: string | null
          photo_url: string | null
          price: number | null
          store_whatsapp: string | null
          synced_at: string
          title: string | null
          url: string | null
          year: number | null
        }
        Insert: {
          active?: boolean
          brand?: string | null
          color?: string | null
          dealership?: string | null
          external_id?: string | null
          id?: string
          km?: number | null
          model?: string | null
          photo_url?: string | null
          price?: number | null
          store_whatsapp?: string | null
          synced_at?: string
          title?: string | null
          url?: string | null
          year?: number | null
        }
        Update: {
          active?: boolean
          brand?: string | null
          color?: string | null
          dealership?: string | null
          external_id?: string | null
          id?: string
          km?: number | null
          model?: string | null
          photo_url?: string | null
          price?: number | null
          store_whatsapp?: string | null
          synced_at?: string
          title?: string | null
          url?: string | null
          year?: number | null
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          channel: string | null
          due_date: string
          id: string
          kind: string
          sent_at: string | null
          user_id: string | null
        }
        Insert: {
          channel?: string | null
          due_date: string
          id?: string
          kind: string
          sent_at?: string | null
          user_id?: string | null
        }
        Update: {
          channel?: string | null
          due_date?: string
          id?: string
          kind?: string
          sent_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing: {
        Row: {
          id: number
          plan_annual_price: number | null
          plan_monthly_price: number | null
        }
        Insert: {
          id?: number
          plan_annual_price?: number | null
          plan_monthly_price?: number | null
        }
        Update: {
          id?: number
          plan_annual_price?: number | null
          plan_monthly_price?: number | null
        }
        Relationships: []
      }
      referral_events: {
        Row: {
          car_external_id: string | null
          car_title: string | null
          created_at: string
          dealership: string | null
          id: string
          owner_id: string | null
          paid_at: string | null
          referral_code: string | null
          status: string
          type: string
          value: number
        }
        Insert: {
          car_external_id?: string | null
          car_title?: string | null
          created_at?: string
          dealership?: string | null
          id?: string
          owner_id?: string | null
          paid_at?: string | null
          referral_code?: string | null
          status?: string
          type?: string
          value?: number
        }
        Update: {
          car_external_id?: string | null
          car_title?: string | null
          created_at?: string
          dealership?: string | null
          id?: string
          owner_id?: string | null
          paid_at?: string | null
          referral_code?: string | null
          status?: string
          type?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "referral_events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          category_id: number | null
          created_at: string | null
          description: string | null
          id: string
          odometer: number | null
          raw_input: string | null
          source: string | null
          transaction_date: string | null
          type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          odometer?: number | null
          raw_input?: string | null
          source?: string | null
          transaction_date?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          odometer?: number | null
          raw_input?: string | null
          source?: string | null
          transaction_date?: string | null
          type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          cnh_categoria: string | null
          cnh_numero: string | null
          cnh_vencimento: string | null
          coupon_code: string | null
          created_at: string | null
          currency: string | null
          dealership: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string | null
          phone: string | null
          pix_key: string | null
          plan: string | null
          plan_cycle: string | null
          plan_value: number | null
          referral_code: string | null
          role: string | null
          stripe_customer_id: string | null
          subscription_status: string | null
          timezone: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string | null
        }
        Insert: {
          cnh_categoria?: string | null
          cnh_numero?: string | null
          cnh_vencimento?: string | null
          coupon_code?: string | null
          created_at?: string | null
          currency?: string | null
          dealership?: string | null
          email?: string | null
          id: string
          is_active?: boolean | null
          name?: string | null
          phone?: string | null
          pix_key?: string | null
          plan?: string | null
          plan_cycle?: string | null
          plan_value?: number | null
          referral_code?: string | null
          role?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          timezone?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
        }
        Update: {
          cnh_categoria?: string | null
          cnh_numero?: string | null
          cnh_vencimento?: string | null
          coupon_code?: string | null
          created_at?: string | null
          currency?: string | null
          dealership?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          phone?: string | null
          pix_key?: string | null
          plan?: string | null
          plan_cycle?: string | null
          plan_value?: number | null
          referral_code?: string | null
          role?: string | null
          stripe_customer_id?: string | null
          subscription_status?: string | null
          timezone?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      whatsapp_events: {
        Row: {
          created_at: string | null
          error: string | null
          from_phone: string | null
          id: string
          kind: string | null
          parsed: Json | null
          raw: Json | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          from_phone?: string | null
          id?: string
          kind?: string | null
          parsed?: Json | null
          raw?: Json | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error?: string | null
          from_phone?: string | null
          id?: string
          kind?: string | null
          parsed?: Json | null
          raw?: Json | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_events_user_id_fkey"
            columns: ["user_id"]
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
      is_admin: { Args: never; Returns: boolean }
      is_trial_active: { Args: { user_id: string }; Returns: boolean }
      trial_days_remaining: { Args: { user_id: string }; Returns: number }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
