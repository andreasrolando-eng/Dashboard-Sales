import type { EsbSalesRecord } from "./types.ts";

export interface OutletRow {
  branch_code: string;
  branch_name: string;
  ext_branch_code: string | null;
}

export interface RawSaleRow {
  sales_num: string;
  bill_num: string | null;
  sales_date: string;
  sales_date_in: string | null;
  sales_date_out: string | null;
  branch_code: string;
  branch_name: string | null;
  ext_branch_code: string | null;
  member_code: string | null;
  member_name: string | null;
  external_member_code: string | null;
  table_id: string | null;
  table_name: string | null;
  visit_purpose_id: string | null;
  visit_purpose_name: string | null;
  visitor_type_id: string | null;
  visitor_type_name: string | null;
  pax_total: number | null;
  subtotal: number;
  discount_total: number;
  menu_discount_total: number;
  promotion_discount: number;
  voucher_discount_total: number;
  other_tax_total: number;
  vat_total: number;
  other_vat_total: number;
  delivery_cost: number;
  order_fee: number;
  grand_total: number;
  voucher_total: number;
  rounding_total: number;
  payment_total: number;
  billing_print_count: number | null;
  payment_print_count: number | null;
  additional_info: string | null;
  promotion_id: string | null;
  promotion_name: string | null;
  flag_inclusive: string | null;
  status_id: string | null;
  status_name: string | null;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  created_by: string | null;
  edited_by: string | null;
  edited_date: string | null;
  parent_link_sales_num: string | null;
  child_link_sales_num: unknown[];
  merge_table: unknown[];
  raw: EsbSalesRecord;
  synced_at: string;
}

export interface RawSalesPaymentRow {
  sales_num: string;
  sales_payment_backend_id: string;
  sales_payment_pos_id: string | null;
  payment_method_type_id: string | null;
  payment_method_type_name: string | null;
  payment_method_id: string | null;
  payment_method_name: string | null;
  voucher_code: string | null;
  card_number: string | null;
  bank_name: string | null;
  account_name: string | null;
  payment_amount: number;
  full_payment_amount: number;
}

export interface RawSalesMenuItemRow {
  sales_num: string;
  /** Position of this item within the sale's salesMenus[] -- the only reliable per-line uniqueness ESB provides (see migration 20260813100000). */
  line_seq: number;
  menu_id: string;
  batch_id: string;
  sales_date: string;
  branch_code: string;
  menu_category_id: string | null;
  menu_category_name: string | null;
  menu_category_detail_id: string | null;
  menu_category_detail_name: string | null;
  menu_name: string | null;
  menu_code: string | null;
  qty: number;
  original_price: number | null;
  price: number | null;
  discount: number | null;
  discount_value: number | null;
  other_tax_value: number | null;
  vat_value: number | null;
  total: number;
  notes: string | null;
  status_id: string | null;
  status_name: string | null;
  promotion_detail_id: string | null;
  menu_promotion_id: string | null;
  sales_type: string | null;
  packages: unknown[];
  extras: unknown[];
}

export interface TransformedBatch {
  outlets: OutletRow[];
  sales: RawSaleRow[];
  payments: RawSalesPaymentRow[];
  menuItems: RawSalesMenuItemRow[];
}

const num = (v: number | null | undefined): number => (typeof v === "number" ? v : 0);
const orNull = (v: string | null | undefined): string | null => (v ? v : null);

/** "" means "no member" in ESB's response; normalize to null everywhere downstream. */
const normalizeMemberCode = (v: string | null | undefined): string | null =>
  v && v.trim() !== "" ? v : null;

export function transformSalesRecords(records: EsbSalesRecord[]): TransformedBatch {
  const outlets = new Map<string, OutletRow>();
  // Keyed maps, not plain arrays: a single Postgres upsert() call can't
  // affect the same conflict-target row twice ("ON CONFLICT DO UPDATE
  // command cannot affect row a second time"), and if the same salesNum/
  // payment ever appears twice in one fetch (e.g. a retried page), the later
  // occurrence should simply overwrite rather than collide.
  const sales = new Map<string, RawSaleRow>();
  const payments = new Map<string, RawSalesPaymentRow>();
  const menuItems = new Map<string, RawSalesMenuItemRow>();
  const syncedAt = new Date().toISOString();

  for (const r of records) {
    if (!outlets.has(r.branchCode)) {
      outlets.set(r.branchCode, {
        branch_code: r.branchCode,
        branch_name: r.branchName ?? r.branchCode,
        ext_branch_code: orNull(r.extBranchCode),
      });
    }

    sales.set(r.salesNum, {
      sales_num: r.salesNum,
      bill_num: orNull(r.billNum),
      sales_date: r.salesDate,
      sales_date_in: orNull(r.salesDateIn),
      sales_date_out: orNull(r.salesDateOut),
      branch_code: r.branchCode,
      branch_name: orNull(r.branchName),
      ext_branch_code: orNull(r.extBranchCode),
      member_code: normalizeMemberCode(r.memberCode),
      member_name: orNull(r.memberName),
      external_member_code: orNull(r.externalMemberCode),
      table_id: orNull(r.tableID),
      table_name: orNull(r.tableName),
      visit_purpose_id: orNull(r.visitPurposeID),
      visit_purpose_name: orNull(r.visitPurposeName),
      visitor_type_id: orNull(r.visitorTypeID),
      visitor_type_name: orNull(r.visitorTypeName),
      pax_total: r.paxTotal != null ? Number(r.paxTotal) : null,
      subtotal: num(r.subtotal),
      discount_total: num(r.discountTotal),
      menu_discount_total: num(r.menuDiscountTotal),
      promotion_discount: num(r.promotionDiscount),
      voucher_discount_total: num(r.voucherDiscountTotal),
      other_tax_total: num(r.otherTaxTotal),
      vat_total: num(r.vatTotal),
      other_vat_total: num(r.otherVatTotal),
      delivery_cost: num(r.deliveryCost),
      order_fee: num(r.orderFee),
      grand_total: num(r.grandTotal),
      voucher_total: num(r.voucherTotal),
      rounding_total: num(r.roundingTotal),
      payment_total: num(r.paymentTotal),
      billing_print_count: r.billingPrintCount ?? null,
      payment_print_count: r.paymentPrintCount ?? null,
      additional_info: orNull(r.additionalInfo),
      promotion_id: orNull(r.promotionID),
      promotion_name: orNull(r.promotionName),
      flag_inclusive: orNull(r.flagInclusive),
      status_id: orNull(r.statusID),
      status_name: orNull(r.statusName),
      full_name: orNull(r.fullName),
      email: orNull(r.email),
      phone_number: orNull(r.phoneNumber),
      created_by: orNull(r.createdBy),
      edited_by: orNull(r.editedBy),
      edited_date: orNull(r.editedDate),
      parent_link_sales_num: orNull(r.parentLinkSalesNum),
      child_link_sales_num: r.childLinkSalesNum ?? [],
      merge_table: r.mergeTable ?? [],
      raw: r,
      synced_at: syncedAt,
    });

    for (const p of r.salesPayments ?? []) {
      // Keep-last on collision -- unlike menu items, duplicate payment rows
      // aren't a "same thing counted twice" case worth summing; if the
      // source ever repeats a backend ID, treat the latest as authoritative.
      const key = `${r.salesNum}|${p.salesPaymentBackendID}`;
      payments.set(key, {
        sales_num: r.salesNum,
        sales_payment_backend_id: p.salesPaymentBackendID,
        sales_payment_pos_id: orNull(p.salesPaymentPosID),
        payment_method_type_id: orNull(p.paymentMethodTypeID),
        payment_method_type_name: orNull(p.paymentMethodTypeName),
        payment_method_id: orNull(p.paymentMethodID),
        payment_method_name: orNull(p.paymentMethodName),
        voucher_code: orNull(p.voucherCode),
        card_number: orNull(p.cardNumber),
        bank_name: orNull(p.bankName),
        account_name: orNull(p.accountName),
        payment_amount: num(p.paymentAmount),
        full_payment_amount: num(p.fullPaymentAmount),
      });
    }

    (r.salesMenus ?? []).forEach((m, lineSeq) => {
      const key = `${r.salesNum}|${lineSeq}`;
      menuItems.set(key, {
        sales_num: r.salesNum,
        line_seq: lineSeq,
        menu_id: m.menuID,
        batch_id: m.batchID,
        sales_date: m.salesDate ?? r.salesDate,
        branch_code: m.branchCode ?? r.branchCode,
        menu_category_id: orNull(m.menuCategoryID),
        menu_category_name: orNull(m.menuCategoryName),
        menu_category_detail_id: orNull(m.menuCategoryDetailID),
        menu_category_detail_name: orNull(m.menuCategoryDetailName),
        menu_name: orNull(m.menuName),
        menu_code: orNull(m.menuCode),
        qty: num(m.qty),
        original_price: m.originalPrice ?? null,
        price: m.price ?? null,
        discount: m.discount ?? null,
        discount_value: m.discountValue ?? null,
        other_tax_value: m.otherTaxValue ?? null,
        vat_value: m.vatValue ?? null,
        total: num(m.total),
        notes: orNull(m.notes),
        status_id: orNull(m.statusID),
        status_name: orNull(m.statusName),
        promotion_detail_id: orNull(m.promotionDetailID),
        menu_promotion_id: orNull(m.menuPromotionID),
        sales_type: orNull(m.salesType),
        packages: m.packages ?? [],
        extras: m.extras ?? [],
      });
    });
  }

  return {
    outlets: [...outlets.values()],
    sales: [...sales.values()],
    payments: [...payments.values()],
    menuItems: [...menuItems.values()],
  };
}
