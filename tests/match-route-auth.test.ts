import test from "node:test";
import assert from "node:assert/strict";

import { POST } from "../app/api/match/route.ts";

test("rejects live matching when the candidate is not authenticated", async () => {
  const response = await POST(new Request("http://localhost/api/match", {
    method: "POST",
    body: JSON.stringify({
      role: "Finance Manager",
      skills: ["FP&A", "Excel"],
      experience: 6,
      candidateCountry: "India",
      market: "india",
      remoteOnly: false,
      workplace: "any",
      minCtc: 2500000,
      maxCtc: 0,
      ctcCurrency: "INR",
      states: [],
      cities: [],
    }),
  }));
  const payload = await response.json();

  assert.equal(response.status, 401);
  assert.equal(payload.code, "AUTH_REQUIRED");
});
