import React, { useState, useMemo } from "react";
import { T } from "../theme.js";
import { fmtMoney, fmtDate, todayISO } from "../lib/format.js";

const INCOME_CATEGORIES = ["Donation", "Sponsorship", "Fundraising", "Grant", "Opening Balance", "Other income"];
const EXPENSE_CATEGORIES = ["Equipment", "Referee fees", "Ground hire", "Utilities", "Admin/bank fees", "Other expense"];

/**
 * Builds one combined ledger from two sources:
 *  - manual finance_entries (bank transactions, donations, other income/expense)
 *  - subscription payments, read LIVE from each player's payment history
 * Subscription payments are never copied into finance_entries - this keeps
 * a single source of truth, so editing a payment in a player's ledger is
 * automatically reflected here too, with no risk of the two drifting apart.
 */
function buildCombinedLedger(financeEntries, players) {
  const manual = financeEntries.map((e) => ({
    id: e.id, date: e.date, description: e.description, category: e.category,
    type: e.type, amount: e.amount, isSubscription: false,
  }));

  const subscriptionRows = (players || []).flatMap((p) =>
    (p.payments || []).map((pm) => ({
      id: `sub-${pm.id}`, date: pm.date, description: `Subscription — ${p.name}`,
      category: "Subscription", type: "income", amount: Number(pm.amount) || 0, isSubscription: true,
    }))
  );

  return [...manual, ...subscriptionRows].sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function FinanceView({ financeEntries, players, assets, onAdd, onEdit, onDelete }) {
  const [categoryFilter, setCategoryFilter] = useState("All");

  const ledger = useMemo(() => buildCombinedLedger(financeEntries, players), [financeEntries, players]);

  const stats = useMemo(() => {
    let balance = 0;
    let totalIncome = 0;
    let totalExpense = 0;
    for (const row of ledger) {
      const signed = row.type === "expense" ? -row.amount : row.amount;
      balance += signed;
      if (row.category !== "Opening Balance") {
        if (row.type === "expense") totalExpense += row.amount;
        else totalIncome += row.amount;
      }
    }
    const assetsValue = (assets || []).reduce((s, a) => s + (Number(a.quantity) || 0) * (Number(a.unitValue) || 0), 0);
    return { balance, totalIncome, totalExpense, netWorth: balance + assetsValue };
  }, [ledger, assets]);

  const filtered = useMemo(() => {
    if (categoryFilter === "All") return ledger;
    return ledger.filter((r) => r.category === categoryFilter);
  }, [ledger, categoryFilter]);

  const allCategories = useMemo(() => {
    const set = new Set(ledger.map((r) => r.category));
    return Array.from(set).sort();
  }, [ledger]);

  return (
    <div>
      <div className="gfc-topbar">
        <div>
          <div className="gfc-page-title gfc-display">Finance</div>
          <div className="gfc-page-sub">Cash ledger — bank transactions, donations, and subscription income in one place</div>
        </div>
        <button className="gfc-btn gfc-btn-primary" onClick={onAdd}>+ Add entry</button>
      </div>

      <div className="gfc-stat-row">
        <div className="gfc-stat">
          <div className="gfc-stat-accent" style={{ background: T.indigo }} />
          <div className="gfc-stat-label">Cash balance</div>
          <div className="gfc-stat-value gfc-mono">{fmtMoney(stats.balance)}</div>
        </div>
        <div className="gfc-stat">
          <div className="gfc-stat-accent" style={{ background: T.green }} />
          <div className="gfc-stat-label">Total income</div>
          <div className="gfc-stat-value gfc-mono">{fmtMoney(stats.totalIncome)}</div>
        </div>
        <div className="gfc-stat">
          <div className="gfc-stat-accent" style={{ background: T.danger }} />
          <div className="gfc-stat-label">Total expenses</div>
          <div className="gfc-stat-value gfc-mono">{fmtMoney(stats.totalExpense)}</div>
        </div>
        <div className="gfc-stat">
          <div className="gfc-stat-accent" style={{ background: T.gold }} />
          <div className="gfc-stat-label">Net worth <span style={{ fontWeight: 400, textTransform: "none" }}>(cash + assets)</span></div>
          <div className="gfc-stat-value gfc-mono">{fmtMoney(stats.netWorth)}</div>
        </div>
      </div>

      <div className="gfc-panel">
        <div className="gfc-panel-head">
          <div className="gfc-panel-title">Ledger ({filtered.length})</div>
          <div className="gfc-filters">
            <select className="gfc-select" style={{ maxWidth: 180 }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="All">All categories</option>
              {allCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="gfc-empty">
            <div className="gfc-empty-title gfc-display">No entries yet</div>
            Add your opening balance to get started, then log bank transactions, donations, and expenses as they happen.
          </div>
        ) : (
          <table className="gfc-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Category</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className={r.isSubscription ? "" : "clickable"} onClick={() => !r.isSubscription && onEdit(r)}>
                  <td>{fmtDate(r.date)}</td>
                  <td style={{ fontWeight: 600 }}>{r.description}</td>
                  <td><span className="gfc-agepill" style={{ background: r.isSubscription ? T.green : T.indigoSoft }}>{r.category}</span></td>
                  <td className="gfc-mono" style={{ fontWeight: 700, color: r.type === "expense" ? T.danger : T.green }}>
                    {r.type === "expense" ? "-" : "+"}{fmtMoney(r.amount)}
                  </td>
                  <td>
                    {r.isSubscription ? (
                      <span style={{ fontSize: 11, color: T.inkSoft }} title="Edit this in the player's subscription ledger instead">Via Subscriptions</span>
                    ) : (
                      <button className="gfc-btn gfc-btn-outline gfc-btn-sm" onClick={(e) => { e.stopPropagation(); onEdit(r); }}>Edit</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function FinanceEntryModal({ entry, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(() => ({
    id: entry?.id || "",
    date: entry?.date || todayISO(),
    description: entry?.description || "",
    type: entry?.type || "income",
    category: entry?.category || INCOME_CATEGORIES[0],
    amount: entry?.amount ?? "",
  }));

  function update(field, value) {
    setForm((f) => {
      const next = { ...f, [field]: value };
      // Switching type resets category to a sensible default for that type.
      if (field === "type") {
        next.category = value === "expense" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0];
      }
      return next;
    });
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.description.trim() || !form.amount) return;
    onSave(form);
  }

  const categoryOptions = form.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <div className="gfc-modal-backdrop" onClick={onClose}>
      <div className="gfc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gfc-modal-head">
          <div className="gfc-modal-title gfc-display">{entry ? "Edit entry" : "Add entry"}</div>
          <button className="gfc-modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="gfc-row2">
            <div className="gfc-field">
              <label className="gfc-label">Date</label>
              <input type="date" className="gfc-input" value={form.date} onChange={(e) => update("date", e.target.value)} />
            </div>
            <div className="gfc-field">
              <label className="gfc-label">Type</label>
              <select className="gfc-select" value={form.type} onChange={(e) => update("type", e.target.value)}>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </div>
          </div>
          <div className="gfc-field">
            <label className="gfc-label">Description</label>
            <input className="gfc-input" placeholder="e.g. Donation from Smith family, Referee fees - 18 July" value={form.description} onChange={(e) => update("description", e.target.value)} required />
          </div>
          <div className="gfc-row2">
            <div className="gfc-field">
              <label className="gfc-label">Category</label>
              <select className="gfc-select" value={form.category} onChange={(e) => update("category", e.target.value)}>
                {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="gfc-field">
              <label className="gfc-label">Amount (R)</label>
              <input type="number" min="0" step="any" className="gfc-input" value={form.amount} onChange={(e) => update("amount", e.target.value)} required />
            </div>
          </div>
          {form.category === "Opening Balance" && (
            <div style={{ fontSize: 11.5, color: T.inkSoft, marginBottom: 14 }}>
              Use this once to set the club's starting cash balance before you began logging transactions here.
            </div>
          )}
          <div className="gfc-modal-actions">
            {entry && (
              <button type="button" className="gfc-btn gfc-btn-danger" style={{ marginRight: "auto" }} onClick={() => onDelete(entry.id)}>
                Delete entry
              </button>
            )}
            <button type="button" className="gfc-btn gfc-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="gfc-btn gfc-btn-primary">Save entry</button>
          </div>
        </form>
      </div>
    </div>
  );
}
