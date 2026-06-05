import { describe, expect, it } from "vitest";
import { deriveBudgetAlertState } from "@/components/BudgetAlertCard";

describe("deriveBudgetAlertState", () => {
  it("marks healthy usage below the warning band", () => {
    const state = deriveBudgetAlertState({ spendToday: 42, monthlyBudget: 100, alertThresholdPercent: 80 });

    expect(state.status).toBe("healthy");
    expect(state.usagePercent).toBe(42);
    expect(state.alertThresholdPercent).toBe(80);
  });

  it("keeps zero spend in the healthy state", () => {
    const state = deriveBudgetAlertState({ spendToday: 0, monthlyBudget: 100, alertThresholdPercent: 80 });

    expect(state.status).toBe("healthy");
    expect(state.usagePercent).toBe(0);
  });

  it("marks near threshold when spend is close to the configured threshold", () => {
    const state = deriveBudgetAlertState({ spendToday: 78, monthlyBudget: 100, alertThresholdPercent: 80 });

    expect(state.status).toBe("near-threshold");
    expect(state.usagePercent).toBe(78);
  });

  it("marks threshold reached at or above the configured threshold", () => {
    const state = deriveBudgetAlertState({ spendToday: 85, monthlyBudget: 100, alertThresholdPercent: 80 });

    expect(state.status).toBe("threshold-reached");
    expect(state.usagePercent).toBe(85);
  });

  it("marks exceeded once usage goes over 100 percent", () => {
    const state = deriveBudgetAlertState({ spendToday: 115, monthlyBudget: 100, alertThresholdPercent: 80 });

    expect(state.status).toBe("budget-exceeded");
    expect(state.usagePercent).toBeCloseTo(115, 5);
  });

  it("handles missing or invalid budget values gracefully", () => {
    const state = deriveBudgetAlertState({ spendToday: 25, monthlyBudget: 0, alertThresholdPercent: 80 });

    expect(state.status).toBe("unavailable");
    expect(state.usagePercent).toBeNull();
  });
});
