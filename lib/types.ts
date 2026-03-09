export type MailTokenSet = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
};

export type ScanStatus = "purchased" | "in_transit" | "returned";

export type ScanRangePreset = "3m" | "6m" | "12m" | "24m" | "5y" | "custom";

export type ScanRequest = {
  rangePreset: ScanRangePreset;
  customFrom?: string;
  customTo?: string;
};

export type AttachmentMeta = {
  filename: string;
  mimeType: string;
  size: number;
};

export type WardrobeItem = {
  id: string;
  messageId: string;
  threadId?: string;
  name: string;
  brand: string;
  category: string;
  color?: string;
  size?: string;
  price?: number;
  currency?: string;
  quantity?: number;
  sku?: string;
  productUrl?: string;
  orderNumber?: string;
  orderJourney?: string;
  purchaseDate?: string;
  status: ScanStatus;
  sourceSubject?: string;
  sourceFrom?: string;
  imageUrl?: string;
  attachments?: AttachmentMeta[];
  extractionSource?: "schema_org" | "heuristic_text" | "image_alt" | "fallback_subject";
  confidence: number;
};

export type ScanSummary = {
  emailsScanned: number;
  emailsMatched: number;
  extractedItems: number;
  dedupedItems: number;
  totalSpend: number;
  uniqueBrands: number;
  returnedCount: number;
  inTransitCount: number;
};

export type ScanAuditEntry = {
  messageId: string;
  threadId?: string;
  from: string;
  fromDomain: string;
  subject: string;
  labelIds: string[];
  matchedRetailerDomain: boolean;
  hasOrderNumber: boolean;
  hasStructuredOrder: boolean;
  structuredItemCount: number;
  classification: string;
  included: boolean;
  reason: string;
};

export type ScanResponse = {
  logs: string[];
  summary: ScanSummary;
  items: WardrobeItem[];
  meta: {
    rangeLabel: string;
    queryDescription: string;
    candidateEmails: number;
    transactionalEmails: number;
    excludedPromotional: number;
    excludedUnknown: number;
    schemaEmails: number;
    schemaItems: number;
    threadsAnalyzed: number;
    intentBreakdown: {
      purchase: number;
      shipping: number;
      return: number;
      refund: number;
    };
  };
  diagnostics?: {
    audit: ScanAuditEntry[];
    extractedPreview: Array<{
      name: string;
      brand: string;
      status: ScanStatus;
      orderNumber?: string;
      price?: number;
      extractionSource?: WardrobeItem["extractionSource"];
    }>;
  };
};

export type SessionData = {
  id: string;
  oauthState?: string;
  tokens?: MailTokenSet;
  connectedEmail?: string;
  createdAt: number;
  updatedAt: number;
};
