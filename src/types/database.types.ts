// Hand-authored to match supabase/migrations/*.sql exactly (no live project
// to run `supabase gen types` against yet -- see plan "Known gaps"). Only
// covers the Views/Functions granted to `authenticated`; raw tables are
// intentionally omitted since the app never queries them directly.
// Regenerate with `supabase gen types typescript --linked` once linked, and
// this file becomes redundant.
//
// Every view entry needs `Relationships: []` even though none of these views
// expose foreign-key relationships -- postgrest-js's GenericSchema/GenericView
// constraint requires the field to be present at all for `Database['public']`
// to structurally satisfy GenericSchema. Omitting it makes the whole schema
// fall back silently and breaks .rpc()'s Args inference (shows up as
// "not assignable to parameter of type 'undefined'").

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: Record<string, never>;
    Views: {
      v_sales_daily_outlet: {
        Row: {
          sales_date: string;
          branch_code: string;
          revenue: number | null;
          nett_sales: number | null;
          trans_count: number | null;
          member_revenue: number | null;
          non_promo_revenue: number | null;
          non_promo_trans_count: number | null;
        };
        Relationships: [];
      };
      v_sales_hourly_outlet: {
        Row: {
          sales_date: string;
          branch_code: string;
          hour_of_day: number;
          revenue: number | null;
          trans_count: number | null;
        };
        Relationships: [];
      };
      v_sales_product_daily: {
        Row: {
          sales_date: string;
          branch_code: string;
          menu_id: string;
          menu_name: string | null;
          category_id: string | null;
          category: string | null;
          qty: number | null;
          revenue: number | null;
          category_detail_id: string | null;
          category_detail: string | null;
        };
        Relationships: [];
      };
      v_sales_daily_outlet_category: {
        Row: {
          sales_date: string;
          branch_code: string;
          category_id: string | null;
          category_detail_id: string | null;
          revenue: number | null;
          nett_sales: number | null;
        };
        Relationships: [];
      };
      v_sales_bills: {
        Row: {
          bill_num: string;
          sales_date: string;
          branch_code: string;
          grand_total: number | null;
        };
        Relationships: [];
      };
      v_promo_daily: {
        Row: {
          sales_date: string;
          branch_code: string;
          promotion_id: string;
          promotion_name: string | null;
          redemptions: number | null;
          promo_revenue: number | null;
          discount_cost: number | null;
        };
        Relationships: [];
      };
      v_outlets: {
        Row: { branch_code: string; branch_name: string };
        Relationships: [];
      };
      v_categories: {
        Row: { category_id: string | null; category_name: string | null };
        Relationships: [];
      };
      v_category_details: {
        Row: { category_detail_id: string | null; category_detail_name: string | null; category_id: string | null };
        Relationships: [];
      };
      v_member_visits_daily: {
        Row: {
          sales_date: string;
          member_code: string;
          branch_code: string;
          visit_count: number | null;
          spending: number | null;
        };
        Relationships: [];
      };
      v_member_branch_counts: {
        Row: { member_code: string; branch_code: string; visits: number | null };
        Relationships: [];
      };
      v_members_dim: {
        Row: {
          member_code: string;
          member_name: string | null;
          home_branch_code: string | null;
          home_branch_name: string | null;
          first_seen_date: string | null;
          last_seen_date: string | null;
          total_visits: number | null;
          total_spending: number | null;
          tier: string | null;
        };
        Relationships: [];
      };
      v_membership_new_weekly: {
        Row: { week_start: string; new_members: number | null };
        Relationships: [];
      };
      v_member_menu_daily: {
        Row: {
          member_code: string;
          sales_date: string;
          branch_code: string;
          menu_id: string;
          menu_name: string | null;
          qty: number | null;
          revenue: number | null;
        };
        Relationships: [];
      };
      v_last_sync: {
        Row: {
          job_name: string;
          finished_at: string | null;
          status: string;
          rows_synced: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      fn_menu_performance: {
        Args: {
          p_date_start: string;
          p_date_end: string;
          p_outlet?: string | null;
          p_category_id?: string | null;
          p_category_detail_id?: string | null;
          p_threshold?: number;
        };
        Returns: {
          menu_id: string;
          menu_name: string | null;
          category: string | null;
          category_detail: string | null;
          qty: number;
          revenue: number;
          contribution_pct: number | null;
          trend: "naik" | "turun" | "stagnan";
          is_takeout_candidate: boolean;
        }[];
      };
      fn_promo_performance: {
        Args: { p_date_start: string; p_date_end: string; p_outlet?: string | null };
        Returns: {
          promotion_id: string;
          promotion_name: string | null;
          redemptions: number;
          promo_revenue: number;
          discount_cost: number;
          lift_pct: number | null;
          roi: number | null;
          status: "Efektif" | "Kurang Efektif";
        }[];
      };
      fn_membership_summary: {
        Args: { p_date_start: string; p_date_end: string; p_outlet?: string | null };
        Returns: {
          total_members: number;
          active_members: number;
          active_pct: number | null;
          churn_pct: number | null;
          retention_pct: number | null;
          visit_frequency: number | null;
        }[];
      };
      fn_top_members: {
        Args: {
          p_date_start: string;
          p_date_end: string;
          p_outlet?: string | null;
          p_limit?: number;
        };
        Returns: {
          member_code: string;
          member_name: string | null;
          outlet_name: string | null;
          tier: string | null;
          visits: number;
          spending: number;
          favorite_menu: string | null;
        }[];
      };
      fn_member_menu_purchases: {
        Args: {
          p_member_code: string;
          p_date_start: string;
          p_date_end: string;
          p_outlet?: string | null;
        };
        Returns: {
          menu_id: string;
          menu_name: string | null;
          qty: number;
          revenue: number;
          last_purchase_date: string | null;
        }[];
      };
    };
    Enums: Record<string, never>;
  };
}
