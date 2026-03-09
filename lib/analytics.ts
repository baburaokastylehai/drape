import type { WardrobeItem, ScanSummary } from "@/lib/types";

export function buildSummary(
  rawItems: WardrobeItem[],
  dedupedItems: WardrobeItem[],
  emailsScanned: number,
  emailsMatched: number
): ScanSummary {
  const totalSpend = dedupedItems.reduce((sum, item) => sum + (item.price ?? 0), 0);
  const uniqueBrands = new Set(dedupedItems.map((item) => item.brand)).size;
  const returnedCount = dedupedItems.filter((item) => item.status === "returned").length;
  const inTransitCount = dedupedItems.filter((item) => item.status === "in_transit").length;

  return {
    emailsScanned,
    emailsMatched,
    extractedItems: rawItems.length,
    dedupedItems: dedupedItems.length,
    totalSpend,
    uniqueBrands,
    returnedCount,
    inTransitCount
  };
}
