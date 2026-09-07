import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import Feather from "@react-native-vector-icons/feather";

import { api, Order } from "@/src/api";
import { useToast } from "@/src/toast";
import { downloadAuthedFile, downloadCsv } from "@/src/download";
import { makeStyles, useTheme } from "@/src/theme";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AdminOrders() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>("Toutes");
  const [audience, setAudience] = useState<"all" | "business" | "personal">("all");
  const [target, setTarget] = useState<Order | null>(null);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [os, st] = await Promise.all([api.adminOrders(), api.adminStatuses()]);
      setOrders(os);
      setStatuses(st.statuses);
      // Mark orders as seen — clears the unread badge on the dashboard
      if (os.length > 0) {
        try {
          const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
          await AsyncStorage.setItem("admin.orders.lastSeen", os[0].created_at);
        } catch { /* ignore */ }
      }
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const filtered = useMemo(() => {
    let list = orders;
    if (audience !== "all") list = list.filter((o) => (o.account_type ?? "business") === audience);
    if (selectedFilter !== "Toutes") list = list.filter((o) => o.status === selectedFilter);
    return list;
  }, [orders, selectedFilter, audience]);

  const counts = useMemo(() => ({
    all: orders.length,
    business: orders.filter((o) => (o.account_type ?? "business") === "business").length,
    personal: orders.filter((o) => o.account_type === "personal").length,
  }), [orders]);

  async function changeStatus(newStatus: string) {
    if (!target) return;
    try {
      setUpdating(true);
      const updated = await api.adminUpdateStatus(target.id, newStatus);
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setTarget(null);
      toast.show(`Statut : ${newStatus}`, "success");
    } catch (e: any) {
      toast.show(e?.message || "Mise à jour impossible", "error");
    } finally {
      setUpdating(false);
    }
  }

  async function downloadInvoice(order: Order) {
    try {
      await downloadAuthedFile(
        api.adminInvoice(order.id),
        `facture-${order.id.slice(0, 8)}.pdf`,
      );
      toast.show("Facture téléchargée", "success");
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    }
  }

  const statusColor = (s: string) => {
    if (s === "Livrée") return { bg: colors.success, fg: colors.onSuccess };
    if (s === "Validée" || s === "En préparation")
      return { bg: colors.brandTertiary, fg: colors.onBrandTertiary };
    if (s === "Annulée") return { bg: colors.error, fg: colors.onError };
    return { bg: colors.brandSecondary, fg: colors.onBrandSecondary };
  };

  const filters = ["Toutes", ...statuses];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          testID="back-btn"
          onPress={() => router.back()}
          hitSlop={16}
          style={styles.iconBtn}
        >
          <Feather name="chevron-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Commandes</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.audienceRow} testID="audience-tabs">
        {([
          { key: "all" as const, label: "Toutes", count: counts.all },
          { key: "business" as const, label: "Pros", count: counts.business },
          { key: "personal" as const, label: "Particuliers", count: counts.personal },
        ]).map((t) => {
          const active = audience === t.key;
          return (
            <Pressable
              key={t.key}
              testID={`audience-${t.key}`}
              onPress={() => setAudience(t.key)}
              style={[
                styles.audienceTab,
                active && { backgroundColor: colors.surface, borderColor: colors.brandPrimary },
              ]}
            >
              <Text
                style={[
                  styles.audienceTabTxt,
                  { color: active ? colors.brandPrimary : colors.muted },
                ]}
              >
                {t.label}
              </Text>
              <View
                style={[
                  styles.audienceCount,
                  {
                    backgroundColor: active ? colors.brandPrimary : colors.surfaceTertiary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.audienceCountTxt,
                    { color: active ? colors.onBrandPrimary : colors.muted },
                  ]}
                >
                  {t.count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={styles.chipsScroll}
      >
        {filters.map((f) => {
          const active = f === selectedFilter;
          return (
            <Pressable
              key={f}
              testID={`filter-${f}`}
              onPress={() => setSelectedFilter(f)}
              style={[
                styles.chip,
                active
                  ? { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }
                  : { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.chipTxt,
                  { color: active ? colors.onBrandPrimary : colors.onSurface },
                ]}
              >
                {f}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        </View>
      ) : (
        <FlatList
          testID="admin-orders-list"
          data={filtered}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: insets.bottom + 32,
            gap: 12,
          }}
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
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Feather name="inbox" size={40} color={colors.muted} />
              <Text style={styles.emptyTxt}>Aucune commande</Text>
            </View>
          }
          renderItem={({ item }) => {
            const sc = statusColor(item.status);
            return (
              <Pressable
                testID={`admin-order-${item.id}`}
                onPress={() =>
                  router.push({
                    pathname: "/(admin)/order-detail",
                    params: { id: item.id },
                  })
                }
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.companyRow}>
                      <Text style={styles.company} numberOfLines={1}>
                        {item.company_name}
                      </Text>
                      <View
                        style={[
                          styles.typePill,
                          {
                            backgroundColor:
                              item.account_type === "personal"
                                ? colors.brandTertiary
                                : colors.brandSecondary,
                          },
                        ]}
                      >
                        <Feather
                          name={item.account_type === "personal" ? "user" : "briefcase"}
                          size={9}
                          color={
                            item.account_type === "personal"
                              ? colors.onBrandTertiary
                              : colors.onBrandSecondary
                          }
                        />
                        <Text
                          style={[
                            styles.typePillTxt,
                            {
                              color:
                                item.account_type === "personal"
                                  ? colors.onBrandTertiary
                                  : colors.onBrandSecondary,
                            },
                          ]}
                        >
                          {item.account_type === "personal" ? "Particulier" : "Pro"}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.orderMeta}>
                      #{item.id.slice(0, 8).toUpperCase()} • {formatDate(item.created_at)}
                    </Text>
                    <Text style={styles.addr} numberOfLines={1}>
                      <Feather name="map-pin" size={11} color={colors.muted} />{" "}
                      {item.delivery_address}
                    </Text>
                  </View>
                  <Pressable
                    testID={`status-${item.id}`}
                    onPress={(e) => {
                      e.stopPropagation();
                      setTarget(item);
                    }}
                    style={[styles.chipBtn, { backgroundColor: sc.bg }]}
                  >
                    <Text style={[styles.chipBtnTxt, { color: sc.fg }]}>{item.status}</Text>
                    <Feather name="chevron-down" size={12} color={sc.fg} />
                  </Pressable>
                </View>
                <View style={styles.divider} />
                <View style={styles.footer}>
                  <Text style={styles.itemsCount}>
                    {item.items.length} produit{item.items.length > 1 ? "s" : ""} •{" "}
                    <Text style={styles.total}>{item.total.toFixed(2)} €</Text>
                  </Text>
                  <Pressable
                    testID={`invoice-${item.id}`}
                    onPress={(e) => {
                      e.stopPropagation();
                      downloadInvoice(item);
                    }}
                    style={styles.invoiceBtn}
                  >
                    <Feather name="download" size={14} color={colors.brandPrimary} />
                    <Text style={styles.invoiceTxt}>Facture PDF</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          }}
        />
      )}

      {/* Status modal */}
      <Modal
        visible={!!target}
        transparent
        animationType="fade"
        onRequestClose={() => setTarget(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setTarget(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Changer le statut</Text>
            <Text style={styles.sheetSub}>
              Commande #{target?.id.slice(0, 8).toUpperCase()}
            </Text>
            <View style={styles.sheetList}>
              {statuses.map((s) => {
                const active = s === target?.status;
                return (
                  <Pressable
                    key={s}
                    testID={`set-status-${s}`}
                    disabled={updating}
                    onPress={() => changeStatus(s)}
                    style={[
                      styles.statusRow,
                      active && { backgroundColor: colors.brandSecondary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusRowTxt,
                        active && { color: colors.brandPrimary, fontWeight: "700" },
                      ]}
                    >
                      {s}
                    </Text>
                    {active && <Feather name="check" size={18} color={colors.brandPrimary} />}
                  </Pressable>
                );
              })}
            </View>
            {updating && (
              <View style={{ paddingVertical: 12 }}>
                <ActivityIndicator color={colors.brandPrimary} />
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  chipsScroll: { maxHeight: 68 },
  chipsRow: { gap: 8, paddingHorizontal: 16, alignItems: "center", height: 56 },
  audienceRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: colors.surface,
  },
  audienceTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  audienceTabTxt: { fontSize: 13, fontWeight: "700" },
  audienceCount: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  audienceCountTxt: { fontSize: 11, fontWeight: "800" },
  companyRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  typePillTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chipTxt: { fontSize: 13, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 8 },
  emptyTxt: { color: colors.muted, fontSize: 14 },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  company: { fontSize: 15, fontWeight: "800", color: colors.onSurface, flexShrink: 1 },
  orderMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  addr: { fontSize: 12, color: colors.muted, marginTop: 4 },
  chipBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipBtnTxt: { fontSize: 11, fontWeight: "700" },
  divider: { height: 1, backgroundColor: colors.divider },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemsCount: { fontSize: 13, color: colors.muted },
  total: { fontSize: 15, fontWeight: "800", color: colors.brandPrimary },
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
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    gap: 4,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  sheetSub: { fontSize: 12, color: colors.muted, marginBottom: 10 },
  sheetList: { gap: 4 },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  statusRowTxt: { fontSize: 15, color: colors.onSurface },
}));
