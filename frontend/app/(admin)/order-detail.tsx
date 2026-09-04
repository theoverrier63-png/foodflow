import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import Feather from "@react-native-vector-icons/feather";

import { api, Order } from "@/src/api";
import { useToast } from "@/src/toast";
import { downloadCsv } from "@/src/download";
import { makeStyles, useTheme } from "@/src/theme";

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AdminOrderDetail() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ id?: string }>();

  const [order, setOrder] = useState<Order | null>(null);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStatusSheet, setShowStatusSheet] = useState(false);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    if (!params.id) return;
    try {
      const [o, st] = await Promise.all([
        api.adminGetOrder(params.id),
        api.adminStatuses(),
      ]);
      setOrder(o);
      setStatuses(st.statuses);
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [params.id, router, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function changeStatus(newStatus: string) {
    if (!order) return;
    try {
      setUpdating(true);
      const updated = await api.adminUpdateStatus(order.id, newStatus);
      setOrder(updated);
      setShowStatusSheet(false);
      toast.show(`Statut : ${newStatus}`, "success");
    } catch (e: any) {
      toast.show(e?.message || "Mise à jour impossible", "error");
    } finally {
      setUpdating(false);
    }
  }

  async function downloadInvoice() {
    if (!order) return;
    try {
      const res = await api.adminInvoice(order.id);
      await downloadCsv(res.filename, res.content);
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

  if (loading || !order) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </View>
    );
  }

  const sc = statusColor(order.status);
  const totalItems = order.items.reduce((a, i) => a + i.quantity, 0);

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
        <Text style={styles.headerTitle}>Détail commande</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 120,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header card */}
        <View style={styles.headerCard} testID="detail-header">
          <View style={styles.headerCardTop}>
            <View>
              <Text style={styles.orderId}>
                #{order.id.slice(0, 8).toUpperCase()}
              </Text>
              <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
            </View>
            <Pressable
              testID="detail-change-status"
              onPress={() => setShowStatusSheet(true)}
              style={[styles.chipBtn, { backgroundColor: sc.bg }]}
            >
              <Text style={[styles.chipBtnTxt, { color: sc.fg }]}>{order.status}</Text>
              <Feather name="chevron-down" size={12} color={sc.fg} />
            </Pressable>
          </View>
        </View>

        {/* Customer info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Client</Text>
          <View style={styles.infoCard}>
            <InfoLine
              icon="briefcase"
              label="Entreprise"
              value={order.company_name}
            />
            <View style={styles.hairline} />
            <InfoLine
              icon="map-pin"
              label="Adresse de livraison"
              value={order.delivery_address}
            />
          </View>
        </View>

        {/* Items */}
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>Produits commandés</Text>
            <Text style={styles.sectionCount}>
              {order.items.length} référence{order.items.length > 1 ? "s" : ""} • {totalItems} unité
              {totalItems > 1 ? "s" : ""}
            </Text>
          </View>

          <View style={styles.itemsCard}>
            {/* Table header */}
            <View style={styles.tableHead}>
              <Text style={[styles.thTxt, { flex: 1 }]}>Produit</Text>
              <Text style={[styles.thTxt, { width: 44, textAlign: "center" }]}>Qté</Text>
              <Text style={[styles.thTxt, { width: 80, textAlign: "right" }]}>PU HT</Text>
              <Text style={[styles.thTxt, { width: 80, textAlign: "right" }]}>Total</Text>
            </View>
            {order.items.map((it, idx) => (
              <View
                key={it.product_id + idx}
                style={[
                  styles.itemRow,
                  idx === order.items.length - 1 && { borderBottomWidth: 0 },
                ]}
                testID={`detail-item-${it.product_id}`}
              >
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {it.name}
                  </Text>
                  <Text style={styles.itemUnit} numberOfLines={1}>
                    {it.unit}
                  </Text>
                </View>
                <View style={styles.qtyPill}>
                  <Text style={styles.qtyTxt}>×{it.quantity}</Text>
                </View>
                <Text style={styles.priceCell}>{it.price.toFixed(2)} €</Text>
                <Text style={styles.lineTotal}>
                  {(it.price * it.quantity).toFixed(2)} €
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Totals */}
        <View style={styles.totalsCard}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Nombre d'unités</Text>
            <Text style={styles.totalMuted}>{totalItems}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Références</Text>
            <Text style={styles.totalMuted}>{order.items.length}</Text>
          </View>
          <View style={styles.hairline} />
          <View style={styles.totalRow}>
            <Text style={styles.totalGrandLabel}>Total HT</Text>
            <Text style={styles.totalGrandVal} testID="detail-total">
              {order.total.toFixed(2)} €
            </Text>
          </View>
        </View>

        {order.notes ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Note du client</Text>
            <View style={styles.infoCard}>
              <Text style={styles.noteTxt}>{order.notes}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky invoice CTA */}
      <View style={[styles.stickyCta, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          testID="detail-invoice-btn"
          onPress={downloadInvoice}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
        >
          <Feather name="download" size={18} color={colors.onBrandPrimary} />
          <Text style={styles.ctaTxt}>Télécharger la facture (CSV)</Text>
        </Pressable>
      </View>

      {/* Status sheet */}
      <Modal
        visible={showStatusSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatusSheet(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setShowStatusSheet(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Changer le statut</Text>
            <Text style={styles.sheetSub}>Commande #{order.id.slice(0, 8).toUpperCase()}</Text>
            <View style={styles.sheetList}>
              {statuses.map((s) => {
                const active = s === order.status;
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

function InfoLine({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.infoLine}>
      <View style={styles.infoIcon}>
        <Feather name={icon as any} size={14} color={colors.brandPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
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
  headerCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderId: { fontSize: 18, fontWeight: "800", color: colors.onSurface, letterSpacing: 0.5 },
  orderDate: { fontSize: 12, color: colors.muted, marginTop: 4 },
  chipBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipBtnTxt: { fontSize: 11, fontWeight: "700" },
  section: { gap: 8 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  sectionCount: { fontSize: 11, color: colors.muted, marginRight: 4 },
  infoCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 4,
  },
  infoLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: { fontSize: 11, color: colors.muted, letterSpacing: 0.3 },
  infoValue: { fontSize: 14, color: colors.onSurface, fontWeight: "600", marginTop: 2 },
  hairline: { height: 1, backgroundColor: colors.divider, marginHorizontal: 12 },
  itemsCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  tableHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surfaceTertiary,
    gap: 8,
  },
  thTxt: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: 8,
  },
  itemName: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  itemUnit: { fontSize: 11, color: colors.muted, marginTop: 2 },
  qtyPill: {
    width: 44,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyTxt: { fontSize: 12, fontWeight: "800", color: colors.brandPrimary },
  priceCell: { width: 80, textAlign: "right", fontSize: 13, color: colors.onSurface },
  lineTotal: {
    width: 80,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "800",
    color: colors.brandPrimary,
  },
  totalsCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 13, color: colors.muted },
  totalMuted: { fontSize: 13, color: colors.onSurface, fontWeight: "600" },
  totalGrandLabel: { fontSize: 15, color: colors.onSurface, fontWeight: "800" },
  totalGrandVal: { fontSize: 22, color: colors.brandPrimary, fontWeight: "800" },
  noteTxt: { fontSize: 14, color: colors.onSurface, lineHeight: 20, padding: 14 },
  stickyCta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cta: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  ctaTxt: { color: colors.onBrandPrimary, fontSize: 15, fontWeight: "700" },
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
