export const STATUS = {
  awaiting_payment: "Awaiting payment", pending: "Sent to stall", accepted: "Accepted",
  preparing: "Being prepared", ready: "Ready for pickup", completed: "Completed", cancelled: "Cancelled",
};
export const TAGS = ["light", "hearty", "protein", "veggie", "fried", "spicy", "soup", "swallow", "sweet", "breakfast", "snack"];

// The journey of an order, in order. Used by the tracker and the progress bar.
export const STAGES = [
  { key: "pending", short: "Sent", label: "Order sent", hint: "Paid, and on its way to the stall" },
  { key: "accepted", short: "Accepted", label: "Accepted", hint: "The stall has seen your order" },
  { key: "preparing", short: "Cooking", label: "Being prepared", hint: "Your food is being made" },
  { key: "ready", short: "Ready", label: "Ready for pickup", hint: "Come and collect it" },
  { key: "completed", short: "Done", label: "Collected", hint: "Enjoy your meal" },
];
export const stageIndex = (status) => STAGES.findIndex((s) => s.key === status);

// "Cancelled · refunded" etc.
export function statusLabel(o) {
  if (o.status !== "cancelled") return STATUS[o.status] || o.status;
  if (!o.paid) return "Cancelled";
  return o.refunded ? "Cancelled · refunded" : "Cancelled · refund pending";
}

export const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
export const fmtDate = (iso) => new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
