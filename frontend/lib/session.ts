"use client";
const keys = { admin: "aparaitech.web.admin", interview: "aparaitech.web.interview", status: "aparaitech.web.status" } as const;
export const session = {
  get: (key: keyof typeof keys) => typeof window === "undefined" ? null : localStorage.getItem(keys[key]),
  setCandidate: (tokens: { interviewToken: string; statusToken: string }) => { localStorage.setItem(keys.interview, tokens.interviewToken); localStorage.setItem(keys.status, tokens.statusToken); },
  setAdmin: (token: string) => localStorage.setItem(keys.admin, token),
  clearCandidate: () => { localStorage.removeItem(keys.interview); localStorage.removeItem(keys.status); },
  clearAdmin: () => localStorage.removeItem(keys.admin)
};
