import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Feather from "@react-native-vector-icons/feather";

import { api, User } from "@/src/api";
import { useToast } from "@/src/toast";
import { makeStyles, useTheme } from "@/src/theme";

type Row = User & { created_at?: string | null };

type StatusFilter = "all" | "approved" | "pending" | "rejected";

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function statusMeta(s: string | null | undefined, colors: any) {
  switch (s) {
    case "approved":
      return { label: "Actif", bg: colors.brandSecondary, fg: colors.onBrandSecondary };
    case "pending":
      return { label: "En attente", bg: colors.brandTertiary, fg: colors.onBrandTertiary };
    case "rejected":
      return { label: "Accès retiré", bg: "rgba(220,38,38,0.1)", fg: colors.error };
    default:
      return { label: s ?? "—", bg: colors.surfaceTertiary, fg: colors.muted };
  }
}

export default function AdminClients() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const [users, setUsers] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [target, setTarget] = useState<Row | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.adminBusinessUsers();
      setUsers(list as Row[]);
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

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered =
    filter === "all" ? users : users.filter((u) => (u.status ?? "approved") === filter);

  const counts = {
    all: users.length,
    approved: users.filter((u) => u.status === "approved").length,
    pending: users.filter((u) => u.status === "pending").length,
    rejected: users.filter((u) => u.status === "rejected").length,
  };

  async function revoke(u: Row) {
    try {
      setBusy(true);
      const updated = await api.adminRevokeUser(u.id);
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
      toast.show("Accès retiré", "info");
      setTarget(null);
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }

  async function restore(u: Row) {
    try {
      setBusy(true);
      const updated = await api.adminRestoreUser(u.id);
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
      toast.show("Accès rétabli", "success");
      setTarget(null);
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteUser(u: Row) {
    try {
      setBusy(true);
      await api.adminDeleteUser(u.id);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      toast.show("Compte supprimé", "info");
      setConfirmDelete(null);
      setTarget(null);
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} hitSlop={16} style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Clients professionnels</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabs}>
        {(["all", "approved", "pending", "rejected"] as StatusFilter[]).map((s) => {
          const active = filter === s;
          const label = s === "all" ? "Tous" : statusMeta(s, colors).label;
          return (
            <Pressable
              key={s}
              testID={`client-tab-${s}`}
              onPress={() => setFilter(s)}
              style={[
                styles.tab,
                active && { backgroundColor: colors.surface, borderColor: colors.brandPrimary },
              ]}
            >
              <Text
                style={[
                  styles.tabTxt,
                  { color: active ? colors.brandPrimary : colors.muted },
                ]}
                numberOfLines={1}
              >
                {label} ({counts[s]})
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        </View>
      ) : (
        <FlatList
          testID="clients-list"
          data={filtered}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.brandPrimary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Feather name="users" size={40} color={colors.muted} />
              <Text style={styles.emptyTxt}>Aucun client dans cette catégorie</Text>
            </View>
          }
          renderItem={({ item }) => {
            const sm = statusMeta(item.status, colors);
            return (
              <Pressable
                testID={`client-${item.id}`}
                onPress={() => setTarget(item)}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.rowHead}>
                    <Text style={styles.company} numberOfLines={1}>
                      {item.company_name || "—"}
                    </Text>
                    <View style={[styles.statusPill, { backgroundColor: sm.bg }]}>
                      <Text style={[styles.statusPillTxt, { color: sm.fg }]}>{sm.label}</Text>
                    </View>
                  </View>
                  {item.siret ? (
                    <Text style={styles.metaLine}>
                      <Feather name="hash" size={11} color={colors.muted} />{" "}
                      SIRET : {item.siret}
                    </Text>
                  ) : null}
                  <Text style={styles.metaLine}>
                    <Feather name="mail" size={11} color={colors.muted} />{" "}
                    {item.email}
                  </Text>
                  <Text style={styles.metaLine}>
                    <Feather name="calendar" size={11} color={colors.muted} />{" "}
                    Inscrit le {formatDate(item.created_at)}
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.muted} />
              </Pressable>
            );
          }}
        />
      )}

      {/* Actions modal */}
      <Modal
        visible={!!target}
        transparent
        animationType="fade"
        onRequestClose={() => !busy && setTarget(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => !busy && setTarget(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {target?.company_name || "Compte"}
            </Text>
            <Text style={styles.sheetSub}>{target?.email}</Text>
            {target?.status === "rejected" ? (
              <Pressable
                testID="restore-btn"
                onPress={() => target && restore(target)}
                disabled={busy}
                style={[styles.sheetAction, { backgroundColor: colors.brandPrimary }]}
              >
                <Feather name="user-check" size={16} color={colors.onBrandPrimary} />
                <Text style={[styles.sheetActionTxt, { color: colors.onBrandPrimary }]}>
                  Rétablir l&apos;accès
                </Text>
              </Pressable>
            ) : (
              <Pressable
                testID="revoke-btn"
                onPress={() => target && revoke(target)}
                disabled={busy}
                style={[styles.sheetAction, { backgroundColor: colors.brandTertiary }]}
              >
                <Feather name="user-x" size={16} color={colors.onBrandTertiary} />
                <Text style={[styles.sheetActionTxt, { color: colors.onBrandTertiary }]}>
                  Retirer l&apos;accès
                </Text>
              </Pressable>
            )}
            <Pressable
              testID="delete-btn"
              onPress={() => target && setConfirmDelete(target)}
              disabled={busy}
              style={[styles.sheetAction, { backgroundColor: "rgba(220,38,38,0.1)" }]}
            >
              <Feather name="trash-2" size={16} color={colors.error} />
              <Text style={[styles.sheetActionTxt, { color: colors.error }]}>
                Supprimer définitivement
              </Text>
            </Pressable>
            <Pressable
              onPress={() => !busy && setTarget(null)}
              style={[styles.sheetAction, { backgroundColor: colors.surfaceTertiary }]}
            >
              <Text style={[styles.sheetActionTxt, { color: colors.onSurface }]}>Annuler</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => !busy && setConfirmDelete(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => !busy && setConfirmDelete(null)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dangerIcon}>
              <Feather name="alert-triangle" size={22} color={colors.error} />
            </View>
            <Text style={styles.sheetTitle}>Supprimer ce compte ?</Text>
            <Text style={styles.sheetSub}>
              Le compte de <Text style={{ fontWeight: "700" }}>{confirmDelete?.company_name}</Text> sera
              supprimé. Les commandes passées sont anonymisées mais conservées.
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
              <Pressable
                onPress={() => !busy && setConfirmDelete(null)}
                style={[styles.sheetAction, { flex: 1, backgroundColor: colors.surfaceTertiary }]}
              >
                <Text style={[styles.sheetActionTxt, { color: colors.onSurface }]}>Annuler</Text>
              </Pressable>
              <Pressable
                testID="confirm-delete-client"
                onPress={() => confirmDelete && deleteUser(confirmDelete)}
                disabled={busy}
                style={[styles.sheetAction, { flex: 1, backgroundColor: colors.error }]}
              >
                {busy ? (
                  <ActivityIndicator color={colors.onError} />
                ) : (
                  <Text style={[styles.sheetActionTxt, { color: colors.onError }]}>Supprimer</Text>
                )}
              </Pressable>
            </View>
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
    width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary,
  },
  tabs: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  tabTxt: { fontSize: 12, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 10 },
  emptyTxt: { color: colors.muted, fontSize: 14 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowHead: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  company: { fontSize: 15, fontWeight: "800", color: colors.onSurface, flexShrink: 1 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusPillTxt: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3, textTransform: "uppercase" },
  metaLine: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 24,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 22,
    width: "100%",
    maxWidth: 420,
    gap: 10,
  },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
  sheetSub: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  sheetAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 4,
  },
  sheetActionTxt: { fontSize: 14, fontWeight: "700" },
  dangerIcon: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(220,38,38,0.1)",
    alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 4,
  },
}));
