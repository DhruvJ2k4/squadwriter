/**
 * Database types for SquadWriter — matches supabase/migrations/0001_init.sql.
 *
 * Hand-authored to mirror the shape produced by `supabase gen types typescript`,
 * so it can be regenerated later with the CLI without changing call sites.
 *
 * Schema is FROZEN after Stage 2 (see CLAUDE.md §2).
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// --- Enums (mirror the Postgres enum types) ---------------------------------
export type MemberRole = "owner" | "editor" | "checker" | "viewer"
export type PromptKind = "conversation" | "entity"
export type PromptType = "monolithic" | "prompt_chaining" | "rag_enabled" | "entity"
export type SectionType = "main" | "stage" | "rag_json"
export type CommentType = "note" | "suggestion"
export type CommentStatus = "open" | "resolved" | "ignored" | "applied" | "text_changed"
export type SessionStatus = "active" | "ended"
export type InviteStatus = "pending" | "accepted" | "declined"

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          email: string
          is_admin: boolean
          created_at: string
        }
        Insert: {
          id: string
          username: string
          email: string
          is_admin?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          username?: string
          email?: string
          is_admin?: boolean
          created_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          name: string
          client_name: string | null
          use_case: string | null
          owner_id: string
          archived: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          client_name?: string | null
          use_case?: string | null
          owner_id: string
          archived?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          client_name?: string | null
          use_case?: string | null
          owner_id?: string
          archived?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          id: string
          project_id: string
          user_id: string
          role: MemberRole
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          role: MemberRole
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          role?: MemberRole
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          id: string
          project_id: string
          owner_id: string
          title: string
          prompt_kind: PromptKind
          prompt_type: PromptType
          has_json_tab: boolean
          archived: boolean
          version_counter: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          owner_id: string
          title: string
          prompt_kind: PromptKind
          prompt_type: PromptType
          has_json_tab?: boolean
          archived?: boolean
          version_counter?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          owner_id?: string
          title?: string
          prompt_kind?: PromptKind
          prompt_type?: PromptType
          has_json_tab?: boolean
          archived?: boolean
          version_counter?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompts_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_sections: {
        Row: {
          id: string
          prompt_id: string
          section_type: SectionType
          title: string | null
          content: string
          position: number
          archived: boolean
        }
        Insert: {
          id?: string
          prompt_id: string
          section_type: SectionType
          title?: string | null
          content?: string
          position?: number
          archived?: boolean
        }
        Update: {
          id?: string
          prompt_id?: string
          section_type?: SectionType
          title?: string | null
          content?: string
          position?: number
          archived?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "prompt_sections_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_versions: {
        Row: {
          id: string
          prompt_id: string
          snapshot: Json
          saved_by: string
          label: string | null
          created_at: string
        }
        Insert: {
          id?: string
          prompt_id: string
          snapshot: Json
          saved_by: string
          label?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          prompt_id?: string
          snapshot?: Json
          saved_by?: string
          label?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_versions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_versions_saved_by_fkey"
            columns: ["saved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          id: string
          prompt_id: string
          version_id: string
          section_id: string
          author_id: string
          comment_type: CommentType
          anchor_start: number
          anchor_end: number
          anchored_text: string
          body: string
          status: CommentStatus
          created_at: string
        }
        Insert: {
          id?: string
          prompt_id: string
          version_id: string
          section_id: string
          author_id: string
          comment_type: CommentType
          anchor_start: number
          anchor_end: number
          anchored_text: string
          body: string
          status?: CommentStatus
          created_at?: string
        }
        Update: {
          id?: string
          prompt_id?: string
          version_id?: string
          section_id?: string
          author_id?: string
          comment_type?: CommentType
          anchor_start?: number
          anchor_end?: number
          anchored_text?: string
          body?: string
          status?: CommentStatus
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "prompt_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "prompt_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_replies: {
        Row: {
          id: string
          comment_id: string
          author_id: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          comment_id: string
          author_id: string
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          comment_id?: string
          author_id?: string
          body?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_replies_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          id: string
          prompt_id: string
          host_id: string
          duration_minutes: number
          started_at: string
          ends_at: string
          status: SessionStatus
          before_snapshot: Json | null
          after_snapshot: Json | null
        }
        Insert: {
          id?: string
          prompt_id: string
          host_id: string
          duration_minutes: number
          started_at?: string
          ends_at: string
          status?: SessionStatus
          before_snapshot?: Json | null
          after_snapshot?: Json | null
        }
        Update: {
          id?: string
          prompt_id?: string
          host_id?: string
          duration_minutes?: number
          started_at?: string
          ends_at?: string
          status?: SessionStatus
          before_snapshot?: Json | null
          after_snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_participants: {
        Row: {
          id: string
          session_id: string
          user_id: string
          working_copy: Json | null
          joined_at: string
        }
        Insert: {
          id?: string
          session_id: string
          user_id: string
          working_copy?: Json | null
          joined_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string
          working_copy?: Json | null
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_participants_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_invites: {
        Row: {
          id: string
          session_id: string
          invitee_id: string
          status: InviteStatus
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          invitee_id: string
          status?: InviteStatus
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          invitee_id?: string
          status?: InviteStatus
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_invites_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_invites_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity: {
        Row: {
          id: string
          project_id: string
          actor_id: string
          verb: string
          target: string | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id: string
          actor_id: string
          verb: string
          target?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          actor_id?: string
          verb?: string
          target?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    // RLS helper functions (is_admin, can_read_prompt, …) exist server-side but
    // are not exposed as client RPCs, so they are intentionally not typed here.
    Functions: {
      [_ in never]: never
    }
    Enums: {
      member_role: MemberRole
      prompt_kind: PromptKind
      prompt_type: PromptType
      section_type: SectionType
      comment_type: CommentType
      comment_status: CommentStatus
      session_status: SessionStatus
      invite_status: InviteStatus
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// --- Convenience helpers ----------------------------------------------------
type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

// Named row aliases for ergonomic imports across the app.
export type Profile = Tables<"profiles">
export type Project = Tables<"projects">
export type ProjectMember = Tables<"project_members">
export type Prompt = Tables<"prompts">
export type PromptSection = Tables<"prompt_sections">
export type PromptVersion = Tables<"prompt_versions">
export type Comment = Tables<"comments">
export type CommentReply = Tables<"comment_replies">
export type Session = Tables<"sessions">
export type SessionParticipant = Tables<"session_participants">
export type SessionInvite = Tables<"session_invites">
export type Activity = Tables<"activity">
