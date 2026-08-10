import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

function escapeHtml(value) { return String(value ?? "-").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" }[character])); }
function statusLabel(value) { return String(value || "PENDING").replaceAll("_", " "); }
function date(value) { return value ? new Date(value).toLocaleString("en-IN") : "-"; }

export async function exportCandidateRegistryPdf(registry) {
  const rows = (registry.candidates || []).map((candidate, index) => `<tr><td>${index + 1}</td><td><strong>${escapeHtml(candidate.fullName)}</strong><br/><span>${escapeHtml(candidate.position || "-")}</span></td><td>${escapeHtml(candidate.email)}<br/><span>${escapeHtml(candidate.phone)}</span></td><td>${escapeHtml(candidate.invitation?.code || "-")}</td><td>${escapeHtml(candidate.invitation?.emailDelivery?.status || "PENDING")}</td><td>${escapeHtml(statusLabel(candidate.status))}</td><td>${date(candidate.createdAt)}</td></tr>`).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"/><style>body{font-family:Arial,sans-serif;color:#17233d;padding:26px}h1{margin:0;color:#173d90;font-size:25px}.sub{color:#63718a;margin:7px 0 24px}.summary{background:#edf3ff;border:1px solid #cbd9f7;padding:12px 14px;border-radius:8px;margin-bottom:18px}table{border-collapse:collapse;width:100%;font-size:9px}th{background:#173d90;color:#fff;text-align:left;padding:8px}td{vertical-align:top;border-bottom:1px solid #dce4f2;padding:8px}span{color:#63718a;font-size:8px}.footer{color:#74819a;font-size:8px;margin-top:18px}</style></head><body><h1>Aparaitech Candidate Registry</h1><p class="sub">Secure recruitment record generated ${escapeHtml(date(registry.generatedAt))}</p><div class="summary"><strong>Total candidates: ${escapeHtml(registry.total)}</strong> &nbsp; | &nbsp; Invited: ${escapeHtml(registry.pipeline?.INVITED || 0)} &nbsp; | &nbsp; Under review: ${escapeHtml(registry.pipeline?.UNDER_REVIEW || 0)} &nbsp; | &nbsp; Selected: ${escapeHtml(registry.pipeline?.SELECTED || 0)} &nbsp; | &nbsp; Rejected: ${escapeHtml(registry.pipeline?.REJECTED || 0)}</div><table><thead><tr><th>#</th><th>Candidate / Role</th><th>Contact</th><th>Invitation code</th><th>Email delivery</th><th>Application status</th><th>Created</th></tr></thead><tbody>${rows || "<tr><td colspan=7>No candidate records.</td></tr>"}</tbody></table><p class="footer">Confidential recruitment data. Share only with authorized Aparaitech personnel.</p></body></html>`;
  if (Platform.OS === "web") { await Print.printAsync({ html }); return; }
  const file = await Print.printToFileAsync({ html, base64: false });
  if (!(await Sharing.isAvailableAsync())) throw new Error("PDF was created, but sharing is unavailable on this device.");
  await Sharing.shareAsync(file.uri, { mimeType: "application/pdf", dialogTitle: "Download Aparaitech candidate registry" });
}
