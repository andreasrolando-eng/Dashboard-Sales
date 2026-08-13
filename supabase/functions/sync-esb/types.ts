// Shape mirrors the real ESB `get-sales-information` response body exactly
// (verified against a live sample), field-for-field. Do not "clean up" names
// to camelCase-vs-something-else without checking against a real response.

export interface EsbSalesPayment {
  salesPaymentBackendID: string;
  salesPaymentPosID?: string | null;
  paymentMethodTypeID?: string | null;
  paymentMethodTypeName?: string | null;
  paymentMethodID?: string | null;
  paymentMethodName?: string | null;
  voucherCode?: string | null;
  notes?: string | null;
  cardNumber?: string | null;
  bankName?: string | null;
  accountName?: string | null;
  selfOrderID?: string | null;
  verificationCode?: string | null;
  paymentAmount?: number | null;
  fullPaymentAmount?: number | null;
}

export interface EsbMenuModifier {
  menuID: string;
  menuName?: string | null;
  menuCode?: string | null;
  qty?: number | null;
  originalPrice?: number | null;
  price?: number | null;
  discount?: number | null;
  discountValue?: number | null;
  otherTax?: number | null;
  otherTaxValue?: number | null;
  vat?: number | null;
  vatValue?: number | null;
  otherVat?: number | null;
  otherVatValue?: number | null;
  total?: number | null;
  notes?: string | null;
  statusID?: string | null;
  statusName?: string | null;
}

export interface EsbSalesMenu {
  salesDate: string;
  branchCode: string;
  branchName?: string | null;
  salesNum: string;
  billNum?: string | null;
  batchID: string;
  menuCategoryID?: string | null;
  menuCategoryName?: string | null;
  menuCategoryDetailID?: string | null;
  menuCategoryDetailName?: string | null;
  menuID: string;
  menuName?: string | null;
  menuCode?: string | null;
  qty: number;
  originalPrice?: number | null;
  price?: number | null;
  discount?: number | null;
  discountValue?: number | null;
  otherTaxValue?: number | null;
  otherTax?: number | null;
  vat?: number | null;
  vatValue?: number | null;
  otherVat?: number | null;
  otherVatValue?: number | null;
  total?: number | null;
  notes?: string | null;
  statusID?: string | null;
  statusName?: string | null;
  promotionDetailID?: string | null;
  menuPromotionID?: string | null;
  salesType?: string | null;
  packages?: EsbMenuModifier[];
  extras?: EsbMenuModifier[];
}

export interface EsbSalesRecord {
  salesNum: string;
  billNum?: string | null;
  salesDate: string;
  salesDateIn?: string | null;
  salesDateOut?: string | null;
  branchCode: string;
  branchName?: string | null;
  extBranchCode?: string | null;
  memberCode?: string | null;
  memberName?: string | null;
  externalMemberCode?: string | null;
  tableID?: string | null;
  tableName?: string | null;
  visitPurposeID?: string | null;
  visitPurposeName?: string | null;
  visitorTypeID?: string | null;
  visitorTypeName?: string | null;
  paxTotal?: string | number | null;
  subtotal?: number | null;
  discountTotal?: number | null;
  menuDiscountTotal?: number | null;
  promotionDiscount?: number | null;
  voucherDiscountTotal?: number | null;
  otherTaxTotal?: number | null;
  vatTotal?: number | null;
  otherVatTotal?: number | null;
  deliveryCost?: number | null;
  orderFee?: number | null;
  grandTotal: number;
  voucherTotal?: number | null;
  roundingTotal?: number | null;
  paymentTotal?: number | null;
  billingPrintCount?: number | null;
  paymentPrintCount?: number | null;
  additionalInfo?: string | null;
  promotionID?: string | null;
  promotionName?: string | null;
  flagInclusive?: string | null;
  statusID?: string | null;
  statusName?: string | null;
  fullName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  createdBy?: string | null;
  editedBy?: string | null;
  editedDate?: string | null;
  salesPayments?: EsbSalesPayment[];
  salesMenus?: EsbSalesMenu[];
  parentLinkSalesNum?: string | null;
  childLinkSalesNum?: unknown[];
  mergeTable?: unknown[];
}

// x-pagination-* response headers, 20 records/page.
export interface EsbPagination {
  totalCount: number;
  pageCount: number;
  currentPage: number;
  perPage: number;
}

export interface EsbSalesPage {
  records: EsbSalesRecord[];
  pagination: EsbPagination;
}
