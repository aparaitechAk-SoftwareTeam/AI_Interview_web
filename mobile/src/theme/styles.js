import { colors } from "./colors";

export const shadow = { boxShadow: "0 13px 30px rgba(0, 0, 0, 0.23)" };
export const card = { backgroundColor: colors.card, borderRadius: 20, borderCurve: "continuous", borderWidth: 1, borderColor: colors.line, padding: 18, gap: 12, ...shadow };
export const screenContent = { padding: 20, paddingBottom: 40, gap: 16 };
