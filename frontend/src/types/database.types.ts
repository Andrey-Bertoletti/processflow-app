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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_generations: {
        Row: {
          campaign_id: string
          created_at: string | null
          id: string
          lead_id: string
          prompt: string
          prompt_hash: string | null
          response: string
          status: string | null
          tokens_used: number | null
          model: string | null
          latency_ms: number | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          id?: string
          lead_id: string
          prompt: string
          prompt_hash?: string | null
          response: string
          status?: string | null
          tokens_used?: number | null
          model?: string | null
          latency_ms?: number | null
          user_id: string
          workspace_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          id?: string
          lead_id?: string
          prompt?: string
          prompt_hash?: string | null
          response?: string
          status?: string | null
          tokens_used?: number | null
          model?: string | null
          latency_ms?: number | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          base_prompt: string
          context: string
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          base_prompt: string
          context: string
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          base_prompt?: string
          context?: string
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          lead_id: string
          new_stage_id: string | null
          old_stage_id: string | null
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          lead_id: string
          new_stage_id?: string | null
          old_stage_id?: string | null
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          lead_id?: string
          new_stage_id?: string | null
          old_stage_id?: string | null
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_new_stage_id_fkey"
            columns: ["new_stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_old_stage_id_fkey"
            columns: ["old_stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          campaign_id: string | null
          created_at: string | null
          email: string | null
          id: string
          is_generating_ai: boolean
          name: string
          phone: string | null
          stage_id: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          assigned_to?: string | null
          campaign_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_generating_ai?: boolean
          name: string
          phone?: string | null
          stage_id?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_generating_ai?: boolean
          name?: string
          phone?: string | null
          stage_id?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          campaign_id: string | null
          content: string
          created_at: string | null
          id: string
          lead_id: string | null
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          campaign_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          lead_id?: string | null
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          campaign_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          lead_id?: string | null
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      processes: {
        Row: {
          created_at: string | null
          id: string
          status: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          status?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          id?: string
          status?: string | null
          title?: string
        }
        Relationships: []
      }
      stages: {
        Row: {
          created_at: string | null
          id: string
          name: string
          order: number
          required_fields: Json
          updated_at: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          order: number
          required_fields?: Json
          updated_at?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          order?: number
          required_fields?: Json
          updated_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_users: {
        Row: {
          created_at: string | null
          id: string
          role: string | null
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string | null
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_users_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string | null
          id: string
          name: string
          owner_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          owner_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          owner_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_workspace: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      create_workspace_with_owner: { Args: { p_name: string }; Returns: string }
      get_workspace_members: {
        Args: { p_workspace_id: string }
        Returns: {
          display_name: string
          email: string
          id: string
          role: string
          user_id: string
        }[]
      }
      is_user_in_workspace: { Args: { ws_id: string }; Returns: boolean }
      is_valid_lead_assignee: {
        Args: { p_assigned_to: string; p_workspace_id: string }
        Returns: boolean
      }
      seed_workspace_pipeline: {
        Args: { p_with_demo_leads?: boolean; p_workspace_id: string }
        Returns: undefined
      }
    }
    Enums: {
      campaign_status: "draft" | "active" | "finished"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
export type LeadEvent = Database["public"]["Tables"]["lead_events"]["Row"];
export type AiGeneration = Database["public"]["Tables"]["ai_generations"]["Row"];
export type Lead = Database["public"]["Tables"]["leads"]["Row"];
export type Stage = Database["public"]["Tables"]["stages"]["Row"];

export type WorkspaceMember = {
  id: string;
  userId: string;
  role: string | null;
  email: string | null;
  displayName: string;
};

export type LeadFormPayload = {
  name: string;
  email: string | null;
  phone: string | null;
  stageId: string | null;
  assignedTo: string | null;
  campaignId: string | null;
};


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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      campaign_status: ["draft", "active", "finished"],
    },
  },
} as const
