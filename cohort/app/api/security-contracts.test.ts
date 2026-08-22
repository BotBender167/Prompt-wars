import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";
import { POST as createBeacon } from "./beacons/route";
import { DELETE as deleteBeacon } from "./beacons/[id]/route";
import { POST as draftMessage } from "./message/route";
import { PUT as saveProfile } from "./profile/route";
import { POST as syncProfile } from "./sync/[profileId]/route";

const foreignHeaders = { origin: "https://evil.example" };

describe("state-changing API origin contracts", () => {
  test("profile writes reject a foreign origin before parsing", async () => {
    const response = await saveProfile(
      new NextRequest("https://app.example/api/profile", {
        method: "PUT",
        headers: foreignHeaders,
        body: "not-json",
      })
    );

    expect(response.status).toBe(403);
  });

  test("beacon creation rejects a foreign origin before parsing", async () => {
    const response = await createBeacon(
      new NextRequest("https://app.example/api/beacons", {
        method: "POST",
        headers: foreignHeaders,
        body: "not-json",
      })
    );

    expect(response.status).toBe(403);
  });

  test("beacon deletion rejects a foreign origin before ownership checks", async () => {
    const response = await deleteBeacon(
      new NextRequest("https://app.example/api/beacons/id", {
        method: "DELETE",
        headers: foreignHeaders,
      }),
      { params: Promise.resolve({ id: "" }) }
    );

    expect(response.status).toBe(403);
  });

  test("message drafting rejects a foreign origin before parsing", async () => {
    const response = await draftMessage(
      new NextRequest("https://app.example/api/message", {
        method: "POST",
        headers: foreignHeaders,
        body: "not-json",
      })
    );

    expect(response.status).toBe(403);
  });

  test("account sync rejects a foreign origin before profile lookup", async () => {
    const response = await syncProfile(
      new NextRequest("https://app.example/api/sync/id", {
        method: "POST",
        headers: foreignHeaders,
      }),
      { params: Promise.resolve({ profileId: "" }) }
    );

    expect(response.status).toBe(403);
  });
});
