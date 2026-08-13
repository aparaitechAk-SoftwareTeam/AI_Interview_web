export function normalizeWhatsAppPhone(phone:string) {
  const digits=phone.replace(/\D/g,"");
  if (!digits) return "";
  if (digits.length===10) return `91${digits}`;
  return digits.startsWith("0") ? `91${digits.replace(/^0+/,"")}` : digits;
}
export function candidateWhatsAppUrl(candidate:{fullName?:string;phone?:string;position?:string}, invitation?:{code?:string;expiresAt?:string}|null) {
  const phone=normalizeWhatsAppPhone(candidate.phone||""); if(!phone) return "";
  const expiry=invitation?.expiresAt ? new Date(invitation.expiresAt).toLocaleString("en-IN") : "as mentioned in your invitation";
  const message=`Hello ${candidate.fullName || "Candidate"},\n\nYou are invited to complete your Aparaitech AI Interview${candidate.position ? ` for ${candidate.position}` : ""}.\nInvitation code: ${invitation?.code || "Please check your email"}\nValid until: ${expiry}\n\nOpen the candidate portal and enter your code. Keep your camera and microphone ready, use a stable connection, and complete the interview independently.\n\nCandidate portal: ${typeof window === "undefined" ? "" : `${window.location.origin}/candidate/login`}\n\nThis link only prepares the message. Please review and tap Send in WhatsApp.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
