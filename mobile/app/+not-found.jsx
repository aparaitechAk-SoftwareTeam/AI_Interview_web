import { Link } from "expo-router";
import { Text } from "react-native";
import { Screen } from "../src/components/screen";
export default function NotFound() { return <Screen><Text selectable>This screen is unavailable.</Text><Link href="/">Return to welcome</Link></Screen>; }
