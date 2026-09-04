import { Tabs } from "expo-router";
import { View, Text, StyleSheet, Platform } from "react-native";
import Feather from "@react-native-vector-icons/feather";
import { useTheme } from "@/src/theme";
import { useCart } from "@/src/cart-context";

function CartTabIcon({ color, size }: { color: string; size: number }) {
  const { count } = useCart();
  const { colors } = useTheme();
  return (
    <View>
      <Feather name="shopping-cart" size={size} color={color} />
      {count > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.brandPrimary, borderColor: colors.surface }]}>
          <Text style={[styles.badgeTxt, { color: colors.onBrandPrimary }]}>{count > 99 ? "99+" : count}</Text>
        </View>
      )}
    </View>
  );
}

export default function AppTabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarItemStyle: { alignSelf: "center" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Catalogue",
          tabBarIcon: ({ color, size }) => <Feather name="grid" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: "Panier",
          tabBarIcon: (p) => <CartTabIcon color={p.color} size={p.size} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: "Commandes",
          tabBarIcon: ({ color, size }) => <Feather name="package" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Compte",
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTxt: { fontSize: 10, fontWeight: "800" },
});
