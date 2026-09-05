import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Feather from "@react-native-vector-icons/feather";

import { api, User } from "@/src/api";
import { useToast } from "@/src/toast";
import { makeStyles, useTheme } from "@/src/theme";

export default function AdminPending() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await api.adminPending();
      setItems(list);
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function approve(u: User) {
    try {
      setActing(u.id);
      await api.adminApprove(u.id);
      setItems((prev) => prev.filter((x) => x.id !== u.id));
      toast.show(`${u.company_name} approuvé`, "success");
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setActing(null);
    }
  }

  async function reject(u: User) {
    try {
      setActing(u.id);
      await api.adminReject(u.id);
      setItems((prev) => prev.filter((x) => x.id !== u.id));
      toast.show(`${u.company_name} refusé`, "info");
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setActing(null);
    }
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} hitSlop={16} style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Comptes pro en attente</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        </View>
      ) : (
        <FlatList
          testID="pending-list"
          data={items}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />
          }
          ListEmptyComponent={
            <View style={{ padding: 40, alignItems: "center", gap: 8 }}>
              <Feather name="check-circle" size={40} color={colors.muted} />
              <Text style={styles.emptyTxt}>Aucun compte en attente</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card} testID={`pending-${item.id}`}>
              <Text style={styles.company}>{item.company_name}</Text>
              <View style={styles.metaRow}>
                <Feather name="hash" size={11} color={colors.muted} />
                <Text style={styles.meta}>SIRET {item.siret}</Text>
              </View>
              <View style={styles.metaRow}>
                <Feather name="mail" size={11} color={colors.muted} />
                <Text style={styles.meta}>{item.email}</Text>
              </View>
              <View style={styles.metaRow}>
                <Feather name="phone" size={11} color={colors.muted} />
                <Text style={styles.meta}>{item.phone}</Text>
              </View>
              <View style={styles.metaRow}>
                <Feather name="map-pin" size={11} color={colors.muted} />
                <Text style={styles.meta}>{item.delivery_address}</Text>
              </View>
              <View style={styles.actions}>
                <Pressable
                  testID={`reject-${item.id}`}
                  onPress={() => reject(item)}
                  disabled={acting === item.id}
                  style={[styles.actBtn, { borderColor: colors.error }]}
                >
                  <Feather name="x" size={16} color={colors.error} />
                  <Text style={[styles.actTxt, { color: colors.error }]}>Refuser</Text>
                </Pressable>
                <Pressable
                  testID={`approve-${item.id}`}
                  onPress={() => approve(item)}
                  disabled={acting === item.id}
                  style={[styles.actBtn, { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}
                >
                  {acting === item.id ? (
                    <ActivityIndicator color={colors.onBrandPrimary} />
                  ) : (
                    <>
                      <Feather name="check" size={16} color={colors.onBrandPrimary} />
                      <Text style={[styles.actTxt, { color: colors.onBrandPrimary }]}>Approuver</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface,
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  iconBtn: {
    width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary,
  },
  emptyTxt: { color: colors.muted, fontSize: 14 },
  card: {
    backgroundColor: colors.surfaceSecondary, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, gap: 6,
  },
  company: { fontSize: 16, fontWeight: "800", color: colors.onSurface, marginBottom: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  meta: { fontSize: 12, color: colors.muted, flex: 1 },
  actions: { flexDirection: "row", gap: 10, marginTop: 10 },
  actBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 12, borderRadius: 10, borderWidth: 1,
  },
  actTxt: { fontSize: 14, fontWeight: "700" },
}));
