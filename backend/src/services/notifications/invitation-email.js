import nodemailer from "nodemailer";
import { env } from "../../config/env.js";

let transporter;

function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" }[character]));
}
function formatExpiry(value) { return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value)); }
function getTransporter() {
  if (!env.SMTP_ENABLED) return null;
  if (!transporter) transporter = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE, auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000 });
  return transporter;
}
function content({ candidate, invitation }) {
  const name = escapeHtml(candidate.fullName); const position = escapeHtml(candidate.position || "the open role"); const code = escapeHtml(invitation.code); const expiresAt = formatExpiry(invitation.expiresAt); const portal = env.CANDIDATE_PORTAL_URL ? `<p style="margin:24px 0"><a href="${escapeHtml(env.CANDIDATE_PORTAL_URL)}" style="display:inline-block;background:#315cf4;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:700">Open interview portal</a></p>` : "";
  const support = env.SUPPORT_EMAIL ? ` For help, contact ${escapeHtml(env.SUPPORT_EMAIL)}.` : "";
  const subject = `Your Aparaitech interview invitation - ${candidate.fullName}`;
  const text = `Hello ${candidate.fullName},\n\nYou have been invited to the Aparaitech interview process for ${candidate.position || "the open role"}.\n\nInvitation code: ${invitation.code}\nValid until: ${expiresAt} IST\n\nOpen the Aparaitech Interview app and enter this private code. Do not share this code. You will be asked for camera, microphone, recording and monitoring consent before the interview begins. Use a quiet, well-lit space and a stable internet connection.\n\nTerms: this invitation is personal and may be single-use; your interview responses and authorized recording are reviewed only by the recruitment team; app interruptions may be recorded as review evidence and are not an automatic rejection.\n\nIf you did not expect this invitation, please ignore this email.${support}\n\nAparaitech Recruitment`;
  const html = `<div style="margin:0 auto;max-width:620px;font-family:Arial,sans-serif;color:#17233d;line-height:1.55"><div style="background:#10275b;padding:24px;border-radius:16px 16px 0 0"><div style="color:#bcd5ff;font-size:12px;font-weight:700;letter-spacing:1px">APARAITECH RECRUITMENT</div><h1 style="margin:8px 0 0;color:#fff;font-size:27px">Your interview invitation</h1></div><div style="border:1px solid #d9e2f3;border-top:0;padding:26px;border-radius:0 0 16px 16px"><p>Hello ${name},</p><p>You have been invited to the Aparaitech interview process for <strong>${position}</strong>.</p><div style="background:#eef4ff;border:1px solid #c9d9fb;border-radius:12px;padding:18px;text-align:center"><div style="font-size:12px;font-weight:700;color:#48618e;letter-spacing:.8px">PRIVATE INVITATION CODE</div><div style="font-size:25px;font-weight:800;letter-spacing:2px;color:#1d45aa;margin-top:4px">${code}</div><div style="font-size:13px;color:#536987;margin-top:8px">Valid until ${escapeHtml(expiresAt)} IST</div></div>${portal}<h3 style="margin:24px 0 8px">Before you begin</h3><ul style="padding-left:20px"><li>Open the Aparaitech Interview app and enter your private code.</li><li>Use a quiet, well-lit space and a stable internet connection.</li><li>Do not share this code. It may be limited to one authorized use.</li><li>You will review and accept camera, microphone, recording and monitoring consent before starting.</li></ul><h3 style="margin:24px 0 8px">Important terms</h3><p style="font-size:13px;color:#536987">Your responses and authorized recording are available only to the recruitment team for evaluation. App interruptions can be recorded as review evidence; they are not an automatic rejection decision. If you did not expect this invitation, please ignore this email.${support}</p></div></div>`;
  return { subject, text, html };
}

export const invitationEmail = {
  async send({ candidate, invitation }) {
    const attemptedAt = new Date();
    const transport = getTransporter();
    if (!transport) return { status: "NOT_CONFIGURED", lastAttemptAt: attemptedAt, error: "SMTP is not configured" };
    try {
      const message = content({ candidate, invitation });
      const result = await transport.sendMail({ from: env.MAIL_FROM, to: candidate.email, replyTo: env.MAIL_REPLY_TO || undefined, ...message });
      return { status: "SENT", lastAttemptAt: attemptedAt, sentAt: new Date(), messageId: String(result.messageId || "") };
    } catch (error) {
      return { status: "FAILED", lastAttemptAt: attemptedAt, error: String(error?.message || "SMTP delivery failed").slice(0, 300) };
    }
  }
};
