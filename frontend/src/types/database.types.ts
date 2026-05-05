export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type WorkspaceCustomField = Database['public']['Tables']['workspace_custom_fields']['Row']
export type LeadCustomFieldValue = Database['public']['Tables']['lead_custom_field_values']['Row']

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          name: string
          owner_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          owner_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          owner_id?: string | null
          created_at?: string | null
        }
      }
      workspace_users: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role?: string
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: string
          created_at?: string
        }
      }
      stages: {
        Row: {
          id: string
          workspace_id: string
          name: string
          order: number
          auto_campaign_id: string | null
          required_fields: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          order: number
          auto_campaign_id?: string | null
          required_fields?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          order?: number
          auto_campaign_id?: string | null
          required_fields?: Json
          created_at?: string
          updated_at?: string
        }
      }
      leads: {
        Row: {
          id: string
          workspace_id: string
          stage_id: string
          campaign_id: string | null
          name: string
          email: string | null
          phone: string | null
          assigned_to: string | null
          metadata: Json
          company: string | null
          role: string | null
          source: string | null
          notes: string | null
          created_at: string

          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          stage_id: string
          campaign_id?: string | null
          name: string
          email?: string | null
          phone?: string | null
          assigned_to?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          stage_id?: string
          campaign_id?: string | null
          name?: string
          email?: string | null
          phone?: string | null
          assigned_to?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      workspace_custom_fields: {
        Row: {
          id: string
          workspace_id: string
          name: string
          key: string
          field_type: string
          required: boolean
          options: Json
          is_active: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          key: string
          field_type: string
          required?: boolean
          options?: Json
          is_active?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          key?: string
          field_type?: string
          required?: boolean
          options?: Json
          is_active?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
      }
      lead_custom_field_values: {
        Row: {
          id: string
          lead_id: string
          custom_field_id: string
          value: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          custom_field_id: string
          value?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          custom_field_id?: string
          value?: Json
          created_at?: string
          updated_at?: string
        }
      }
      campaigns: {
        Row: {
          id: string
          workspace_id: string
          name: string
          status: string
          context: string | null
          base_prompt: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          status?: string
          context?: string | null
          base_prompt?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          status?: string
          context?: string | null
          base_prompt?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      lead_insights: {
        Row: {
          id: string
          lead_id: string
          workspace_id: string
          score: number
          sentiment: string
          risk_level: string
          recommended_action: string | null
          reasoning: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lead_id: string
          workspace_id: string
          score?: number
          sentiment?: string
          risk_level?: string
          recommended_action?: string | null
          reasoning?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lead_id?: string
          workspace_id?: string
          score?: number
          sentiment?: string
          risk_level?: string
          recommended_action?: string | null
          reasoning?: Json
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          workspace_id: string
          lead_id: string
          campaign_id: string | null
          content: string
          status: string
          is_automated: boolean
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          lead_id: string
          campaign_id?: string | null
          content: string
          status?: string
          is_automated?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          lead_id?: string
          campaign_id?: string | null
          content?: string
          status?: string
          is_automated?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_system_health_snapshot: {
        Args: Record<string, never>
        Returns: Json
      }
      create_workspace_with_owner: {
        Args: { p_name: string }
        Returns: string
      }
      seed_workspace_pipeline: {
        Args: { p_workspace_id: string; p_with_demo_leads?: boolean }
        Returns: undefined
      }
      can_access_workspace: {
        Args: { p_workspace_id: string }
        Returns: boolean
      }
      is_user_in_workspace: {
        Args: { ws_id: string }
        Returns: boolean
      }
      get_workspace_members: {
        Args: { p_workspace_id: string }
        Returns: {
          id: string
          user_id: string
          display_name: string
          email: string
          role: string
        }[]
      }
      is_valid_lead_assignee: {
        Args: { p_assigned_to: string; p_workspace_id: string }
        Returns: boolean
      }
    }

    Enums: {
      [_ in never]: never
    }
  }
}

// Shortcuts for common usage
export type Campaign = Database['public']['Tables']['campaigns']['Row']
export type Lead = Database['public']['Tables']['leads']['Row']
export type Stage = Database['public']['Tables']['stages']['Row']
export type Workspace = Database['public']['Tables']['workspaces']['Row']
export type LeadInsight = Database['public']['Tables']['lead_insights']['Row']
export type Message = Database['public']['Tables']['messages']['Row']

export type WorkspaceMember = {
  id: string
  user_id: string
  display_name: string
  email: string
  role: string
}

export type LeadFormPayload = {
  name: string
  email?: string | null
  phone?: string | null
  company?: string | null
  role?: string | null
  source?: string | null
  stageId: string
  assignedTo?: string | null
  campaignId?: string | null
  customFieldValues?: Record<string, Json | null | undefined>
}



