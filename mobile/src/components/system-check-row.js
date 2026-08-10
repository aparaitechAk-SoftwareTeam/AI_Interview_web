import { Text, View } from "react-native";
import { colors } from "../theme/colors";

export function SystemCheckRow({ label, ready, detail }) { return <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}><View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: ready ? "rgba(35, 163, 104, 0.22)" : "rgba(205, 55, 83, 0.22)", justifyContent: "center", alignItems: "center" }}><Text style={{ color: ready ? colors.success : colors.danger, fontWeight: "900" }}>{ready ? "✓" : "!"}</Text></View><View style={{ flex: 1 }}><Text selectable style={{ color: colors.text, fontWeight: "700" }}>{label}</Text>{detail ? <Text selectable style={{ color: colors.muted, marginTop: 2 }}>{detail}</Text> : null}</View></View>; }
