import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { buildSummary } from "@/lib/analytics";
import { dedupeItems, extractItemsFromMessages } from "@/lib/extract";
import { fetchPurchaseMessages } from "@/lib/gmail";
import { refreshAccessToken } from "@/lib/google-auth";
import { getSessionById, saveSession } from "@/lib/session-store";
import type { ScanRequest } from "@/lib/types";

export const runtime = "nodejs";

function tokenExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt - 60_000;
}

export async function POST(request: Request) {
  try {
    const cookieStore = cookies();
    const sessionId = cookieStore.get(config.sessionCookieName)?.value;
    const session = getSessionById(sessionId);

    if (!session?.tokens) {
      return NextResponse.json({ error: "Not connected to Gmail." }, { status: 401 });
    }

    const body = await parseScanRequest(request);
    const rangePreset = body.rangePreset ?? "12m";

    const logs: string[] = [];
    logs.push("Scope: retail apparel/footwear/accessories order, shipping, return, and refund emails.");

    if (tokenExpired(session.tokens.expiresAt) && session.tokens.refreshToken) {
      logs.push("Refreshing Gmail access token...");
      session.tokens = await refreshAccessToken(session.tokens.refreshToken);
      saveSession(session);
    }

    logs.push("Searching Gmail for retailer receipts in selected time window...");
    const scanResult = await fetchPurchaseMessages(session.tokens, {
      rangePreset,
      customFrom: body.customFrom,
      customTo: body.customTo
    });
    const messages = scanResult.matchedMessages;
    logs.push(`Timeframe: ${scanResult.rangeLabel}.`);
    logs.push(
      `Candidates: ${scanResult.candidateEmails}, transactional: ${scanResult.transactionalEmails}, promotional excluded: ${scanResult.excludedPromotional}, unknown excluded: ${scanResult.excludedUnknown}.`
    );
    logs.push(
      `Schema hits: ${scanResult.schemaEmails} emails with structured order data, ${scanResult.schemaItems} schema line items extracted.`
    );
    logs.push(`Threads analyzed: ${scanResult.threadsAnalyzed}. Final item state resolved at thread level.`);
    logs.push(
      `Intent breakdown -> purchase: ${scanResult.intentBreakdown.purchase}, shipping: ${scanResult.intentBreakdown.shipping}, return: ${scanResult.intentBreakdown.return}, refund: ${scanResult.intentBreakdown.refund}.`
    );

    logs.push("Extracting item-level wardrobe data...");
    const extracted = extractItemsFromMessages(messages);
    logs.push(`Extracted ${extracted.length} raw items from email content.`);
    logs.push(
      `Parsed prices for ${extracted.filter((item) => typeof item.price === "number").length} items; order-linked items: ${extracted.filter((item) => Boolean(item.orderNumber)).length}.`
    );

    logs.push("Deduplicating repeated confirmations and shipment updates...");
    const deduped = dedupeItems(extracted);
    logs.push(`Deduplicated to ${deduped.length} unique wardrobe entries.`);

    const summary = buildSummary(extracted, deduped, scanResult.totalScanned, messages.length);

    return NextResponse.json({
      logs,
      summary,
      items: deduped,
      meta: {
        rangeLabel: scanResult.rangeLabel,
        queryDescription: scanResult.queryDescription,
        candidateEmails: scanResult.candidateEmails,
        transactionalEmails: scanResult.transactionalEmails,
        excludedPromotional: scanResult.excludedPromotional,
        excludedUnknown: scanResult.excludedUnknown,
        schemaEmails: scanResult.schemaEmails,
        schemaItems: scanResult.schemaItems,
        threadsAnalyzed: scanResult.threadsAnalyzed,
        intentBreakdown: scanResult.intentBreakdown
      },
      diagnostics: {
        audit: scanResult.audit.slice(0, 220),
        extractedPreview: deduped.slice(0, 120).map((item) => ({
          name: item.name,
          brand: item.brand,
          status: item.status,
          orderNumber: item.orderNumber,
          price: item.price,
          extractionSource: item.extractionSource
        }))
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function parseScanRequest(request: Request): Promise<ScanRequest> {
  try {
    const body = (await request.json()) as Partial<ScanRequest>;
    return {
      rangePreset: body.rangePreset ?? "12m",
      customFrom: body.customFrom,
      customTo: body.customTo
    };
  } catch {
    return { rangePreset: "12m" };
  }
}
