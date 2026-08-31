import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, createApiClient, normalizeVendorAnalyticsResponse } from "./client";

const fetchMock = vi.fn();

const escrow = {
  id: "e1",
  vendorId: "v1",
  amount: 10,
  item: "Item",
  status: "PENDING",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  history: [],
};

const dispute = {
  id: "d1",
  escrowId: "e1",
  escrow,
  buyerId: "b1",
  reason: "Missing item",
  evidence: [],
  status: "OPEN",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const tracking = {
  escrowId: "e1",
  status: "IN_TRANSIT",
  carrier: "GIGL",
  trackingNumber: "track-1",
  events: [],
};

function mockResponse(body: unknown, { ok = true, status = 200, statusText = "OK" }: { ok?: boolean; status?: number; statusText?: string } = {}) {
  return {
    ok,
    status,
    statusText,
    text: async () => (body ? JSON.stringify(body) : ""),
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it.each(["dailyMetrics", "series", "data"] as const)(
    "normalizes analytics %s into dataPoints",
    (field) => {
      const point = {
        date: "2026-01-01",
        transactionVolume: 10,
        averageOrderValue: 5,
        completionRate: 1,
        disputeRate: 0,
      };

      expect(normalizeVendorAnalyticsResponse({ [field]: [point] })).toMatchObject({
        dataPoints: [point],
      });
    }
  );

  it("injects the auth header automatically from the client token", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(escrow));

    const client = createApiClient("jwt-123");
    await client.getEscrow("e1");

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Headers).get("Authorization")).toBe("Bearer jwt-123");
  });

  it("returns typed JSON and surfaces ApiError on failure", async () => {
    fetchMock.mockResolvedValue(mockResponse({ message: "bad" }, { ok: false, status: 400, statusText: "Bad Request" }));

    const client = createApiClient();

    await expect(client.getEscrow("bad")).rejects.toBeInstanceOf(ApiError);
    await expect(client.getEscrow("bad")).rejects.toMatchObject({ status: 400 });
  });

  it("supports the dispute and shipping helpers", async () => {
    fetchMock
      .mockResolvedValueOnce(mockResponse(dispute))
      .mockResolvedValueOnce(mockResponse(tracking));

    const client = createApiClient("jwt-456");
    await expect(client.createDispute("e1", { reason: "late", description: "late", evidence: ["a"] })).resolves.toMatchObject({ id: "d1" });
    await expect(client.shipEscrow("e1", { trackingId: "t1", carrier: "UPS" })).resolves.toMatchObject({ escrowId: "e1" });
  });

  it("rejects a successful response with an invalid escrow shape", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ id: "e1" }));

    await expect(createApiClient().getEscrow("e1")).rejects.toThrow(
      "Invalid API response for /escrow/e1: unexpected response shape"
    );
  });
});
