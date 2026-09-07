import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Feather from "@react-native-vector-icons/feather";

import { api } from "@/src/api";
import { useToast } from "@/src/toast";
import { makeStyles, useTheme } from "@/src/theme";
import PasswordInput from "@/src/components/PasswordInput";

type Reset = {
  id: string;
  user_id: string;
  email: string;
  company_name: string;
  status: string;
  created_at: string;
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
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

export default function AdminResets() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const [resets, setResets] = useState<Reset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Reset | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.adminPasswordResets();
      setResets(list);
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

  async function apply() {
    if (!selected) return;
    if (newPassword.length < 6) {
      toast.show("6 caractères minimum", "error");
      return;
    }
    try {
      setBusy(true);
      await api.adminApplyPasswordReset(selected.id, newPassword);
      toast.show("Mot de passe mis à jour", "success");
      setResets((prev) => prev.filter((r) => r.id !== selected.id));
      setSelected(null);
      setNewPassword("");
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }

  async function dismiss(r: Reset) {
    try {
      await api.adminDismissPasswordReset(r.id);
      setResets((prev) => prev.filter((x) => x.id !== r.id));
      toast.show("Demande écartée", "info");
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    }
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable testID="back-btn" onPress={() => router.back()} hitSlop={16} style={styles.iconBtn}>
          <Feather name="chevron-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Mots de passe oubliés</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        </View>
      ) : (
        <FlatList
          testID="resets-list"
          data={resets}
          keyExtractor={(r) => r.id}
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
              <Feather name="key" size={40} color={colors.muted} />
              <Text style={styles.emptyTxt}>Aucune demande en attente</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card} testID={`reset-${item.id}`}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={styles.name}>{item.company_name || "—"}</Text>
                <Text style={styles.meta}>{item.email}</Text>
                <Text style={styles.metaSub}>{formatDate(item.created_at)}</Text>
              </View>
              <View style={{ gap: 6 }}>
                <Pressable
                  testID={`apply-${item.id}`}
                  onPress={() => { setSelected(item); setNewPassword(""); }}
                  style={[styles.actionBtn, { backgroundColor: colors.brandPrimary }]}
                >
                  <Feather name="check" size={16} color={colors.onBrandPrimary} />
                </Pressable>
                <Pressable
                  testID={`dismiss-${item.id}`}
                  onPress={() => dismiss(item)}
                  style={[styles.actionBtn, { backgroundColor: "rgba(220,38,38,0.1)" }]}
                >
                  <Feather name="x" size={16} color={colors.error} />
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => !busy && setSelected(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => !busy && setSelected(null)}>
          <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.dialogTitle}>Nouveau mot de passe</Text>
            <Text style={styles.dialogSub}>
              Pour <Text style={{ fontWeight: "700" }}>{selected?.email}</Text>. Communiquez-le
              ensuite au client (téléphone, SMS…).
            </Text>
            <PasswordInput
              testID="new-password-input"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="6 caractères minimum"
              style={{ width: "100%" }}
            />
            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => !busy && setSelected(null)}
                style={[styles.dialogBtn, { backgroundColor: colors.surfaceTertiary }]}
              >
                <Text style={[styles.dialogBtnTxt, { color: colors.onSurface }]}>Annuler</Text>
              </Pressable>
              <Pressable
                testID="confirm-new-password"
                disabled={busy}
                onPress={apply}
                style={[styles.dialogBtn, { backgroundColor: colors.brandPrimary }]}
              >
                {busy ? (
                  <ActivityIndicator color={colors.onBrandPrimary} />
                ) : (
                  <Text style={[styles.dialogBtnTxt, { color: colors.onBrandPrimary }]}>Valider</Text>
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
  name: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  meta: { fontSize: 13, color: colors.onSurface },
  metaSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
  actionBtn: {
    width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center",
  },
  backdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", padding: 24,
  },
  dialog: {
    backgroundColor: colors.surface, borderRadius: 20, padding: 24, width: "100%", maxWidth: 400, gap: 10,
  },
  dialogTitle: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
  dialogSub: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  dialogActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  dialogBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  dialogBtnTxt: { fontSize: 14, fontWeight: "700" },
}));
