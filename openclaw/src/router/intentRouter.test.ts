import assert from "node:assert/strict";
import test from "node:test";

import { routeIntent } from "./intentRouter";

const analyticsPhrases = [
  "Give me today's summary",
  "Today's summary",
  "Daily summary",
  "Usage summary",
  "Cost summary",
  "Dashboard summary",
  "AI usage summary",
  "spend today",
  "today's spend",
  "total spend",
  "usage today",
  "how much did I spend",
  "summarize today's usage",
  "summarize telemetry",
  "show dashboard",
  "give me my dashboard",
  "current analytics",
  "current usage"
];

for (const phrase of analyticsPhrases) {
  test(`routes analytics intent: ${phrase}`, () => {
    assert.equal(routeIntent(phrase).name, "analytics.overview");
  });
}

test("still routes explicit report requests to report.get", () => {
  assert.equal(routeIntent("weekly report").name, "report.get");
  assert.equal(routeIntent("monthly report").name, "report.get");
});

test("still routes copilot-style explain requests to copilot.chat", () => {
  assert.equal(routeIntent("Why is spend higher today?").name, "copilot.chat");
});
