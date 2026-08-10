import { Text, View } from "react-native";

export function ErrorBanner({ message }) { if (!message) return null; return <View style={{ backgroundColor: "rgba(111, 24, 49, 0.4)", borderColor: "rgba(255, 116, 139, 0.62)", borderWidth: 1, borderRadius: 14, padding: 12 }}><Text selectable style={{ color: "#FFB4C1", lineHeight: 20 }}>{message}</Text></View>; }
