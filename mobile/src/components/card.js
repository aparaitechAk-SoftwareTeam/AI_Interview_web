import { View } from "react-native";
import { card } from "../theme/styles";

export function Card({ children, style }) { return <View style={[card, style]}>{children}</View>; }
