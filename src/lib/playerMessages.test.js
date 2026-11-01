import { describe, it, expect } from "vitest";
import { fmtMoney } from "./format.js";
import { planInAppSend, hasSnapshotValues, templateLabel, summariseSend, friendlyMessageError, MAX_LENGTH } from "./playerMessages.js";

const thabo = { id: "p1", name: "Thabo Nkosi", ageGroup: "U12", balance: 450 };
const aisha = { id: "p2", name: "Aisha Khan", ageGroup: "U9", balance: 0 };
const liam = { id: "p3", name: "Liam Smith", ageGroup: "U12", balance: 100 };

describe("planInAppSend", () => {
  it("fills placeholders per player and splits out those without the app", () => {
    const plan = planInAppSend([thabo, aisha, liam], "Hi {first_name}, {balance} for {age_group}", new Set(["p1", "p3"]));
    expect(plan.error).toBe("");
    expect(plan.messages).toEqual([
      { player_id: "p1", body: `Hi Thabo, ${fmtMoney(450)} for U12` },
      { player_id: "p3", body: `Hi Liam, ${fmtMoney(100)} for U12` },
    ]);
    expect(plan.missing.map((p) => p.name)).toEqual(["Aisha Khan"]);
  });
  it("explains why nothing can be sent", () => {
    expect(planInAppSend([thabo], "  ", new Set(["p1"])).error).toBe("Write a message first.");
    expect(planInAppSend([], "Hi", new Set()).error).toBe("Choose at least one player.");
    expect(planInAppSend([aisha], "Hi", new Set()).error).toMatch(/None of the selected players/);
  });
  it("catches messages that get too long once filled in", () => {
    const plan = planInAppSend([thabo], "x".repeat(MAX_LENGTH - 5) + "{name}", new Set(["p1"]));
    expect(plan.error).toMatch(/up to 1000 characters/);
  });
  it("caps one send at 500 players", () => {
    const many = Array.from({ length: 501 }, (_, i) => ({ id: `x${i}`, name: "A B" }));
    expect(planInAppSend(many, "Hi", new Set(many.map((p) => p.id))).error).toMatch(/more than 500/);
  });
});

describe("helpers", () => {
  it("knows when figures are fixed at sending", () => {
    expect(hasSnapshotValues("You owe {balance}")).toBe(true);
    expect(hasSnapshotValues("Kit day Saturday")).toBe(false);
  });
  it("labels templates", () => {
    expect(templateLabel("payment_reminder")).toBe("Payment reminder");
    expect(templateLabel("custom")).toBe("Custom message");
    expect(templateLabel(null)).toBe("Custom message");
  });
  it("summarises a send: unread first, then by name", () => {
    const s = summariseSend({
      id: "b1", created_at: "2026-10-28T08:00:00Z", sent_by_email: "t@gfc.co.za", template_id: "payment_reminder", template_text: "Hi {first_name}",
      player_messages: [
        { player_id: "p1", read_at: "2026-10-28T09:00:00Z" },
        { player_id: "p3", read_at: null },
        { player_id: "gone", read_at: null },
      ],
    }, new Map([["p1", "Thabo Nkosi"], ["p3", "Liam Smith"]]));
    expect(s.total).toBe(3);
    expect(s.readCount).toBe(1);
    expect(s.label).toBe("Payment reminder");
    expect(s.recipients.map((r) => r.name)).toEqual(["Liam Smith", "Unknown player", "Thabo Nkosi"]);
  });
  it("turns database errors into plain English", () => {
    expect(friendlyMessageError({ message: "permission denied for table player_messages" })).toMatch(/Admin, Chairman or Treasurer/);
    expect(friendlyMessageError({ message: "Could not find the function public.send_player_messages" })).toMatch(/aren’t set up yet/);
    expect(friendlyMessageError({ message: "A player is in this send twice." })).toBe("A player is in this send twice.");
    expect(friendlyMessageError(new TypeError("Failed to fetch"))).toMatch(/connection/);
  });
});
