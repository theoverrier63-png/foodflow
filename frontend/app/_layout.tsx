import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import { LogBox, View, ActivityIndicator } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect } from "react";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { AuthProvider, useAuth } from "@/src/auth-context";
import { CartProvider } from "@/src/cart-context";
import { ToastProvider } from "@/src/toast";
import { useTheme } from "@/src/theme";

LogBox.ignoreAllLogs(true);

function AuthGate() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "(auth)";
    const inAdmin = segments[0] === "(admin)";
    const inApp = segments[0] === "(app)";
    const isAdmin = user?.role === "admin";

    if (!user && !inAuth) {
      router.replace("/(auth)/login");
    } else if (user && inAuth) {
      router.replace(isAdmin ? "/(admin)" : "/(app)");
    } else if (user && isAdmin && inApp) {
      router.replace("/(admin)");
    } else if (user && !isAdmin && inAdmin) {
      router.replace("/(app)");
    }
  }, [user, loading, segments, router, pathname]);

  return null;
}

function InnerRoot() {
  const { colors, scheme } = useTheme();
  const { loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </View>
    );
  }

  return (
    <>
      <AuthGate />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
        <Stack.Screen name="(admin)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <CartProvider>
              <ToastProvider>
                <InnerRoot />
              </ToastProvider>
            </CartProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
