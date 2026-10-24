// Generado desde el esquema de Supabase (proyecto focusos-dev). No editar a mano:
// regenerar tras cada migración (ver README, "Tipos de la base de datos").

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
      grade_items: {
        Row: {
          category: Database["public"]["Enums"]["grade_category"]
          created_at: string
          due_at: string | null
          id: string
          max_score: number | null
          notes: string | null
          score: number | null
          subject_id: string
          title: string
          updated_at: string
          user_id: string
          weight: number | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["grade_category"]
          created_at?: string
          due_at?: string | null
          id?: string
          max_score?: number | null
          notes?: string | null
          score?: number | null
          subject_id: string
          title: string
          updated_at?: string
          user_id?: string
          weight?: number | null
        }
        Update: {
          category?: Database["public"]["Enums"]["grade_category"]
          created_at?: string
          due_at?: string | null
          id?: string
          max_score?: number | null
          notes?: string | null
          score?: number | null
          subject_id?: string
          title?: string
          updated_at?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grade_items_subject_fkey"
            columns: ["subject_id", "user_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      integration_credentials: {
        Row: {
          created_at: string
          provider: Database["public"]["Enums"]["integration_provider"]
          secret: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          provider: Database["public"]["Enums"]["integration_provider"]
          secret: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          provider?: Database["public"]["Enums"]["integration_provider"]
          secret?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_credentials_integration_fkey"
            columns: ["user_id", "provider"]
            isOneToOne: true
            referencedRelation: "integrations"
            referencedColumns: ["user_id", "provider"]
          },
        ]
      }
      integrations: {
        Row: {
          created_at: string
          id: string
          last_error: string | null
          last_synced_at: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          settings: Json
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          provider: Database["public"]["Enums"]["integration_provider"]
          settings?: Json
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          provider?: Database["public"]["Enums"]["integration_provider"]
          settings?: Json
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          study_window_end: number
          study_window_start: number
          timezone: string
          updated_at: string
          week_starts_on: number
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          study_window_end?: number
          study_window_start?: number
          timezone?: string
          updated_at?: string
          week_starts_on?: number
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          study_window_end?: number
          study_window_start?: number
          timezone?: string
          updated_at?: string
          week_starts_on?: number
        }
        Relationships: []
      }
      schedule_events: {
        Row: {
          all_day: boolean
          created_at: string
          ends_at: string
          external_id: string | null
          external_source: string | null
          id: string
          kind: Database["public"]["Enums"]["schedule_event_kind"]
          location: string | null
          notes: string | null
          recurrence_rule: string | null
          starts_at: string
          subject_id: string | null
          timezone: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          ends_at: string
          external_id?: string | null
          external_source?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["schedule_event_kind"]
          location?: string | null
          notes?: string | null
          recurrence_rule?: string | null
          starts_at: string
          subject_id?: string | null
          timezone?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          all_day?: boolean
          created_at?: string
          ends_at?: string
          external_id?: string | null
          external_source?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["schedule_event_kind"]
          location?: string | null
          notes?: string | null
          recurrence_rule?: string | null
          starts_at?: string
          subject_id?: string | null
          timezone?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_events_subject_fkey"
            columns: ["subject_id", "user_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          focus_seconds: number | null
          id: string
          notes: string | null
          paused_at: string | null
          paused_seconds: number
          planned_minutes: number | null
          planned_start_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["study_session_status"]
          subject_id: string | null
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          focus_seconds?: number | null
          id?: string
          notes?: string | null
          paused_at?: string | null
          paused_seconds?: number
          planned_minutes?: number | null
          planned_start_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["study_session_status"]
          subject_id?: string | null
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          focus_seconds?: number | null
          id?: string
          notes?: string | null
          paused_at?: string | null
          paused_seconds?: number
          planned_minutes?: number | null
          planned_start_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["study_session_status"]
          subject_id?: string | null
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_subject_fkey"
            columns: ["subject_id", "user_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "study_sessions_task_fkey"
            columns: ["task_id", "user_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      subjects: {
        Row: {
          code: string | null
          color: string
          created_at: string
          credits: number | null
          id: string
          instructor: string | null
          is_archived: boolean
          name: string
          priority: Database["public"]["Enums"]["priority_level"]
          updated_at: string
          user_id: string
        }
        Insert: {
          code?: string | null
          color?: string
          created_at?: string
          credits?: number | null
          id?: string
          instructor?: string | null
          is_archived?: boolean
          name: string
          priority?: Database["public"]["Enums"]["priority_level"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          code?: string | null
          color?: string
          created_at?: string
          credits?: number | null
          id?: string
          instructor?: string | null
          is_archived?: boolean
          name?: string
          priority?: Database["public"]["Enums"]["priority_level"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          difficulty: number | null
          due_at: string | null
          estimated_minutes: number | null
          external_id: string | null
          external_source: string | null
          id: string
          kind: Database["public"]["Enums"]["task_kind"]
          priority: Database["public"]["Enums"]["priority_level"]
          status: Database["public"]["Enums"]["task_status"]
          subject_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          difficulty?: number | null
          due_at?: string | null
          estimated_minutes?: number | null
          external_id?: string | null
          external_source?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["task_kind"]
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["task_status"]
          subject_id?: string | null
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          difficulty?: number | null
          due_at?: string | null
          estimated_minutes?: number | null
          external_id?: string | null
          external_source?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["task_kind"]
          priority?: Database["public"]["Enums"]["priority_level"]
          status?: Database["public"]["Enums"]["task_status"]
          subject_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_subject_fkey"
            columns: ["subject_id", "user_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Views: {
      task_focus_totals: {
        Row: {
          focus_seconds: number | null
          session_count: number | null
          task_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cancel_study_session: {
        Args: { p_id: string }
        Returns: {
          created_at: string
          ended_at: string | null
          focus_seconds: number | null
          id: string
          notes: string | null
          paused_at: string | null
          paused_seconds: number
          planned_minutes: number | null
          planned_start_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["study_session_status"]
          subject_id: string | null
          task_id: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "study_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      finish_study_session: {
        Args: { p_focus_seconds?: number; p_id: string; p_notes?: string }
        Returns: {
          created_at: string
          ended_at: string | null
          focus_seconds: number | null
          id: string
          notes: string | null
          paused_at: string | null
          paused_seconds: number
          planned_minutes: number | null
          planned_start_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["study_session_status"]
          subject_id: string | null
          task_id: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "study_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_valid_timezone: { Args: { tz: string }; Returns: boolean }
      pause_study_session: {
        Args: { p_id: string }
        Returns: {
          created_at: string
          ended_at: string | null
          focus_seconds: number | null
          id: string
          notes: string | null
          paused_at: string | null
          paused_seconds: number
          planned_minutes: number | null
          planned_start_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["study_session_status"]
          subject_id: string | null
          task_id: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "study_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      resume_study_session: {
        Args: { p_id: string }
        Returns: {
          created_at: string
          ended_at: string | null
          focus_seconds: number | null
          id: string
          notes: string | null
          paused_at: string | null
          paused_seconds: number
          planned_minutes: number | null
          planned_start_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["study_session_status"]
          subject_id: string | null
          task_id: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "study_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      start_study_session: {
        Args: {
          p_planned_minutes?: number
          p_subject_id?: string
          p_task_id?: string
        }
        Returns: {
          created_at: string
          ended_at: string | null
          focus_seconds: number | null
          id: string
          notes: string | null
          paused_at: string | null
          paused_seconds: number
          planned_minutes: number | null
          planned_start_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["study_session_status"]
          subject_id: string | null
          task_id: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "study_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      grade_category:
        | "exam"
        | "quiz"
        | "assignment"
        | "project"
        | "lab"
        | "participation"
        | "presentation"
        | "other"
      integration_provider: "notion" | "openai" | "anthropic"
      integration_status: "disconnected" | "connected" | "error"
      priority_level: "low" | "medium" | "high" | "urgent"
      schedule_event_kind:
        | "class"
        | "lab"
        | "exam"
        | "study_block"
        | "deadline"
        | "personal"
        | "other"
      study_session_status: "planned" | "active" | "completed" | "cancelled"
      task_kind:
        | "assignment"
        | "study"
        | "project"
        | "reading"
        | "exam_prep"
        | "lab"
        | "other"
      task_status: "pending" | "in_progress" | "completed" | "cancelled"
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
      grade_category: [
        "exam",
        "quiz",
        "assignment",
        "project",
        "lab",
        "participation",
        "presentation",
        "other",
      ],
      integration_provider: ["notion", "openai", "anthropic"],
      integration_status: ["disconnected", "connected", "error"],
      priority_level: ["low", "medium", "high", "urgent"],
      schedule_event_kind: [
        "class",
        "lab",
        "exam",
        "study_block",
        "deadline",
        "personal",
        "other",
      ],
      study_session_status: ["planned", "active", "completed", "cancelled"],
      task_kind: [
        "assignment",
        "study",
        "project",
        "reading",
        "exam_prep",
        "lab",
        "other",
      ],
      task_status: ["pending", "in_progress", "completed", "cancelled"],
    },
  },
} as const
