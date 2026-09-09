#!/usr/bin/env node
/**
 * Updates data/bills.json with one month's paid/total amount, then
 * regenerates the Server Bill Tracker section inside index.html.
 *
 * Usage:
 *   node scripts/update-bills.js "April 2027" 35 35
 */

const fs = require("fs");
const path = require("path");

const [, , monthArg, paidArg, totalArg] = process.argv;

if (!monthArg || paidArg === undefined || totalArg === undefined) {
  console.error('Usage: node update-bills.js "<Month Year>" <paid> <total>');
  process.exit(1);
}

const paid = Number(paidArg);
const total = Number(totalArg);

if (Number.isNaN(paid) || Number.isNaN(total) || total <= 0 || paid < 0) {
  console.error("paid and total must be numbers, total must be greater than 0, paid cannot be negative.");
  process.exit(1);
}

const root = path.join(__dirname, "..");
const dataPath = path.join(root, "data", "bills.json");
const indexPath = path.join(root, "index.html");

// --- load / update the data file ---
let bills = [];
if (fs.existsSync(dataPath)) {
  bills = JSON.parse(fs.readFileSync(dataPath, "utf8"));
}

const existing = bills.find((b) => b.month === monthArg);
if (existing) {
  existing.paid = paid;
  existing.total = total;
} else {
  bills.push({ month: monthArg, paid, total });
}

fs.mkdirSync(path.dirname(dataPath), { recursive: true });
fs.writeFileSync(dataPath, JSON.stringify(bills, null, 2) + "\n");

// --- regenerate the HTML rows ---
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[c]));
}

function renderRow({ month, paid, total }) {
  const pct = Math.max(0, Math.min(100, Math.round((paid / total) * 100)));
  const isShort = pct < 100;
  const fillClass = isShort ? "bill-fill short" : "bill-fill";
  const amountClass = isShort ? "bill-amount short" : "bill-amount full";
  return `<div class="bill-item"><span class="bill-month">${escapeHtml(month)}</span><div class="bill-track"><div class="${fillClass}" style="width:${pct}%"></div></div><span class="${amountClass}">$${paid} / $${total}</span></div>`;
}

const rowsHtml = bills.map(renderRow).join("\n");

let html = fs.readFileSync(indexPath, "utf8");
const startMarker = "<!-- BILL-TRACKER-START -->";
const endMarker = "<!-- BILL-TRACKER-END -->";
const startIdx = html.indexOf(startMarker);
const endIdx = html.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error("Could not find BILL-TRACKER-START / BILL-TRACKER-END markers in index.html");
  process.exit(1);
}

const before = html.slice(0, startIdx + startMarker.length);
const after = html.slice(endIdx);
html = `${before}\n${rowsHtml}\n${after}`;

fs.writeFileSync(indexPath, html);

console.log(`Updated ${monthArg}: $${paid} / $${total}`);
