import type { AttachmentMeta, MailTokenSet, ScanAuditEntry, ScanRangePreset } from "@/lib/types";
import { matchesRetailerDomain } from "@/lib/retailers";

type MessageListItem = { id: string; threadId: string };
type MessageHeader = { name: string; value: string };

type GmailPayload = {
  mimeType?: string;
  headers?: MessageHeader[];
  filename?: string;
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPayload[];
};

type GmailThreadMessage = {
  id: string;
  labelIds?: string[];
  snippet?: string;
  payload?: {
    headers?: MessageHeader[];
  };
};

export type MessageIntent = "purchase" | "shipping" | "return" | "refund" | "promotional" | "unknown";

export type StructuredOrderItem = {
  name: string;
  sku?: string;
  price?: number;
  currency?: string;
  quantity?: number;
  color?: string;
  size?: string;
  imageUrl?: string;
  productUrl?: string;
};

export type StructuredOrderData = {
  orderNumber?: string;
  merchant?: string;
  totalPrice?: number;
  currency?: string;
  items: StructuredOrderItem[];
  source: "schema_org_jsonld";
};

type ProductImage = {
  url: string;
  alt?: string;
};

export type ParsedGmailMessage = {
  id: string;
  threadId: string;
  labelIds: string[];
  subject: string;
  from: string;
  date?: string;
  bodyText: string;
  bodyHtml: string;
  intent: Exclude<MessageIntent, "promotional" | "unknown">;
  threadResolvedIntent?: Exclude<MessageIntent, "promotional" | "unknown">;
  productImages: ProductImage[];
  structuredOrder?: StructuredOrderData;
  orderNumber?: string;
  attachments: AttachmentMeta[];
};

export type PurchaseScanResult = {
  totalScanned: number;
  matchedMessages: ParsedGmailMessage[];
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
  audit: ScanAuditEntry[];
};

export type ScanWindow = {
  rangePreset: ScanRangePreset;
  customFrom?: string;
  customTo?: string;
  maxEmails?: number;
};

type Classification = {
  intent: MessageIntent;
  transactional: boolean;
};

const apparelKeywordPattern = /(shirt|t-shirt|tee|hoodie|sweater|jacket|coat|pant|trouser|jeans|shorts|skirt|dress|shoe|sneaker|boot|bag|cap|belt|sock|loafer)/i;
const purchasePattern = /(order confirmation|order #|order number|receipt|items? ordered|purchase confirmation|thank you for your order|your order has been placed)/i;
const shippingPattern = /(shipped|shipment|in transit|out for delivery|tracking|arriving|delivery update|on the way)/i;
const returnPattern = /(return started|return initiated|return received|return complete|drop off your return|return confirmation|return request|return approved|return label|your return|we('ve| have) received your return|exchange (confirmed|processed|approved))/i;
const refundPattern = /(refund processed|refund issued|refund complete|we refunded|amount refunded|your refund is on the way|refund confirmed|credit applied|credit issued|refund to your|money back)/i;
const promoPattern = /(sale|% off|extra off|shop now|new arrivals?|just dropped|lookbook|gift guide|exclusive offer|flash sale|ends tonight|limited time|member days|promo code|black friday|cyber monday|style edit|you might also like|recommended for you|complete the look|trending now|best sellers?|shop the collection|shop the look|editors? picks?|new season|last chance|final sale)/i;

async function gmailFetch<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gmail API failed: ${response.status} ${text}`);
  }

  return (await response.json()) as T;
}

function decodeBase64Url(input: string): string {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  return Buffer.from(base64 + pad, "base64").toString("utf-8");
}

function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function collectBodies(payload: GmailPayload | undefined, collector: { html: string[]; text: string[] }) {
  if (!payload) return;

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    collector.text.push(decodeBase64Url(payload.body.data));
  }

  if (payload.mimeType === "text/html" && payload.body?.data) {
    collector.html.push(decodeBase64Url(payload.body.data));
  }

  for (const part of payload.parts ?? []) {
    collectBodies(part, collector);
  }
}

function collectAttachments(payload: GmailPayload | undefined): AttachmentMeta[] {
  const attachments: AttachmentMeta[] = [];

  function walk(part: GmailPayload) {
    if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType ?? "application/octet-stream",
        size: part.body.size ?? 0
      });
    }
    for (const child of part.parts ?? []) {
      walk(child);
    }
  }

  if (payload) walk(payload);
  return attachments;
}

function cleanText(input: string): string {
  return decodeEntities(input)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getHeader(headers: MessageHeader[] | undefined, key: string): string {
  const header = headers?.find((h) => h.name.toLowerCase() === key.toLowerCase());
  return header?.value ?? "";
}

function getDomain(fromHeader: string): string {
  const emailMatch = fromHeader.match(/<([^>]+)>/);
  const fallbackMatch = fromHeader.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
  const email = emailMatch?.[1] ?? fallbackMatch?.[0] ?? "";
  return email.split("@")[1]?.toLowerCase() ?? "";
}

function getRangeDays(preset: ScanRangePreset): number {
  if (preset === "3m") return 90;
  if (preset === "6m") return 180;
  if (preset === "12m") return 365;
  if (preset === "24m") return 730;
  return 1825;
}

function formatGmailDate(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd}`;
}

function parseDateInput(input?: string): Date | undefined {
  if (!input) return undefined;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function getRangeLabel(preset: ScanRangePreset, customFrom?: string, customTo?: string): string {
  if (preset === "3m") return "Last 3 months";
  if (preset === "6m") return "Last 6 months";
  if (preset === "12m") return "Last 12 months";
  if (preset === "24m") return "Last 24 months";
  if (preset === "5y") return "Last 5 years";

  const from = customFrom ?? "start";
  const to = customTo ?? "today";
  return `Custom (${from} to ${to})`;
}

function buildTimeframeClause(window: ScanWindow): { clause: string; label: string } {
  const label = getRangeLabel(window.rangePreset, window.customFrom, window.customTo);

  if (window.rangePreset !== "custom") {
    return {
      clause: `newer_than:${getRangeDays(window.rangePreset)}d`,
      label
    };
  }

  const from = parseDateInput(window.customFrom);
  const to = parseDateInput(window.customTo);

  const clauses: string[] = [];
  if (from) clauses.push(`after:${formatGmailDate(from)}`);
  if (to) clauses.push(`before:${formatGmailDate(addDays(to, 1))}`);

  if (clauses.length === 0) {
    return {
      clause: `newer_than:${getRangeDays("12m")}d`,
      label: "Last 12 months"
    };
  }

  return {
    clause: clauses.join(" "),
    label
  };
}

function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string") return decodeEntities(value.trim());
  if (typeof value === "number") return String(value);
  return undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^0-9.\-]/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function hasType(node: Record<string, unknown>, typeName: string): boolean {
  const raw = node["@type"];
  const types = toArray(raw).map((value) => String(value).toLowerCase());
  return types.some((value) => value === typeName.toLowerCase() || value.endsWith(typeName.toLowerCase()));
}

function pickImageUrl(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const url = pickImageUrl(entry);
      if (url) return url;
    }
    return undefined;
  }
  if (typeof value === "object") {
    const node = value as Record<string, unknown>;
    return asString(node.url) ?? asString(node.contentUrl) ?? asString(node["@id"]);
  }
  return undefined;
}

function parseStructuredOffer(offer: Record<string, unknown>): StructuredOrderItem | null {
  const offered = (offer.itemOffered as Record<string, unknown> | undefined) ?? (offer.orderedItem as Record<string, unknown> | undefined);
  const nestedOffer = (offered?.offers as Record<string, unknown> | undefined) ?? undefined;

  const name = asString(offered?.name) ?? asString(offer.name);
  if (!name || name.length < 2 || name.length > 140) return null;

  const price = asNumber(offer.price) ?? asNumber((offer.priceSpecification as Record<string, unknown> | undefined)?.price) ?? asNumber(nestedOffer?.price);
  const currency = asString(offer.priceCurrency) ?? asString((offer.priceSpecification as Record<string, unknown> | undefined)?.priceCurrency) ?? asString(nestedOffer?.priceCurrency);
  const quantity = asNumber((offer.eligibleQuantity as Record<string, unknown> | undefined)?.value) ?? asNumber(offer.quantity) ?? asNumber(offered?.quantity);

  return {
    name,
    sku: asString(offered?.sku) ?? asString(offer.sku),
    price,
    currency,
    quantity,
    color: asString(offered?.color) ?? asString(offer.color),
    size: asString(offered?.size) ?? asString(offer.size),
    imageUrl: pickImageUrl(offered?.image) ?? pickImageUrl(offer.image),
    productUrl: asString(offered?.url) ?? asString(offer.url)
  };
}

function parseOrderNode(node: Record<string, unknown>): StructuredOrderData | null {
  if (!hasType(node, "Order")) return null;

  const merchantNode = (node.seller as Record<string, unknown> | undefined) ?? (node.merchant as Record<string, unknown> | undefined);
  const currency = asString(node.priceCurrency) ?? asString(node.totalPriceCurrency);
  const totalPrice = asNumber(node.price) ?? asNumber(node.totalPrice);

  const itemCandidates: Record<string, unknown>[] = [];
  const acceptedOffer = toArray(node.acceptedOffer as unknown);
  const orderedItem = toArray(node.orderedItem as unknown);

  for (const entry of [...acceptedOffer, ...orderedItem]) {
    if (entry && typeof entry === "object") {
      itemCandidates.push(entry as Record<string, unknown>);
    }
  }

  const items: StructuredOrderItem[] = [];
  const seen = new Set<string>();

  for (const candidate of itemCandidates) {
    const parsed = parseStructuredOffer(candidate);
    if (!parsed) continue;
    const key = `${parsed.name.toLowerCase()}|${parsed.sku ?? ""}|${parsed.price ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(parsed);
  }

  if (items.length === 0) return null;

  return {
    orderNumber: asString(node.orderNumber) ?? asString(node.confirmationNumber) ?? asString(node.orderId),
    merchant: asString(merchantNode?.name),
    totalPrice,
    currency,
    items,
    source: "schema_org_jsonld"
  };
}

function parseSchemaOrgOrders(html: string): StructuredOrderData[] {
  const orders: StructuredOrderData[] = [];
  const scripts = Array.from(html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi));

  for (const scriptMatch of scripts) {
    const raw = decodeEntities(scriptMatch[1]).trim();
    if (!raw) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    const stack: unknown[] = [parsed];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;

      if (Array.isArray(current)) {
        for (const entry of current) stack.push(entry);
        continue;
      }

      if (typeof current !== "object") continue;
      const node = current as Record<string, unknown>;

      const order = parseOrderNode(node);
      if (order) orders.push(order);

      for (const value of Object.values(node)) {
        if (value && (typeof value === "object" || Array.isArray(value))) {
          stack.push(value);
        }
      }
    }
  }

  return orders;
}

function scoreClassification(params: {
  fromDomain: string;
  subject: string;
  bodyText: string;
  listUnsubscribe: string;
  labelIds: string[];
  hasStructuredOrder: boolean;
  hasOrderNumber: boolean;
}): Classification {
  const text = `${params.subject}\n${params.bodyText}`.toLowerCase();
  const apparelSignal = apparelKeywordPattern.test(text);
  const marketplaceDomain = /(amazon\.|target\.|macys\.|bloomingdales\.|saksfifthavenue\.|shop\.app)/.test(params.fromDomain);

  let transactionalScore = 0;
  let promoScore = 0;

  const labels = new Set(params.labelIds.map((label) => label.toUpperCase()));
  if (labels.has("CATEGORY_UPDATES") || labels.has("CATEGORY_PURCHASES")) transactionalScore += 4;
  if (labels.has("CATEGORY_PROMOTIONS")) promoScore += 3;
  if (params.hasStructuredOrder) transactionalScore += 8;
  if (params.hasOrderNumber) transactionalScore += 4;

  if (purchasePattern.test(text)) transactionalScore += 4;
  if (shippingPattern.test(text)) transactionalScore += 4;
  if (returnPattern.test(text)) transactionalScore += 4;
  if (refundPattern.test(text)) transactionalScore += 4;
  if (/\b(total|subtotal|payment method|billing address|order date)\b/.test(text)) transactionalScore += 2;
  if (apparelSignal) transactionalScore += 2;
  if (marketplaceDomain && !apparelSignal && !params.hasStructuredOrder) transactionalScore -= 4;

  if (promoPattern.test(text)) promoScore += 4;
  if (params.listUnsubscribe.trim().length > 0) promoScore += 1;
  // Known-retailer promos without order signals get extra promo weight
  if (promoPattern.test(text) && !params.hasOrderNumber && !params.hasStructuredOrder) {
    promoScore += 3;
  }

  const hasRefund = refundPattern.test(text);
  const hasReturn = returnPattern.test(text);
  const hasShipping = shippingPattern.test(text);
  const hasPurchase = purchasePattern.test(text) || params.hasStructuredOrder || params.hasOrderNumber;

  let intent: MessageIntent = "unknown";
  if (hasRefund) intent = "refund";
  else if (hasReturn) intent = "return";
  else if (hasShipping) intent = "shipping";
  else if (hasPurchase) intent = "purchase";
  else if (promoScore > transactionalScore) intent = "promotional";

  const transactional = (intent === "purchase" || intent === "shipping" || intent === "return" || intent === "refund")
    && transactionalScore >= Math.max(params.hasOrderNumber ? 3 : 5, promoScore);

  if (!transactional && promoScore >= transactionalScore + 1) {
    return { intent: "promotional", transactional: false };
  }

  if (transactional) {
    return { intent: intent as Exclude<MessageIntent, "promotional" | "unknown">, transactional: true };
  }

  return { intent: "unknown", transactional: false };
}

function inferOrderNumberFromText(text: string): string | undefined {
  const patterns = [
    /order(?:\s+number|\s*#)?\s*[:#-]?\s*([A-Z0-9-]{5,})/i,
    /(?:confirmation|receipt)\s*[:#-]?\s*([A-Z0-9-]{5,})/i,
    /#([A-Z0-9-]{5,})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

function parseAttribute(tag: string, name: string): string | undefined {
  const quoted = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  if (quoted?.[1]) return decodeEntities(quoted[1]);
  const plain = tag.match(new RegExp(`${name}\\s*=\\s*([^\\s>]+)`, "i"));
  if (plain?.[1]) return decodeEntities(plain[1]);
  return undefined;
}

function extractNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const match = value.match(/[0-9]{2,4}/);
  return match ? Number.parseInt(match[0], 10) : undefined;
}

function scoreProductImageCandidate(params: {
  src: string;
  alt: string;
  context: string;
  width?: number;
  height?: number;
}): number {
  const lower = `${params.src} ${params.alt} ${params.context}`.toLowerCase();
  let score = 0;

  if (apparelKeywordPattern.test(lower)) score += 3;
  if (/\b(product|item|style|sku|size|color|qty|order details|your order|item details)\b/.test(lower)) score += 2;
  if (/(\/products?\/|\/pdp\/|\/catalog\/|\/item\/|\/prod\/|images\.asos-media|cdn\.shopify)/.test(params.src.toLowerCase())) score += 2;

  if (/(logo|brandmark|wordmark|icon|social|facebook|instagram|tiktok|footer|header|tracking|pixel|spacer|sprite)/.test(lower)) score -= 7;
  if (/(banner|hero|newsletter|sale|% off|shop now|new arrivals|gift guide|lookbook|you might also like|recommended|trending|best seller|complete the look|featured|editorial|style pick|shop the look)/.test(lower)) score -= 5;

  if (params.width && params.height) {
    if (params.width < 80 || params.height < 80) score -= 4;
    if (params.width >= 120 && params.height >= 120) score += 2;

    const ratio = params.width / Math.max(1, params.height);
    if (ratio > 3.2 && params.height < 200) score -= 3;
    if (ratio < 0.25 || ratio > 4.2) score -= 2;
  }

  if (params.alt.length > 0 && params.alt.length < 90 && apparelKeywordPattern.test(params.alt)) score += 2;

  return score;
}

function extractProductImages(html: string, structuredOrders: StructuredOrderData[]): ProductImage[] {
  const schemaImages: ProductImage[] = structuredOrders
    .flatMap((order) => order.items)
    .filter((item) => typeof item.imageUrl === "string" && item.imageUrl.length > 0)
    .map((item) => ({
      url: item.imageUrl as string,
      alt: item.name || undefined
    }));

  const candidates: Array<ProductImage & { score: number }> = schemaImages.map((image) => ({ ...image, score: 10 }));

  const regex = /<img\b[^>]*>/gi;
  let match = regex.exec(html);

  while (match) {
    const tag = match[0];
    const idx = match.index;
    const src = parseAttribute(tag, "src") ?? "";
    const alt = parseAttribute(tag, "alt") ?? "";
    const width = extractNumber(parseAttribute(tag, "width"));
    const height = extractNumber(parseAttribute(tag, "height"));

    if ((src.startsWith("http://") || src.startsWith("https://")) && !src.startsWith("data:")) {
      const context = decodeEntities(html.slice(Math.max(0, idx - 260), Math.min(html.length, idx + tag.length + 260))).toLowerCase();
      const score = scoreProductImageCandidate({ src, alt, context, width, height });
      candidates.push({ url: src.replace(/&amp;/g, "&"), alt: alt || undefined, score });
    }

    match = regex.exec(html);
  }

  const deduped = new Map<string, ProductImage & { score: number }>();
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    if (!deduped.has(candidate.url)) deduped.set(candidate.url, candidate);
  }

  const ordered = Array.from(deduped.values()).sort((a, b) => b.score - a.score);
  const strong = ordered.filter((item) => item.score >= 2);
  return strong.slice(0, 8).map((item) => ({ url: item.url, alt: item.alt }));
}

function pickBestStructuredOrder(orders: StructuredOrderData[]): StructuredOrderData | undefined {
  if (orders.length === 0) return undefined;
  return [...orders].sort((a, b) => b.items.length - a.items.length)[0];
}

function resolveFinalIntent(intents: Array<Exclude<MessageIntent, "promotional" | "unknown">>): Exclude<MessageIntent, "promotional" | "unknown"> {
  if (intents.includes("refund")) return "refund";
  if (intents.includes("return")) return "return";
  if (intents.includes("shipping")) return "shipping";
  return "purchase";
}

async function resolveThreadIntents(
  tokenSet: MailTokenSet,
  messages: ParsedGmailMessage[]
): Promise<{ threadsAnalyzed: number; messages: ParsedGmailMessage[] }> {
  const byThread = new Map<string, ParsedGmailMessage[]>();
  for (const message of messages) {
    const group = byThread.get(message.threadId) ?? [];
    group.push(message);
    byThread.set(message.threadId, group);
  }

  for (const [threadId, threadMessages] of byThread.entries()) {
    const fallbackIntents = threadMessages.map((message) => message.intent);
    let resolved = resolveFinalIntent(fallbackIntents);

    try {
      const thread = await gmailFetch<{ id: string; messages?: GmailThreadMessage[] }>(
        tokenSet.accessToken,
        `threads/${threadId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=List-Unsubscribe`
      );

      const threadIntents: Array<Exclude<MessageIntent, "promotional" | "unknown">> = [];

      for (const msg of thread.messages ?? []) {
        const subject = getHeader(msg.payload?.headers, "Subject");
        const listUnsubscribe = getHeader(msg.payload?.headers, "List-Unsubscribe");
        const classification = scoreClassification({
          fromDomain: "",
          subject,
          bodyText: msg.snippet ?? "",
          listUnsubscribe,
          labelIds: msg.labelIds ?? [],
          hasStructuredOrder: false,
          hasOrderNumber: Boolean(inferOrderNumberFromText(`${subject} ${msg.snippet ?? ""}`))
        });

        if (classification.transactional) {
          threadIntents.push(classification.intent as Exclude<MessageIntent, "promotional" | "unknown">);
        }
      }

      if (threadIntents.length > 0) {
        resolved = resolveFinalIntent(threadIntents);
      }
    } catch {
      resolved = resolveFinalIntent(fallbackIntents);
    }

    for (const message of threadMessages) {
      message.threadResolvedIntent = resolved;
    }
  }

  return {
    threadsAnalyzed: byThread.size,
    messages
  };
}

async function searchMessageIds(tokenSet: MailTokenSet, query: string, maxEmails: number): Promise<string[]> {
  const ids: string[] = [];
  let nextPageToken: string | undefined;

  while (ids.length < maxEmails) {
    const listPath = `messages?q=${encodeURIComponent(query)}&maxResults=${Math.min(100, maxEmails - ids.length)}${
      nextPageToken ? `&pageToken=${encodeURIComponent(nextPageToken)}` : ""
    }`;

    const list = await gmailFetch<{ messages?: MessageListItem[]; nextPageToken?: string }>(tokenSet.accessToken, listPath);
    const newIds = (list.messages ?? []).map((m) => m.id);
    if (newIds.length === 0) break;

    ids.push(...newIds);
    nextPageToken = list.nextPageToken;
    if (!nextPageToken) break;
  }

  return ids;
}

export async function getConnectedEmail(tokenSet: MailTokenSet): Promise<string> {
  const profile = await gmailFetch<{ emailAddress: string }>(tokenSet.accessToken, "profile");
  return profile.emailAddress;
}

export async function fetchPurchaseMessages(tokenSet: MailTokenSet, window: ScanWindow): Promise<PurchaseScanResult> {
  const maxEmails = Math.min(window.maxEmails ?? 350, 700);
  const { clause: timeframeClause, label: rangeLabel } = buildTimeframeClause(window);

  const purchaseQuery = [
    "-in:chats",
    timeframeClause,
    "category:purchases"
  ].join(" ");

  const updatesFallbackQuery = [
    "-in:chats",
    timeframeClause,
    "category:updates",
    "(subject:(order OR receipt OR confirmation OR shipped OR shipping OR delivered OR return OR refund OR tracking) OR \"order #\")"
  ].join(" ");

  const purchaseIds = await searchMessageIds(tokenSet, purchaseQuery, maxEmails);
  const ids = [...purchaseIds];

  const fallbackThreshold = Math.min(120, Math.floor(maxEmails * 0.45));
  if (ids.length < fallbackThreshold) {
    const remaining = maxEmails - ids.length;
    const fallbackIds = await searchMessageIds(tokenSet, updatesFallbackQuery, remaining);
    for (const fallbackId of fallbackIds) {
      if (!ids.includes(fallbackId)) ids.push(fallbackId);
    }
  }

  const intentBreakdown = {
    purchase: 0,
    shipping: 0,
    return: 0,
    refund: 0
  };

  let excludedPromotional = 0;
  let excludedUnknown = 0;
  let schemaEmails = 0;
  let schemaItems = 0;
  const messages: ParsedGmailMessage[] = [];
  const audit: ScanAuditEntry[] = [];

  for (const id of ids) {
    const full = await gmailFetch<{ id: string; threadId: string; labelIds?: string[]; payload: GmailPayload; snippet?: string }>(
      tokenSet.accessToken,
      `messages/${id}?format=full`
    );

    const headers = full.payload?.headers;
    const from = getHeader(headers, "From");
    const subject = getHeader(headers, "Subject");
    const date = getHeader(headers, "Date");
    const listUnsubscribe = getHeader(headers, "List-Unsubscribe");
    const labelIds = full.labelIds ?? [];

    const fromDomain = getDomain(from);
    const fromMatchesRetailer = matchesRetailerDomain(fromDomain);

    const collector = { html: [] as string[], text: [] as string[] };
    collectBodies(full.payload, collector);
    const textBody = collector.text.join("\n");
    const htmlBody = collector.html.join("\n");
    const bodyText = textBody || cleanText(htmlBody) || full.snippet || "";

    const structuredOrders = parseSchemaOrgOrders(htmlBody);
    const bestStructuredOrder = pickBestStructuredOrder(structuredOrders);
    const inferredOrderNumber = bestStructuredOrder?.orderNumber ?? inferOrderNumberFromText(`${subject}\n${bodyText.slice(0, 6000)}`);
    if (bestStructuredOrder) {
      schemaEmails += 1;
      schemaItems += bestStructuredOrder.items.length;
    }

    const hasStrongTransactionalSignal = Boolean(bestStructuredOrder) || Boolean(inferredOrderNumber);

    if (!fromMatchesRetailer && !hasStrongTransactionalSignal) {
      audit.push({
        messageId: full.id,
        threadId: full.threadId,
        from,
        fromDomain,
        subject,
        labelIds,
        matchedRetailerDomain: false,
        hasOrderNumber: false,
        hasStructuredOrder: false,
        structuredItemCount: 0,
        classification: "excluded_before_classification",
        included: false,
        reason: "unknown_domain_no_transaction_signal"
      });
      continue;
    }

    const attachments = collectAttachments(full.payload);

    const classification = scoreClassification({
      fromDomain,
      subject,
      bodyText: bodyText.slice(0, 8000),
      listUnsubscribe,
      labelIds,
      hasStructuredOrder: Boolean(bestStructuredOrder),
      hasOrderNumber: Boolean(inferredOrderNumber)
    });

    if (!classification.transactional) {
      if (classification.intent === "promotional") excludedPromotional += 1;
      else excludedUnknown += 1;

      audit.push({
        messageId: full.id,
        threadId: full.threadId,
        from,
        fromDomain,
        subject,
        labelIds,
        matchedRetailerDomain: true,
        hasOrderNumber: Boolean(inferredOrderNumber),
        hasStructuredOrder: Boolean(bestStructuredOrder),
        structuredItemCount: bestStructuredOrder?.items.length ?? 0,
        classification: classification.intent,
        included: false,
        reason: classification.intent === "promotional" ? "classified_promotional" : "insufficient_transaction_signal"
      });
      continue;
    }

    if (classification.intent === "purchase") intentBreakdown.purchase += 1;
    if (classification.intent === "shipping") intentBreakdown.shipping += 1;
    if (classification.intent === "return") intentBreakdown.return += 1;
    if (classification.intent === "refund") intentBreakdown.refund += 1;

    const productImages = extractProductImages(htmlBody, structuredOrders);

    messages.push({
      id: full.id,
      threadId: full.threadId,
      labelIds,
      subject,
      from,
      date,
      bodyText,
      bodyHtml: htmlBody,
      intent: classification.intent as Exclude<MessageIntent, "promotional" | "unknown">,
      productImages,
      structuredOrder: bestStructuredOrder,
      orderNumber: inferredOrderNumber,
      attachments
    });

    audit.push({
      messageId: full.id,
      threadId: full.threadId,
      from,
      fromDomain,
      subject,
      labelIds,
      matchedRetailerDomain: true,
      hasOrderNumber: Boolean(inferredOrderNumber),
      hasStructuredOrder: Boolean(bestStructuredOrder),
      structuredItemCount: bestStructuredOrder?.items.length ?? 0,
      classification: classification.intent,
      included: true,
      reason: "transactional_kept"
    });
  }

  const resolved = await resolveThreadIntents(tokenSet, messages);

  return {
    totalScanned: ids.length,
    matchedMessages: resolved.messages,
    rangeLabel,
    queryDescription: "Purchases-first scan (category:purchases), with smart updates fallback only when needed. Schema-first extraction + thread-level status resolution.",
    candidateEmails: ids.length,
    transactionalEmails: messages.length,
    excludedPromotional,
    excludedUnknown,
    schemaEmails,
    schemaItems,
    threadsAnalyzed: resolved.threadsAnalyzed,
    intentBreakdown,
    audit
  };
}
