import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { StyleSheet, Text, View, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "./theme";

type ToastCtx = { show: (msg: string, type?: "success" | "error" | "info") => void };
const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState("");
  const [type, setType] = useState<"success" | "error" | "info">("info");
  const opacity = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const show = useCallback(
    (m: string, t: "success" | "error" | "info" = "info") => {
      setMsg(m);
      setType(t);
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(2200),
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    },
    [opacity]
  );

  const bg =
    type === "success" ? colors.success : type === "error" ? colors.error : colors.surfaceInverse;
  const fg =
    type === "success" ? colors.onSuccess : type === "error" ? colors.onError : colors.onSurfaceInverse;

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.wrap,
          { top: insets.top + 12, opacity, backgroundColor: bg },
        ]}
        testID="toast"
      >
        <Text style={[styles.txt, { color: fg }]} numberOfLines={2}>
          {msg}
        </Text>
      </Animated.View>
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useToast requires ToastProvider");
  return c;
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    zIndex: 9999,
  },
  txt: { fontSize: 14, fontWeight: "600", textAlign: "center" },
});
