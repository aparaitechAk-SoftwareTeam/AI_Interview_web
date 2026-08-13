import { Linking, Platform } from "react-native";

const DEFAULT_COUNTRY_CODE = "91";

export function normalizeWhatsAppPhone(value, defaultCountryCode = DEFAULT_COUNTRY_CODE) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10) digits = `${defaultCountryCode}${digits}`;
  else if (digits.length === 11 && digits.startsWith("0")) digits = `${defaultCountryCode}${digits.slice(1)}`;
  if (digits.length < 8 || digits.length > 15) throw new Error("Enter a valid mobile number with its country code before opening WhatsApp.");
  return digits;
}

function formatExpiry(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "the time stated by the recruitment team";
  return `${date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} IST`;
}

export function buildInvitationWhatsAppMessage({ candidate, invitation }) {
  if (!candidate?.fullName || !invitation?.code) throw new Error("A candidate and active invitation code are required.");
  const role = candidate.position || "the open role";
  return [
    `Hello ${candidate.fullName},`,
    "",
    `You have been invited to the Aparaitech interview process for ${role}.`,
    "",
    `Invitation code: ${invitation.code}`,
    `Valid until: ${formatExpiry(invitation.expiresAt)}`,
    "",
    "Open the Aparaitech Interview app and enter this private code. Do not share it with anyone.",
    "",
    "Before starting, use a quiet, well-lit place and a stable internet connection. The app will request your consent for camera, microphone, recording, and interview monitoring.",
    "",
    "Aparaitech Recruitment"
  ].join("\n");
}

export function buildInvitationWhatsAppUrl({ candidate, invitation }) {
  const phone = normalizeWhatsAppPhone(candidate?.phone);
  const message = buildInvitationWhatsAppMessage({ candidate, invitation });
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export async function openInvitationWhatsApp(payload) {
  const url = buildInvitationWhatsAppUrl(payload);
  if (Platform.OS === "web" && typeof window !== "undefined") {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) throw new Error("Your browser blocked the WhatsApp window. Allow pop-ups and try again.");
    return url;
  }
  const supported = await Linking.canOpenURL(url);
  if (!supported) throw new Error("WhatsApp could not be opened on this device.");
  await Linking.openURL(url);
  return url;
}
