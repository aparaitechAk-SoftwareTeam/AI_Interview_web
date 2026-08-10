import "expo-sqlite/localStorage/install";
import { useEffect, useRef } from "react";
import { router, usePathname } from "expo-router";
import { Stack } from "expo-router/stack";
import { DarkTheme, ThemeProvider } from "expo-router/react-navigation";
import { colors } from "../src/theme/colors";
import { api } from "../src/api/client";
import { sessionStore } from "../src/services/session-store";

function InterviewRecovery() {
  const pathname = usePathname(); const attempted = useRef(false);
  useEffect(() => {
    if (attempted.current || pathname?.startsWith("/admin")) return;
    attempted.current = true;
    let mounted = true;
    (async () => {
      const recovery = await sessionStore.getRecovery();
      if (!recovery?.interviewId) return;
      try {
        const current = await api.currentInterview(recovery.interviewId);
        if (!mounted) return;
        if (current.completed) {
          const pendingRecording = await sessionStore.getPendingRecording();
          if (pendingRecording?.interviewId === recovery.interviewId) {
            router.replace({ pathname: "/interview/[id]", params: { id: recovery.interviewId, candidateName: recovery.candidateName || "Candidate", startedAt: recovery.startedAt, recordingOnly: "true" } });
            return;
          }
          await sessionStore.clearRecovery(); return;
        }
        if (!current.currentQuestion) return;
        api.event(recovery.interviewId, { type: "SESSION_RECOVERED", timestamp: new Date().toISOString(), metadata: { restoredAfterRestart: true } }).catch(() => {});
        router.replace({ pathname: "/interview/[id]", params: { id: recovery.interviewId, candidateName: recovery.candidateName || "Candidate", startedAt: recovery.startedAt, durationMinutes: current.interview?.durationMinutes, firstQuestion: JSON.stringify(current.currentQuestion), restored: "true" } });
      } catch {
        // A signed-out or offline candidate remains on the normal entry screen.
      }
    })();
    return () => { mounted = false; };
  }, [pathname]);
  return null;
}

export default    function RootLayout() {
  return <ThemeProvider value={DarkTheme}><InterviewRecovery /><Stack screenOptions={{ headerShadowVisible: false, headerBackButtonDisplayMode: "minimal", headerStyle: { backgroundColor: colors.background }, headerTintColor: "#C9D9F5", headerTitleStyle: { color: colors.text, fontWeight: "800" }, contentStyle: { backgroundColor: colors.background } }}><Stack.Screen name="index" options={{ headerShown: false }} /><Stack.Screen name="candidate-access" options={{ headerShown: false }} /><Stack.Screen name="resume-upload" options={{ title: "Resume upload" }} /><Stack.Screen name="system-check" options={{ title: "System check" }} /><Stack.Screen name="interview-consent" options={{ title: "Interview consent" }} /><Stack.Screen name="interview/[id]" options={{ headerShown: false, gestureEnabled: false }} /><Stack.Screen name="interview-complete" options={{ title: "Interview complete", headerLeft: () => null }} /><Stack.Screen name="candidate-status" options={{ title: "Application status" }} /><Stack.Screen name="admin-login" options={{ headerShown: false }} /><Stack.Screen name="admin-dashboard" options={{ headerShown: false }} /><Stack.Screen name="admin-candidates" options={{ title: "Candidates" }} /><Stack.Screen name="admin-candidate-registry" options={{ title: "Candidate registry" }} /><Stack.Screen name="admin-create-candidate" options={{ title: "Invite candidate" }} /><Stack.Screen name="admin-candidate/[id]" options={{ title: "Candidate evaluation" }} /><Stack.Screen name="admin-settings" options={{ title: "Interview settings" }} /></Stack></ThemeProvider>;
}
