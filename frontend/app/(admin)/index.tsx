import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import Feather from "@react-native-vector-icons/feather";

import { api, Order } from "@/src/api";
import { useAuth } from "@/src/auth-context";
import { useToast } from "@/src/toast";
import { downloadCsv } from "@/src/download";
import { makeStyles, useTheme } from "@/src/theme";

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { signOut } = useAuth();
  const toast = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.adminOrders();
      setOrders(list);
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

  async function exportAll() {
    try {
      setExporting(true);
      const res = await api.adminExportAll();
      await downloadCsv(res.filename, res.content);
      toast.show(`${res.count} commande(s) exportée(s)`, "success");
    } catch (e: any) {
      toast.show(e?.message || "Export impossible", "error");
    } finally {
      setExporting(false);
    }
  }

  async function logout() {
    await signOut();
    toast.show("Déconnecté", "info");
  }

  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === "En attente").length,
    revenue: orders.reduce((a, o) => a + o.total, 0),
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.hello}>Administrateur</Text>
          <Text style={styles.title}>Tableau de bord</Text>
        </View>
        <Pressable testID="admin-logout" onPress={logout} hitSlop={12} style={styles.iconBtn}>
          <Feather name="log-out" size={18} color={colors.onSurface} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 16 }}
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
      >
        {/* KPI cards */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpi, { backgroundColor: colors.brandSecondary }]}>
            <Feather name="package" size={16} color={colors.brandPrimary} />
            <Text style={styles.kpiValue} testID="kpi-total">
              {loading ? "—" : stats.total}
            </Text>
            <Text style={styles.kpiLabel}>Commandes</Text>
          </View>
          <View style={[styles.kpi, { backgroundColor: colors.brandTertiary }]}>
            <Feather name="clock" size={16} color={colors.onBrandTertiary} />
            <Text style={[styles.kpiValue, { color: colors.onBrandTertiary }]} testID="kpi-pending">
              {loading ? "—" : stats.pending}
            </Text>
            <Text style={[styles.kpiLabel, { color: colors.onBrandTertiary }]}>En attente</Text>
          </View>
        </View>
        <View style={styles.revenueCard}>
          <View>
            <Text style={styles.revenueLabel}>Chiffre d'affaires HT</Text>
            <Text style={styles.revenueValue} testID="kpi-revenue">
              {loading ? "—" : `${stats.revenue.toFixed(2)} €`}
            </Text>
          </View>
          <View style={styles.revenueIcon}>
            <Feather name="trending-up" size={22} color={colors.onBrandPrimary} />
          </View>
        </View>

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>Gestion</Text>
        <ActionRow
          testID="nav-orders"
          icon="clipboard"
          title="Commandes"
          subtitle="Gérer les statuts et générer les factures"
          onPress={() => router.push("/(admin)/orders")}
        />
        <ActionRow
          testID="nav-products"
          icon="grid"
          title="Catalogue produits"
          subtitle="Ajouter, modifier ou supprimer des produits"
          onPress={() => router.push("/(admin)/products")}
        />
        <ActionRow
          testID="nav-pending"
          icon="user-check"
          title="Comptes pro en attente"
          subtitle="Approuver ou refuser les nouvelles entreprises"
          onPress={() => router.push("/(admin)/pending")}
        />
        <ActionRow
          testID="nav-season"
          icon="sun"
          title="Saison en cours"
          subtitle="Été, hiver, toute l'année — filtre auto du catalogue"
          onPress={() => router.push("/(admin)/season")}
        />
        <ActionRow
          testID="nav-banner"
          icon="image"
          title="Bannière d'accueil"
          subtitle="Importer une image affichée en tête du catalogue"
          onPress={() => router.push("/(admin)/banner")}
        />
        <ActionRow
          testID="nav-export"
          icon="download"
          title="Exporter toutes les commandes"
          subtitle="Téléchargez un CSV avec toutes les commandes"
          onPress={exportAll}
          loading={exporting}
        />
      </ScrollView>
    </View>
  );
}

function ActionRow({
  icon,
  title,
  subtitle,
  onPress,
  loading,
  testID,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  loading?: boolean;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [styles.action, (pressed || loading) && { opacity: 0.85 }]}
    >
      <View style={styles.actionIcon}>
        <Feather name={icon as any} size={18} color={colors.brandPrimary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSub}>{subtitle}</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.brandPrimary} />
      ) : (
        <Feather name="chevron-right" size={20} color={colors.muted} />
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  hello: { fontSize: 12, color: colors.muted, letterSpacing: 0.4 },
  title: { fontSize: 22, fontWeight: "800", color: colors.onSurface, marginTop: 2 },
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
  kpiRow: { flexDirection: "row", gap: 12 },
  kpi: { flex: 1, borderRadius: 16, padding: 14, gap: 6 },
  kpiValue: { fontSize: 26, fontWeight: "800", color: colors.brandPrimary },
  kpiLabel: { fontSize: 12, color: colors.onBrandSecondary, fontWeight: "600" },
  revenueCard: {
    backgroundColor: colors.brandPrimary,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  revenueLabel: { color: colors.onBrandPrimary, opacity: 0.85, fontSize: 12, fontWeight: "600" },
  revenueValue: { color: colors.onBrandPrimary, fontSize: 26, fontWeight: "800", marginTop: 4 },
  revenueIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    letterSpacing: 0.5,
    marginTop: 4,
    marginLeft: 4,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  actionSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
}));
