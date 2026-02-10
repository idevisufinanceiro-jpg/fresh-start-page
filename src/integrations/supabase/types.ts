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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      attachments: {
        Row: {
          created_at: string
          customer_id: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          quote_id: string | null
          service_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          quote_id?: string | null
          service_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          quote_id?: string | null
          service_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          color: string | null
          created_at: string
          description: string | null
          end_time: string | null
          id: string
          reminder_at: string | null
          sale_id: string | null
          service_id: string | null
          start_time: string
          title: string
          user_id: string
        }
        Insert: {
          all_day?: boolean | null
          color?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          id?: string
          reminder_at?: string | null
          sale_id?: string | null
          service_id?: string | null
          start_time: string
          title: string
          user_id: string
        }
        Update: {
          all_day?: boolean | null
          color?: string | null
          created_at?: string
          description?: string | null
          end_time?: string | null
          id?: string
          reminder_at?: string | null
          sale_id?: string | null
          service_id?: string | null
          start_time?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          cnpj_cpf: string | null
          company_name: string | null
          created_at: string
          default_quote_message: string | null
          email: string | null
          facebook: string | null
          id: string
          instagram: string | null
          logo_url: string | null
          phone: string | null
          primary_color: string | null
          quote_footer_notes: string | null
          quote_header_notes: string | null
          receipt_logo_url: string | null
          secondary_color: string | null
          updated_at: string
          user_id: string
          website: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          cnpj_cpf?: string | null
          company_name?: string | null
          created_at?: string
          default_quote_message?: string | null
          email?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          phone?: string | null
          primary_color?: string | null
          quote_footer_notes?: string | null
          quote_header_notes?: string | null
          receipt_logo_url?: string | null
          secondary_color?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          cnpj_cpf?: string | null
          company_name?: string | null
          created_at?: string
          default_quote_message?: string | null
          email?: string | null
          facebook?: string | null
          id?: string
          instagram?: string | null
          logo_url?: string | null
          phone?: string | null
          primary_color?: string | null
          quote_footer_notes?: string | null
          quote_header_notes?: string | null
          receipt_logo_url?: string | null
          secondary_color?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          cep: string | null
          city: string | null
          client_type: Database["public"]["Enums"]["client_type"] | null
          company: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          total_revenue: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          cep?: string | null
          city?: string | null
          client_type?: Database["public"]["Enums"]["client_type"] | null
          company?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          total_revenue?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          cep?: string | null
          city?: string | null
          client_type?: Database["public"]["Enums"]["client_type"] | null
          company?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          total_revenue?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_entries: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          current_installment: number | null
          customer_id: string | null
          description: string
          due_date: string | null
          id: string
          installments: number | null
          notes: string | null
          original_amount: number | null
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_status: Database["public"]["Enums"]["payment_status"] | null
          receipt_url: string | null
          remaining_amount: number | null
          sale_id: string | null
          service_id: string | null
          type: Database["public"]["Enums"]["financial_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          current_installment?: number | null
          customer_id?: string | null
          description: string
          due_date?: string | null
          id?: string
          installments?: number | null
          notes?: string | null
          original_amount?: number | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          receipt_url?: string | null
          remaining_amount?: number | null
          sale_id?: string | null
          service_id?: string | null
          type: Database["public"]["Enums"]["financial_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          current_installment?: number | null
          customer_id?: string | null
          description?: string
          due_date?: string | null
          id?: string
          installments?: number | null
          notes?: string | null
          original_amount?: number | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"] | null
          receipt_url?: string | null
          remaining_amount?: number | null
          sale_id?: string | null
          service_id?: string | null
          type?: Database["public"]["Enums"]["financial_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_settings: {
        Row: {
          created_at: string
          font_family: string | null
          font_size: string | null
          footer_text: string | null
          header_color: string | null
          id: string
          logo_position: string | null
          logo_size: string | null
          margin_bottom: number | null
          margin_left: number | null
          margin_right: number | null
          margin_top: number | null
          primary_color: string | null
          secondary_color: string | null
          show_category: boolean | null
          show_company_name: boolean | null
          show_discount: boolean | null
          show_footer: boolean | null
          show_item_numbers: boolean | null
          show_logo: boolean | null
          show_page_numbers: boolean | null
          show_subtotal: boolean | null
          show_validity: boolean | null
          table_alternate_rows: boolean | null
          table_border_style: string | null
          table_header_color: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          font_family?: string | null
          font_size?: string | null
          footer_text?: string | null
          header_color?: string | null
          id?: string
          logo_position?: string | null
          logo_size?: string | null
          margin_bottom?: number | null
          margin_left?: number | null
          margin_right?: number | null
          margin_top?: number | null
          primary_color?: string | null
          secondary_color?: string | null
          show_category?: boolean | null
          show_company_name?: boolean | null
          show_discount?: boolean | null
          show_footer?: boolean | null
          show_item_numbers?: boolean | null
          show_logo?: boolean | null
          show_page_numbers?: boolean | null
          show_subtotal?: boolean | null
          show_validity?: boolean | null
          table_alternate_rows?: boolean | null
          table_border_style?: string | null
          table_header_color?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          font_family?: string | null
          font_size?: string | null
          footer_text?: string | null
          header_color?: string | null
          id?: string
          logo_position?: string | null
          logo_size?: string | null
          margin_bottom?: number | null
          margin_left?: number | null
          margin_right?: number | null
          margin_top?: number | null
          primary_color?: string | null
          secondary_color?: string | null
          show_category?: boolean | null
          show_company_name?: boolean | null
          show_discount?: boolean | null
          show_footer?: boolean | null
          show_item_numbers?: boolean | null
          show_logo?: boolean | null
          show_page_numbers?: boolean | null
          show_subtotal?: boolean | null
          show_validity?: boolean | null
          table_alternate_rows?: boolean | null
          table_border_style?: string | null
          table_header_color?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_approved: boolean | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_approved?: boolean | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_approved?: boolean | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quote_items: {
        Row: {
          created_at: string
          description: string
          id: string
          quantity: number
          quote_id: string
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          quantity?: number
          quote_id: string
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          quantity?: number
          quote_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          category: Database["public"]["Enums"]["service_category"] | null
          created_at: string
          customer_id: string | null
          delivery_date: string | null
          description: string | null
          discount: number | null
          id: string
          notes: string | null
          quote_number: string
          status: Database["public"]["Enums"]["quote_status"] | null
          subtotal: number
          title: string
          total: number
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["service_category"] | null
          created_at?: string
          customer_id?: string | null
          delivery_date?: string | null
          description?: string | null
          discount?: number | null
          id?: string
          notes?: string | null
          quote_number: string
          status?: Database["public"]["Enums"]["quote_status"] | null
          subtotal?: number
          title: string
          total?: number
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["service_category"] | null
          created_at?: string
          customer_id?: string | null
          delivery_date?: string | null
          description?: string | null
          discount?: number | null
          id?: string
          notes?: string | null
          quote_number?: string
          status?: Database["public"]["Enums"]["quote_status"] | null
          subtotal?: number
          title?: string
          total?: number
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          description: string
          id: string
          quantity: number
          sale_id: string
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          quantity?: number
          sale_id: string
          total: number
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          quantity?: number
          sale_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          customer_id: string | null
          delivery_date: string | null
          description: string | null
          discount: number | null
          event_date: string | null
          id: string
          installment_count: number | null
          installments_data: Json | null
          is_event: boolean | null
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          payment_status: string | null
          quote_id: string | null
          sale_number: string
          sold_at: string
          subtotal: number
          title: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          delivery_date?: string | null
          description?: string | null
          discount?: number | null
          event_date?: string | null
          id?: string
          installment_count?: number | null
          installments_data?: Json | null
          is_event?: boolean | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string | null
          quote_id?: string | null
          sale_number: string
          sold_at?: string
          subtotal?: number
          title: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          delivery_date?: string | null
          description?: string | null
          discount?: number | null
          event_date?: string | null
          id?: string
          installment_count?: number | null
          installments_data?: Json | null
          is_event?: boolean | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string | null
          quote_id?: string | null
          sale_number?: string
          sold_at?: string
          subtotal?: number
          title?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      service_stages: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          is_completed: boolean | null
          order_index: number
          service_id: string
          title: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean | null
          order_index?: number
          service_id: string
          title: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean | null
          order_index?: number
          service_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_stages_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_types: {
        Row: {
          category: string | null
          created_at: string
          default_price: number | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          default_price?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          default_price?: number | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          category: Database["public"]["Enums"]["service_category"] | null
          completed_at: string | null
          created_at: string
          customer_id: string | null
          description: string | null
          due_date: string | null
          id: string
          notes: string | null
          quote_id: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["service_status"] | null
          title: string
          total_value: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["service_category"] | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          quote_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["service_status"] | null
          title: string
          total_value?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["service_category"] | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          quote_id?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["service_status"] | null
          title?: string
          total_value?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount: number
          created_at: string
          financial_entry_id: string | null
          id: string
          is_skipped: boolean | null
          month: number
          paid_at: string | null
          payment_method: string | null
          payment_status: string
          skip_reason: string | null
          subscription_id: string
          user_id: string
          year: number
        }
        Insert: {
          amount: number
          created_at?: string
          financial_entry_id?: string | null
          id?: string
          is_skipped?: boolean | null
          month: number
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          skip_reason?: string | null
          subscription_id: string
          user_id: string
          year: number
        }
        Update: {
          amount?: number
          created_at?: string
          financial_entry_id?: string | null
          id?: string
          is_skipped?: boolean | null
          month?: number
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string
          skip_reason?: string | null
          subscription_id?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_financial_entry_id_fkey"
            columns: ["financial_entry_id"]
            isOneToOne: false
            referencedRelation: "financial_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          customer_id: string | null
          description: string | null
          end_date: string | null
          id: string
          is_active: boolean
          monthly_value: number
          notes: string | null
          payment_day: number | null
          start_date: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          monthly_value?: number
          notes?: string | null
          payment_day?: number | null
          start_date?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_active?: boolean
          monthly_value?: number
          notes?: string | null
          payment_day?: number | null
          start_date?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      task_checklists: {
        Row: {
          created_at: string | null
          id: string
          is_completed: boolean | null
          order_index: number | null
          task_id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          order_index?: number | null
          task_id: string
          title: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          order_index?: number | null
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklists_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_statuses: {
        Row: {
          color: string
          created_at: string
          hides_overdue: boolean
          id: string
          is_completed_status: boolean
          name: string
          order_index: number
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          hides_overdue?: boolean
          id?: string
          is_completed_status?: boolean
          name: string
          order_index?: number
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          hides_overdue?: boolean
          id?: string
          is_completed_status?: boolean
          name?: string
          order_index?: number
          user_id?: string
        }
        Relationships: []
      }
      task_tag_assignments: {
        Row: {
          created_at: string | null
          id: string
          tag_id: string
          task_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          tag_id: string
          task_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          tag_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "task_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_tag_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_tags: {
        Row: {
          color: string
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          contract_name: string | null
          contract_url: string | null
          created_at: string
          customer_id: string | null
          due_date: string | null
          estimated_time: number | null
          id: string
          notes: string | null
          order_index: number | null
          priority: string | null
          sale_id: string | null
          service_id: string | null
          status_id: string | null
          time_spent: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contract_name?: string | null
          contract_url?: string | null
          created_at?: string
          customer_id?: string | null
          due_date?: string | null
          estimated_time?: number | null
          id?: string
          notes?: string | null
          order_index?: number | null
          priority?: string | null
          sale_id?: string | null
          service_id?: string | null
          status_id?: string | null
          time_spent?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contract_name?: string | null
          contract_url?: string | null
          created_at?: string
          customer_id?: string | null
          due_date?: string | null
          estimated_time?: number | null
          id?: string
          notes?: string | null
          order_index?: number | null
          priority?: string | null
          sale_id?: string | null
          service_id?: string | null
          status_id?: string | null
          time_spent?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "task_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      theme_settings: {
        Row: {
          created_at: string
          desktop_background_color: string | null
          desktop_button_bg_color: string | null
          desktop_button_hover_color: string | null
          desktop_button_text_color: string | null
          desktop_card_bg_color: string | null
          desktop_card_border_color: string | null
          desktop_foreground_color: string | null
          desktop_input_bg_color: string | null
          desktop_input_border_color: string | null
          desktop_muted_color: string | null
          desktop_muted_foreground_color: string | null
          desktop_primary_color: string | null
          desktop_secondary_color: string | null
          desktop_sidebar_accent_color: string | null
          desktop_sidebar_bg_color: string | null
          desktop_sidebar_text_color: string | null
          id: string
          login_background_color: string | null
          login_button_bg_color: string | null
          login_button_text_color: string | null
          login_card_bg_color: string | null
          login_input_bg_color: string | null
          login_input_border_color: string | null
          login_text_color: string | null
          mobile_background_color: string | null
          mobile_button_bg_color: string | null
          mobile_button_hover_color: string | null
          mobile_button_text_color: string | null
          mobile_card_bg_color: string | null
          mobile_card_border_color: string | null
          mobile_foreground_color: string | null
          mobile_header_bg_color: string | null
          mobile_header_text_color: string | null
          mobile_input_bg_color: string | null
          mobile_input_border_color: string | null
          mobile_nav_active_color: string | null
          mobile_nav_bg_color: string | null
          mobile_nav_text_color: string | null
          mobile_primary_color: string | null
          mobile_secondary_color: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          desktop_background_color?: string | null
          desktop_button_bg_color?: string | null
          desktop_button_hover_color?: string | null
          desktop_button_text_color?: string | null
          desktop_card_bg_color?: string | null
          desktop_card_border_color?: string | null
          desktop_foreground_color?: string | null
          desktop_input_bg_color?: string | null
          desktop_input_border_color?: string | null
          desktop_muted_color?: string | null
          desktop_muted_foreground_color?: string | null
          desktop_primary_color?: string | null
          desktop_secondary_color?: string | null
          desktop_sidebar_accent_color?: string | null
          desktop_sidebar_bg_color?: string | null
          desktop_sidebar_text_color?: string | null
          id?: string
          login_background_color?: string | null
          login_button_bg_color?: string | null
          login_button_text_color?: string | null
          login_card_bg_color?: string | null
          login_input_bg_color?: string | null
          login_input_border_color?: string | null
          login_text_color?: string | null
          mobile_background_color?: string | null
          mobile_button_bg_color?: string | null
          mobile_button_hover_color?: string | null
          mobile_button_text_color?: string | null
          mobile_card_bg_color?: string | null
          mobile_card_border_color?: string | null
          mobile_foreground_color?: string | null
          mobile_header_bg_color?: string | null
          mobile_header_text_color?: string | null
          mobile_input_bg_color?: string | null
          mobile_input_border_color?: string | null
          mobile_nav_active_color?: string | null
          mobile_nav_bg_color?: string | null
          mobile_nav_text_color?: string | null
          mobile_primary_color?: string | null
          mobile_secondary_color?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          desktop_background_color?: string | null
          desktop_button_bg_color?: string | null
          desktop_button_hover_color?: string | null
          desktop_button_text_color?: string | null
          desktop_card_bg_color?: string | null
          desktop_card_border_color?: string | null
          desktop_foreground_color?: string | null
          desktop_input_bg_color?: string | null
          desktop_input_border_color?: string | null
          desktop_muted_color?: string | null
          desktop_muted_foreground_color?: string | null
          desktop_primary_color?: string | null
          desktop_secondary_color?: string | null
          desktop_sidebar_accent_color?: string | null
          desktop_sidebar_bg_color?: string | null
          desktop_sidebar_text_color?: string | null
          id?: string
          login_background_color?: string | null
          login_button_bg_color?: string | null
          login_button_text_color?: string | null
          login_card_bg_color?: string | null
          login_input_bg_color?: string | null
          login_input_border_color?: string | null
          login_text_color?: string | null
          mobile_background_color?: string | null
          mobile_button_bg_color?: string | null
          mobile_button_hover_color?: string | null
          mobile_button_text_color?: string | null
          mobile_card_bg_color?: string | null
          mobile_card_border_color?: string | null
          mobile_foreground_color?: string | null
          mobile_header_bg_color?: string | null
          mobile_header_text_color?: string | null
          mobile_input_bg_color?: string | null
          mobile_input_border_color?: string | null
          mobile_nav_active_color?: string | null
          mobile_nav_bg_color?: string | null
          mobile_nav_text_color?: string | null
          mobile_primary_color?: string | null
          mobile_secondary_color?: string | null
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
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_quote_number: { Args: { _user_id: string }; Returns: string }
      generate_sale_number: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved_user: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "seller"
      client_type: "individual" | "company"
      financial_type: "income" | "expense"
      payment_method: "pix" | "cash" | "card" | "transfer" | "open"
      payment_status: "paid" | "pending" | "partial"
      quote_status: "draft" | "sent" | "approved" | "cancelled"
      service_category:
        | "graphic_design"
        | "visual_identity"
        | "institutional_video"
        | "event_coverage"
        | "social_media"
        | "photography"
        | "motion_design"
        | "other"
      service_status: "scheduled" | "in_progress" | "completed"
      task_priority: "low" | "medium" | "high" | "urgent"
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
      app_role: ["admin", "user", "seller"],
      client_type: ["individual", "company"],
      financial_type: ["income", "expense"],
      payment_method: ["pix", "cash", "card", "transfer", "open"],
      payment_status: ["paid", "pending", "partial"],
      quote_status: ["draft", "sent", "approved", "cancelled"],
      service_category: [
        "graphic_design",
        "visual_identity",
        "institutional_video",
        "event_coverage",
        "social_media",
        "photography",
        "motion_design",
        "other",
      ],
      service_status: ["scheduled", "in_progress", "completed"],
      task_priority: ["low", "medium", "high", "urgent"],
    },
  },
} as const
