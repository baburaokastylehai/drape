import { brandCatalog } from "@/lib/brand-catalog";

export const retailerDomains: string[] = Array.from(new Set(brandCatalog.flatMap((brand) => brand.domains.map((d) => d.toLowerCase()))));

export function resolveBrandNameFromText(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const brand of brandCatalog) {
    for (const domain of brand.domains) {
      if (lower.includes(domain.toLowerCase())) return brand.name;
    }
  }
  return undefined;
}

export function matchesRetailerDomain(domain: string): boolean {
  const lower = domain.toLowerCase();
  return retailerDomains.some((known) => lower === known || lower.endsWith(`.${known}`));
}

export function detectBrandFromEmail(from: string, subject: string, bodySnippet: string): string {
  const catalogMatch = resolveBrandNameFromText(`${from} ${subject} ${bodySnippet}`);
  if (catalogMatch) return catalogMatch;

  const displayName = from.match(/^([^<]+)/)?.[1]?.trim();
  if (displayName && displayName.length > 1 && displayName.length < 60) {
    const cleaned = displayName
      .replace(/\b(noreply|no-reply|orders?|info|support|team|mail|email|shipping|delivery|notifications?|hello|hi|customerservice)\b/gi, "")
      .replace(/[<>@"]/g, "")
      .trim();
    if (cleaned.length > 1 && cleaned.length < 50) return cleaned;
  }

  const domainMatch = from.match(/@([^>.]+)/);
  if (domainMatch) {
    const domainPart = domainMatch[1].split(".")[0];
    if (domainPart && domainPart.length > 1 && domainPart.length < 30) {
      return domainPart.charAt(0).toUpperCase() + domainPart.slice(1);
    }
  }

  return "Unknown";
}

export const statusKeywords = {
  returned: ["return initiated", "refund", "returned", "return received"],
  inTransit: ["in transit", "shipped", "arriving", "out for delivery"]
};

export const categoryKeywords: Array<{ category: string; words: string[] }> = [
  { category: "Tops", words: ["shirt", "tee", "t-shirt", "hoodie", "sweater", "blouse", "polo", "tank", "camisole", "tunic", "henley", "crop top"] },
  { category: "Bottoms", words: ["jeans", "pant", "trouser", "shorts", "jogger", "skirt", "legging", "chino", "cargo"] },
  { category: "Shoes", words: ["shoe", "sneaker", "boot", "loafer", "sandal", "runner", "heel", "flat", "mule", "slipper", "clog"] },
  { category: "Outerwear", words: ["jacket", "coat", "parka", "blazer", "windbreaker", "vest", "cardigan", "pullover", "puffer", "anorak"] },
  { category: "Dresses", words: ["dress", "gown", "romper", "jumpsuit", "playsuit"] },
  { category: "Accessories", words: ["belt", "hat", "cap", "bag", "sock", "watch", "scarf", "glove", "sunglasses", "wallet", "tie", "beanie", "tote", "backpack", "purse"] }
];
