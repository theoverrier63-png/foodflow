import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Feather from "@react-native-vector-icons/feather";

import { api, Order } from "@/src/api";
import { downloadAuthedFile } from "@/src/download";
import { useToast } from "@/src/toast";
import { formatQty, unitShort } from "@/src/units";
import { makeStyles, useTheme } from "@/src/theme";

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function Orders() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function downloadInvoice(order: Order) {
    try {
      await downloadAuthedFile(
        api.customerInvoice(order.id),
        `facture-${order.id.slice(0, 8)}.pdf`,
      );
      toast.show("Facture téléchargée", "success");
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    }
  }

  const load = useCallback(async () => {
    try {
      setError(null);
      const os = await api.orders();
      setOrders(os);
    } catch (e: any) {
      setError(e?.message || "Erreur");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    load();
  }, [load]);

  const statusColor = (s: string) => {
    if (s === "Livrée") return { bg: colors.success, fg: colors.onSuccess };
    if (s === "Validée") return { bg: colors.brandTertiary, fg: colors.onBrandTertiary };
    return { bg: colors.brandSecondary, fg: colors.onBrandSecondary };
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Commandes</Text>
        <Text style={styles.sub}>Suivi & historique</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={32} color={colors.error} />
          <Text style={styles.errorTxt}>{error}</Text>
          <Pressable style={styles.retry} onPress={load} testID="retry-orders-button">
            <Text style={styles.retryTxt}>Réessayer</Text>
          </Pressable>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <Feather name="package" size={48} color={colors.muted} />
          <Text style={styles.emptyTitle}>Aucune commande</Text>
          <Text style={styles.emptySub}>Passez votre première commande</Text>
          <Pressable
            style={styles.retry}
            onPress={() => router.push("/(app)")}
            testID="orders-go-catalog-button"
          >
            <Text style={styles.retryTxt}>Voir le catalogue</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          testID="orders-list"
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.brandPrimary}
            />
          }
          renderItem={({ item }) => {
            const sc = statusColor(item.status);
            return (
              <View style={styles.card} testID={`order-card-${item.id}`}>
                <View style={styles.cardTop}>
                  <View>
                    <Text style={styles.orderId}>#{item.id.slice(0, 8).toUpperCase()}</Text>
                    <Text style={styles.orderDate}>{formatDate(item.created_at)}</Text>
                  </View>
                  <View style={[styles.chip, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.chipTxt, { color: sc.fg }]}>{item.status}</Text>
                  </View>
                </View>
                <View style={styles.divider} />
                {item.items.slice(0, 3).map((it) => (
                  <View key={it.product_id} style={styles.itemRow}>
                    <Text style={styles.itemQty}>
                      {formatQty(it.quantity)} {unitShort(it.sell_unit)}
                    </Text>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {it.name}
                    </Text>
                    <Text style={styles.itemPrice}>
                      {(it.price * it.quantity).toFixed(2)} €
                    </Text>
                  </View>
                ))}
                {item.items.length > 3 && (
                  <Text style={styles.more}>+{item.items.length - 3} autres articles</Text>
                )}
                <View style={styles.divider} />
                <View style={styles.totalRow}>
                  <View>
                    <Text style={styles.totalLabel}>Total HT</Text>
                    <Text style={styles.totalVal}>{item.total.toFixed(2)} €</Text>
                  </View>
                  <Pressable
                    testID={`invoice-${item.id}`}
                    onPress={() => downloadInvoice(item)}
                    style={styles.invoiceBtn}
                  >
                    <Feather name="download" size={14} color={colors.brandPrimary} />
                    <Text style={styles.invoiceTxt}>Facture PDF</Text>
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  sub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  errorTxt: { color: colors.onSurface, fontSize: 14 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: colors.onSurface },
  emptySub: { fontSize: 13, color: colors.muted },
  retry: {
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    marginTop: 8,
  },
  retryTxt: { color: colors.onBrandPrimary, fontWeight: "700" },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderId: { fontSize: 14, fontWeight: "800", color: colors.onSurface, letterSpacing: 0.5 },
  orderDate: { fontSize: 12, color: colors.muted, marginTop: 2 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  chipTxt: { fontSize: 11, fontWeight: "700" },
  divider: { height: 1, backgroundColor: colors.divider, marginVertical: 4 },
  itemRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  itemQty: { width: 60, fontSize: 12, fontWeight: "700", color: colors.brandPrimary },
  itemName: { flex: 1, fontSize: 13, color: colors.onSurface },
  itemPrice: { fontSize: 13, color: colors.onSurface, fontWeight: "600" },
  more: { fontSize: 12, color: colors.muted, fontStyle: "italic" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 13, color: colors.muted },
  totalVal: { fontSize: 18, fontWeight: "800", color: colors.brandPrimary },
  invoiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.brandSecondary,
  },
  invoiceTxt: { color: colors.brandPrimary, fontWeight: "700", fontSize: 12 },
}));
