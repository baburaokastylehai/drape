import crypto from "crypto";
import { categoryKeywords, detectBrandFromEmail } from "@/lib/retailers";
import type { ParsedGmailMessage, StructuredOrderItem } from "@/lib/gmail";
import type { AttachmentMeta, WardrobeItem, ScanStatus } from "@/lib/types";

const colorWords = [
  "black", "white", "blue", "navy", "red", "green", "olive", "beige", "brown",
  "tan", "gray", "grey", "cream", "pink", "purple", "orange", "yellow", "charcoal",
  "ivory", "burgundy", "maroon", "khaki", "coral", "teal", "sage", "rust", "mustard"
];

const ignoreLinePatterns = [
  /subtotal/i, /sales tax/i, /tax\b/i, /shipping\s+(fee|cost|charge)/i,
  /gift card/i, /promo/i, /discount/i, /coupon/i, /payment/i,
  /visa/i, /mastercard/i, /amex/i, /customer service/i, /unsubscribe/i,
  /terms/i, /privacy/i, /barcode/i, /qr code/i, /survey/i, /auth code/i,
  /shop now/i, /shop all/i, /new arrivals?/i, /gift guide/i, /style edit/i,
  /extra\s+\d+%\s+off/i, /^view in browser/i, /^click here/i,
  /order number/i, /tracking number/i, /total\b/i, /billing address/i,
  /shipping address/i, /delivery address/i,
  /payment method/i, /estimated delivery/i,
  /you might also like/i, /recommended for you/i, /recommended/i,
  /complete the look/i, /customers also/i, /more from/i,
  /trending/i, /best sellers?/i, /similar styles/i,
  /we think you'?ll love/i, /pair it with/i, /browse more/i,
  /you may also like/i, /featured/i, /shop the/i,
  /keep.*in.*original/i, /care instructions/i,
  /do not (wash|iron|bleach|dry clean|tumble)/i,
  /washing instructions/i, /return policy/i, /return by/i,
  /need help/i, /contact us/i, /help center/i,
  /manage your order/i, /view your order/i,
  /^\s*[.#]/, // CSS selectors
];

const promoSectionPattern = /(?:you might also like|recommended for you|complete the look|customers also|more from this brand|trending now|best sellers|similar styles|we think you'?ll love|style picks|pair it with|you may also like|featured items|shop the look)/i;

type ParsedItem = {
  name: string;
  price?: number;
  size?: string;
  color?: string;
  quantity?: number;
  confidence: number;
  source: "heuristic_text" | "image_alt";
};

type OrderGroup = {
  key: string;
  brand: string;
  orderNumber?: string;
  messages: ParsedGmailMessage[];
};

function normalize(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function detectBrand(from: string, subject: string, body: string): string {
  return detectBrandFromEmail(from, subject, body.slice(0, 2000));
}

function detectCategory(text: string): string {
  const lower = text.toLowerCase();
  const match = categoryKeywords.find((entry) => entry.words.some((word) => lower.includes(word)));
  return match?.category ?? "Other";
}

function detectColor(text: string): string | undefined {
  const lower = text.toLowerCase();
  const color = colorWords.find((word) => lower.includes(word));
  return color ? color.charAt(0).toUpperCase() + color.slice(1) : undefined;
}

function detectSize(text: string): string | undefined {
  const match = text.match(/\b(XXS|XS|S|M|L|XL|XXL|XXXL|W\d{2}|L\d{2}|[0-9]{1,2}(?:\.[0-9])?)\b/i);
  return match?.[1]?.toUpperCase();
}

function parseDate(input?: string): string | undefined {
  if (!input) return undefined;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function parsePrices(text: string): number[] {
  const matches = text.match(/\$\s?([0-9]{1,4}(?:\.[0-9]{2})?)/g) ?? [];
  return matches
    .map((m) => Number.parseFloat(m.replace(/[^0-9.]/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 10000);
}

function isItemNoise(line: string): boolean {
  return ignoreLinePatterns.some((pattern) => pattern.test(line));
}

function sanitizeLine(line: string): string {
  return decodeEntities(line)
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/qty\s*:?\s*\d+/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Clean product name: strip quantity suffixes, bullets, brackets, etc. */
function cleanProductName(raw: string): string {
  return raw
    .replace(/\s*[×x]\s*\d+\s*$/i, "")           // "× 1" or "x 2" suffix
    .replace(/^\s*[\*•\-–]\s*/, "")                // leading bullet/asterisk
    .replace(/\s*\(pack of \d+\)\s*/i, "")         // "(Pack of 2)"
    .replace(/\s*\[\s*\d+\s*\]\s*/g, "")           // "[1]" index markers
    .replace(/\s*,\s*$/, "")                       // trailing comma
    .replace(/\s*-\s*$/, "")                       // trailing dash
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Reject names that are clearly not product names (CSS selectors, addresses, instructions) */
function isGarbageName(name: string): boolean {
  if (/^\s*[.#]\w/.test(name)) return true;                    // CSS selectors
  if (/shipping\s*address/i.test(name)) return true;
  if (/billing\s*address/i.test(name)) return true;
  if (/delivery\s*address/i.test(name)) return true;
  if (/keep.*in.*original/i.test(name)) return true;
  if (/care\s*instructions/i.test(name)) return true;
  if (/return\s*(policy|label|by)/i.test(name)) return true;
  if (/manage\s*your\s*order/i.test(name)) return true;
  if (/view\s*your\s*order/i.test(name)) return true;
  if (/contact\s*us/i.test(name)) return true;
  if (/need\s*help/i.test(name)) return true;
  if (/customer\s*service/i.test(name)) return true;
  if (/\.(section|main|container|wrapper|header|footer|body|content)\b/i.test(name)) return true; // CSS class patterns
  if (name.length < 3 || name.length > 120) return true;
  return false;
}

function isLikelyClothing(text: string): boolean {
  return /(shirt|tee|t-shirt|hoodie|sweater|jacket|coat|pant|trouser|jeans|shorts|skirt|dress|shoe|sneaker|boot|loafer|bag|cap|belt|sock|active|tank|denim|cargo|knitwear|overshirt|flannel|oxford|tailored|blazer|cardigan|pullover|jogger|legging|romper|jumpsuit|vest|parka|windbreaker|sandal|runner|heel|flat|mule|clog|beanie|scarf|glove|tote|backpack|purse|wallet|sunglasses|watch|polo|blouse|camisole|tunic|henley|crop|puffer|anorak)/i.test(text);
}

function inferOrderNumberFromText(text: string): string | undefined {
  const patterns = [
    /order(?:\s+number|\s*#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{4,})/i,
    /(?:confirmation|receipt)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{4,})/i,
    /#([A-Z0-9][A-Z0-9-]{4,})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].toUpperCase();
  }
  return undefined;
}

function extractAllOrderNumbers(text: string): string[] {
  const patterns = [
    /order(?:\s+number|\s*#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{4,})/gi,
    /(?:confirmation|receipt)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{4,})/gi,
    /\b#([A-Z0-9][A-Z0-9-]{4,})\b/gi
  ];

  const numbers = new Set<string>();
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) numbers.add(match[1].toUpperCase());
    }
  }
  return Array.from(numbers);
}

function messageOrderNumber(message: ParsedGmailMessage): string | undefined {
  if (message.orderNumber) return message.orderNumber.toUpperCase();
  return inferOrderNumberFromText(`${message.subject}\n${message.bodyText.slice(0, 6000)}`);
}

function parseLineItems(message: ParsedGmailMessage): ParsedItem[] {
  const source = decodeEntities(message.bodyText)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r/g, "\n");

  const lines = source
    .split(/\n|\|/)
    .map((line) => sanitizeLine(line))
    .filter((line) => line.length >= 2 && line.length <= 140);

  const items: ParsedItem[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || isItemNoise(line)) continue;

    // Stop parsing once we enter a promo recommendation section
    if (promoSectionPattern.test(line)) break;

    const clothingSignal = isLikelyClothing(line);
    if (!clothingSignal) continue;

    const cleaned = cleanProductName(
      line
        .replace(/^[\d\-\s]+/, "")
        .replace(/[;:,\-]+$/g, "")
        .replace(/\s{2,}/g, " ")
        .trim()
    );

    if (cleaned.length < 4 || cleaned.length > 90) continue;
    if (isItemNoise(cleaned) || isGarbageName(cleaned)) continue;

    const nearby = [line, lines[i + 1], lines[i + 2], lines[i + 3]].filter(Boolean).join(" ");
    const price = parsePrices(nearby)[0];
    const size = detectSize(nearby);
    const color = detectColor(nearby);
    const qtyMatch = nearby.match(/\bqty\s*:?\s*(\d+)/i) ?? nearby.match(/\bquantity\s*:?\s*(\d+)/i);
    const quantity = qtyMatch ? Number.parseInt(qtyMatch[1], 10) : undefined;

    items.push({
      name: cleaned,
      price,
      size,
      color,
      quantity,
      confidence: 0.83 + (price ? 0.06 : 0),
      source: "heuristic_text"
    });
  }

  const unique = new Map<string, ParsedItem>();
  for (const item of items) {
    const key = normalize(item.name);
    if (!unique.has(key) || (unique.get(key)?.confidence ?? 0) < item.confidence) {
      unique.set(key, item);
    }
  }

  return Array.from(unique.values()).slice(0, 16);
}

function parseItemsFromImageAlts(message: ParsedGmailMessage): ParsedItem[] {
  const items: ParsedItem[] = [];

  for (const image of message.productImages) {
    const alt = cleanProductName(sanitizeLine(image.alt ?? ""));
    if (alt.length < 5 || alt.length > 90) continue;
    if (isItemNoise(alt) || isGarbageName(alt)) continue;
    if (promoSectionPattern.test(alt)) continue;
    if (!isLikelyClothing(alt)) continue;

    items.push({
      name: alt,
      confidence: 0.72,
      source: "image_alt"
    });
  }

  const unique = new Map<string, ParsedItem>();
  for (const item of items) {
    const key = normalize(item.name);
    if (!unique.has(key)) unique.set(key, item);
  }

  return Array.from(unique.values());
}

function eventFromMessage(message: ParsedGmailMessage): "order_confirmed" | "in_transit" | "delivered" | "return_initiated" | "refund_completed" {
  const text = `${message.subject} ${message.bodyText.slice(0, 4000)}`.toLowerCase();
  const intent = message.threadResolvedIntent ?? message.intent;

  // Check intent first, then fall back to aggressive text matching
  if (intent === "refund") return "refund_completed";
  if (intent === "return") return "return_initiated";

  // Text-based return/refund detection (catches cases where intent wasn't classified correctly)
  if (/refund\s*(processed|issued|complete|confirmed|to your|of \$)/i.test(text)) return "refund_completed";
  if (/credit\s*(applied|issued|has been)/i.test(text)) return "refund_completed";
  if (/your\s*money\s*back/i.test(text)) return "refund_completed";
  if (/return\s*(started|initiated|received|complete|confirmed|approved|processed|label|request)/i.test(text)) return "return_initiated";
  if (/drop\s*off\s*your\s*return/i.test(text)) return "return_initiated";
  if (/we('ve| have)\s*received\s*your\s*return/i.test(text)) return "return_initiated";
  if (/exchange\s*(confirmed|processed|approved)/i.test(text)) return "return_initiated";

  if (/delivered|delivered\s+on|has been delivered|left at|signed by/i.test(text)) return "delivered";
  if (intent === "shipping") return "in_transit";
  if (/out for delivery|in transit|on the way|shipped/i.test(text) && intent !== "purchase") return "in_transit";
  return "order_confirmed";
}

function computeJourney(messages: ParsedGmailMessage[]): string[] {
  const sorted = [...messages].sort((a, b) => {
    const aTime = a.date ? new Date(a.date).getTime() : 0;
    const bTime = b.date ? new Date(b.date).getTime() : 0;
    return aTime - bTime;
  });

  const events = sorted.map(eventFromMessage);
  const compact: string[] = [];
  for (const event of events) {
    if (compact[compact.length - 1] !== event) compact.push(event);
  }
  return compact;
}

function statusFromJourney(journey: string[]): ScanStatus {
  if (journey.includes("refund_completed") || journey.includes("return_initiated")) return "returned";
  if (journey.includes("order_confirmed") || journey.includes("delivered")) return "purchased";
  if (journey.includes("in_transit")) return "in_transit";
  return "purchased";
}

function pickCanonicalMessage(messages: ParsedGmailMessage[]): ParsedGmailMessage {
  const schemaPurchase = messages.find((message) => (message.structuredOrder?.items.length ?? 0) > 0 && (message.intent === "purchase" || message.threadResolvedIntent === "purchase"));
  if (schemaPurchase) return schemaPurchase;

  const schemaAny = messages.find((message) => (message.structuredOrder?.items.length ?? 0) > 0);
  if (schemaAny) return schemaAny;

  const purchaseMessage = [...messages]
    .filter((message) => message.intent === "purchase" || message.threadResolvedIntent === "purchase")
    .sort((a, b) => b.bodyText.length - a.bodyText.length)[0];
  if (purchaseMessage) return purchaseMessage;

  return [...messages].sort((a, b) => b.bodyText.length - a.bodyText.length)[0];
}

/** Order-number-centric grouping: groups emails by order/confirmation number first,
 *  then falls back to thread grouping for messages without detectable order numbers. */
function groupByOrder(messages: ParsedGmailMessage[]): OrderGroup[] {
  const orderIndex = new Map<string, ParsedGmailMessage[]>();
  const noOrderMessages: ParsedGmailMessage[] = [];
  const messageOrderMap = new Map<string, string>(); // messageId -> orderNumber

  // Pass 1: extract order numbers from every message
  for (const message of messages) {
    const orderNum = messageOrderNumber(message);
    if (orderNum) {
      const key = orderNum.toUpperCase().trim();
      messageOrderMap.set(message.id, key);
      const existing = orderIndex.get(key) ?? [];
      existing.push(message);
      orderIndex.set(key, existing);
    } else {
      noOrderMessages.push(message);
    }
  }

  // Pass 2: for messages without a primary order number, scan their body for
  // any order numbers that match known ones from pass 1
  const stillUnmatched: ParsedGmailMessage[] = [];
  for (const message of noOrderMessages) {
    const bodyNumbers = extractAllOrderNumbers(`${message.subject}\n${message.bodyText.slice(0, 8000)}`);
    let matched = false;
    for (const num of bodyNumbers) {
      const key = num.toUpperCase().trim();
      if (orderIndex.has(key)) {
        orderIndex.get(key)!.push(message);
        messageOrderMap.set(message.id, key);
        matched = true;
        break;
      }
    }
    if (!matched) {
      stillUnmatched.push(message);
    }
  }

  // Build order groups
  const groups: OrderGroup[] = [];
  for (const [orderNum, msgs] of orderIndex) {
    const canonical = msgs[0];
    const brand = detectBrand(canonical.from, canonical.subject, canonical.bodyText);
    groups.push({
      key: `order|${normalize(brand)}|${orderNum}`,
      brand,
      orderNumber: orderNum,
      messages: msgs
    });
  }

  // Pass 3: group remaining by thread + brand
  const threadGroups = new Map<string, OrderGroup>();
  for (const message of stillUnmatched) {
    const brand = detectBrand(message.from, message.subject, message.bodyText);
    const key = `thread|${normalize(brand)}|${message.threadId}`;
    const existing = threadGroups.get(key);
    if (existing) {
      existing.messages.push(message);
    } else {
      threadGroups.set(key, { key, brand, messages: [message] });
    }
  }

  groups.push(...threadGroups.values());
  return groups;
}

/** Match an image to an item by comparing alt text words to item name words.
 *  Returns undefined if no meaningful match - NEVER falls back to unrelated images. */
function matchImageToItem(itemName: string, images: Array<{ url: string; alt?: string }>): string | undefined {
  if (images.length === 0) return undefined;

  const normName = normalize(itemName);
  const itemWords = new Set(
    normName
      .split(" ")
      .filter((w) => w.length > 2)
  );

  if (itemWords.size === 0) return undefined;

  let bestUrl: string | undefined;
  let bestScore = 0;

  for (const img of images) {
    const normAlt = normalize(img.alt ?? "");
    const altWords = normAlt.split(" ").filter((w) => w.length > 2);

    // Exact word overlap scoring
    let score = 0;
    for (const word of altWords) {
      if (itemWords.has(word)) score += 1;
    }

    // Substring match bonus: if the alt text contains a significant chunk of the item name
    if (score === 0 && normAlt.length > 4) {
      for (const word of itemWords) {
        if (normAlt.includes(word)) score += 0.5;
      }
    }

    // URL path matching: check if product URL path contains name words
    if (score === 0) {
      const urlPath = normalize(img.url.split("?")[0].split("/").slice(-3).join(" "));
      for (const word of itemWords) {
        if (word.length > 3 && urlPath.includes(word)) score += 0.3;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestUrl = img.url;
    }
  }

  return bestScore >= 0.5 ? bestUrl : undefined;
}

function collectGroupAttachments(messages: ParsedGmailMessage[]): AttachmentMeta[] {
  const seen = new Set<string>();
  const attachments: AttachmentMeta[] = [];
  for (const msg of messages) {
    for (const att of msg.attachments) {
      const key = `${att.filename}|${att.size}`;
      if (!seen.has(key)) {
        seen.add(key);
        attachments.push(att);
      }
    }
  }
  return attachments;
}

function mapStructuredItemToWardrobeItem(params: {
  item: StructuredOrderItem;
  brand: string;
  message: ParsedGmailMessage;
  status: ScanStatus;
  orderNumber?: string;
  purchaseDate?: string;
  orderJourney: string;
  allImages: Array<{ url: string; alt?: string }>;
  attachments: AttachmentMeta[];
}): WardrobeItem | null {
  const name = cleanProductName(sanitizeLine(params.item.name));
  if (!name || name.length < 2 || isItemNoise(name) || isGarbageName(name)) return null;

  // Prefer the structured item's own image, then try matching, never fall back blindly
  const imageUrl =
    params.item.imageUrl ??
    matchImageToItem(name, params.allImages) ??
    undefined;

  return {
    id: crypto.randomUUID(),
    messageId: params.message.id,
    threadId: params.message.threadId,
    name,
    brand: params.brand,
    category: detectCategory(name),
    color: params.item.color ?? detectColor(name),
    size: params.item.size ?? detectSize(name),
    price: params.item.price,
    currency: params.item.currency,
    quantity: params.item.quantity,
    sku: params.item.sku,
    productUrl: params.item.productUrl,
    orderNumber: params.orderNumber,
    orderJourney: params.orderJourney,
    purchaseDate: params.purchaseDate,
    status: params.status,
    sourceSubject: params.message.subject,
    sourceFrom: params.message.from,
    imageUrl,
    attachments: params.attachments.length > 0 ? params.attachments : undefined,
    extractionSource: "schema_org",
    confidence: 0.97
  };
}

function createFallbackItem(params: {
  message: ParsedGmailMessage;
  brand: string;
  status: ScanStatus;
  purchaseDate?: string;
  orderNumber?: string;
  orderJourney: string;
  attachments: AttachmentMeta[];
}): WardrobeItem | null {
  const cleanedSubject = cleanProductName(
    sanitizeLine(params.message.subject)
      .replace(/\b(order|receipt|confirmation|shipped|shipping|delivered|return|refund|arriving)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim()
  );

  if (!cleanedSubject || cleanedSubject.length < 4) return null;
  if (!isLikelyClothing(cleanedSubject) || isItemNoise(cleanedSubject) || isGarbageName(cleanedSubject)) return null;

  const fallbackPrice = parsePrices(`${params.message.subject} ${params.message.bodyText}`)[0];
  const imageUrl = matchImageToItem(cleanedSubject, params.message.productImages);

  return {
    id: crypto.randomUUID(),
    messageId: params.message.id,
    threadId: params.message.threadId,
    name: cleanedSubject,
    brand: params.brand,
    category: detectCategory(cleanedSubject),
    color: detectColor(cleanedSubject),
    size: detectSize(cleanedSubject),
    price: fallbackPrice,
    currency: fallbackPrice ? "USD" : undefined,
    orderNumber: params.orderNumber,
    orderJourney: params.orderJourney,
    purchaseDate: params.purchaseDate,
    status: params.status,
    sourceSubject: params.message.subject,
    sourceFrom: params.message.from,
    imageUrl,
    attachments: params.attachments.length > 0 ? params.attachments : undefined,
    extractionSource: "fallback_subject",
    confidence: imageUrl ? 0.56 : 0.48
  };
}

export function extractItemsFromMessages(messages: ParsedGmailMessage[]): WardrobeItem[] {
  const groups = groupByOrder(messages);
  const extracted: WardrobeItem[] = [];

  for (const group of groups) {
    const canonical = pickCanonicalMessage(group.messages);
    const purchaseDate = parseDate(canonical.date);
    const journey = computeJourney(group.messages);
    const status = statusFromJourney(journey);
    const orderJourney = journey.join(" -> ");
    const groupAttachments = collectGroupAttachments(group.messages);

    // Collect all product images from all messages in this group
    const allImages: Array<{ url: string; alt?: string }> = [];
    const seenUrls = new Set<string>();
    for (const msg of group.messages) {
      for (const img of msg.productImages) {
        if (!seenUrls.has(img.url)) {
          seenUrls.add(img.url);
          allImages.push(img);
        }
      }
    }

    const structuredItems = canonical.structuredOrder?.items ?? [];
    if (structuredItems.length > 0) {
      for (const structured of structuredItems) {
        const mapped = mapStructuredItemToWardrobeItem({
          item: structured,
          brand: group.brand,
          message: canonical,
          status,
          orderNumber: group.orderNumber,
          purchaseDate,
          orderJourney,
          allImages,
          attachments: groupAttachments
        });
        if (mapped) extracted.push(mapped);
      }
      continue;
    }

    const merged = new Map<string, ParsedItem>();

    for (const item of parseLineItems(canonical)) {
      const key = normalize(item.name);
      if (!merged.has(key) || (merged.get(key)?.confidence ?? 0) < item.confidence) {
        merged.set(key, item);
      }
    }

    for (const item of parseItemsFromImageAlts(canonical)) {
      const key = normalize(item.name);
      if (!merged.has(key)) {
        merged.set(key, item);
      }
    }

    const parsedItems = Array.from(merged.values()).slice(0, 12);

    if (parsedItems.length === 0) {
      const fallback = createFallbackItem({
        message: canonical,
        brand: group.brand,
        status,
        purchaseDate,
        orderNumber: group.orderNumber,
        orderJourney,
        attachments: groupAttachments
      });
      if (fallback) extracted.push(fallback);
      continue;
    }

    // For each parsed item, match image by name similarity (not by index)
    parsedItems.forEach((parsed) => {
      const itemName = cleanProductName(parsed.name);
      if (!itemName || itemName.length < 4 || isGarbageName(itemName)) return;

      const imageUrl = matchImageToItem(itemName, allImages);

      extracted.push({
        id: crypto.randomUUID(),
        messageId: canonical.id,
        threadId: canonical.threadId,
        name: itemName,
        brand: group.brand,
        category: detectCategory(parsed.name),
        color: parsed.color,
        size: parsed.size,
        price: parsed.price,
        currency: parsed.price ? "USD" : undefined,
        quantity: parsed.quantity,
        orderNumber: group.orderNumber,
        orderJourney,
        purchaseDate,
        status,
        sourceSubject: canonical.subject,
        sourceFrom: canonical.from,
        imageUrl,
        attachments: groupAttachments.length > 0 ? groupAttachments : undefined,
        extractionSource: parsed.source,
        confidence: parsed.confidence + (imageUrl ? 0.08 : 0)
      });
    });
  }

  return extracted;
}

function qualityScore(item: WardrobeItem): number {
  return item.confidence + (item.price ? 0.1 : 0) + (item.imageUrl ? 0.08 : 0) + (item.status === "purchased" ? 0.05 : 0);
}

export function dedupeItems(items: WardrobeItem[]): WardrobeItem[] {
  const deduped = new Map<string, WardrobeItem>();

  for (const item of items) {
    const dateKey = item.purchaseDate ? item.purchaseDate.slice(0, 10) : "nodate";
    const namePart = normalize(item.name).replace(/\s+/g, "");

    const key = item.orderNumber
      ? normalize(`${item.brand}|${item.orderNumber}|${namePart}`)
      : normalize(`${item.brand}|${namePart}|${dateKey}`);

    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, item);
      continue;
    }

    const existingScore = qualityScore(existing);
    const currentScore = qualityScore(item);

    if (currentScore > existingScore) {
      // Merge: keep better version but preserve attachments and journey from both
      const mergedAttachments = mergeAttachments(existing.attachments, item.attachments);
      deduped.set(key, {
        ...existing,
        ...item,
        id: existing.id,
        attachments: mergedAttachments.length > 0 ? mergedAttachments : undefined
      });
    }
  }

  return Array.from(deduped.values());
}

function mergeAttachments(a?: AttachmentMeta[], b?: AttachmentMeta[]): AttachmentMeta[] {
  const all = [...(a ?? []), ...(b ?? [])];
  const seen = new Set<string>();
  const result: AttachmentMeta[] = [];
  for (const att of all) {
    const key = `${att.filename}|${att.size}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(att);
    }
  }
  return result;
}
