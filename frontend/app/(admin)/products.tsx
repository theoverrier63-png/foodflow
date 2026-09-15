import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Switch,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import Feather from "@react-native-vector-icons/feather";

import { api, Product } from "@/src/api";
import { useToast } from "@/src/toast";
import { makeStyles, useTheme } from "@/src/theme";

export default function AdminProducts() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await api.adminProducts();
      setProducts(list);
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

  async function doDelete() {
    if (!confirmDelete) return;
    try {
      setDeleting(true);
      await api.adminDeleteProduct(confirmDelete.id);
      setProducts((prev) => prev.filter((p) => p.id !== confirmDelete.id));
      toast.show("Produit supprimé", "success");
      setConfirmDelete(null);
    } catch (e: any) {
      toast.show(e?.message || "Suppression impossible", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function toggleActive(p: Product) {
    const next = !(p.is_active !== false);
    try {
      setTogglingId(p.id);
      const updated = await api.adminSetProductActive(p.id, next);
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...updated } : x)));
      toast.show(next ? "Produit remis en ligne" : "Produit retiré de la vente", next ? "success" : "info");
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setTogglingId(null);
    }
  }

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
        <Text style={styles.headerTitle}>Catalogue</Text>
        <Pressable
          testID="add-product-btn"
          onPress={() => router.push("/(admin)/product-edit")}
          hitSlop={12}
          style={[styles.iconBtn, { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}
        >
          <Feather name="plus" size={20} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        </View>
      ) : (
        <FlatList
          testID="admin-products-list"
          data={products}
          keyExtractor={(p) => p.id}
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
              <Text style={styles.emptyTxt}>Aucun produit</Text>
            </View>
          }
          renderItem={({ item }) => {
            const active = item.is_active !== false;
            const isToggling = togglingId === item.id;
            return (
              <View
                style={[
                  styles.card,
                  !active && { opacity: 0.55, borderColor: colors.muted },
                ]}
                testID={`admin-product-${item.id}`}
              >
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.cardImg}
                  contentFit="cover"
                  transition={200}
                />
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {!active ? (
                      <View style={styles.offPill}>
                        <Feather name="eye-off" size={9} color={colors.error} />
                        <Text style={styles.offPillTxt}>Retiré</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.meta} numberOfLines={1}>
                    {item.category} • {item.unit}
                  </Text>
                  <Text style={styles.price}>{item.price.toFixed(2)} € HT</Text>
                </View>
                <View style={styles.actionsCol}>
                  <View style={styles.switchWrap}>
                    {isToggling ? (
                      <ActivityIndicator color={colors.brandPrimary} size="small" />
                    ) : (
                      <Switch
                        testID={`toggle-${item.id}`}
                        value={active}
                        onValueChange={() => toggleActive(item)}
                        trackColor={{ false: colors.surfaceTertiary, true: colors.brandPrimary }}
                        thumbColor={colors.surface}
                      />
                    )}
                  </View>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <Pressable
                      testID={`edit-${item.id}`}
                      onPress={() =>
                        router.push({
                          pathname: "/(admin)/product-edit",
                          params: { id: item.id },
                        })
                      }
                      hitSlop={10}
                      style={[styles.actionBtn, { backgroundColor: colors.brandSecondary }]}
                    >
                      <Feather name="edit-2" size={16} color={colors.brandPrimary} />
                    </Pressable>
                    <Pressable
                      testID={`delete-${item.id}`}
                      onPress={() => setConfirmDelete(item)}
                      hitSlop={10}
                      style={[styles.actionBtn, { backgroundColor: "rgba(220,38,38,0.1)" }]}
                    >
                      <Feather name="trash-2" size={16} color={colors.error} />
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      <Modal
        visible={!!confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDelete(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setConfirmDelete(null)}>
          <Pressable style={styles.dialog} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dangerIcon}>
              <Feather name="alert-triangle" size={22} color={colors.error} />
            </View>
            <Text style={styles.dialogTitle}>Supprimer ce produit ?</Text>
            <Text style={styles.dialogSub}>{confirmDelete?.name}</Text>
            <View style={styles.dialogActions}>
              <Pressable
                onPress={() => setConfirmDelete(null)}
                style={[styles.dialogBtn, { backgroundColor: colors.surfaceTertiary }]}
              >
                <Text style={[styles.dialogBtnTxt, { color: colors.onSurface }]}>
                  Annuler
                </Text>
              </Pressable>
              <Pressable
                testID="confirm-delete"
                disabled={deleting}
                onPress={doDelete}
                style={[styles.dialogBtn, { backgroundColor: colors.error }]}
              >
                {deleting ? (
                  <ActivityIndicator color={colors.onError} />
                ) : (
                  <Text style={[styles.dialogBtnTxt, { color: colors.onError }]}>
                    Supprimer
                  </Text>
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
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 8 },
  emptyTxt: { color: colors.muted, fontSize: 14 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardImg: { width: 60, height: 60, borderRadius: 10, backgroundColor: colors.surfaceTertiary },
  name: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  meta: { fontSize: 12, color: colors.muted },
  price: { fontSize: 14, fontWeight: "800", color: colors.brandPrimary, marginTop: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  offPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(220,38,38,0.12)",
  },
  offPillTxt: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.error,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  actionsCol: { alignItems: "flex-end", gap: 6 },
  switchWrap: { alignItems: "flex-end", minHeight: 28, justifyContent: "center" },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    gap: 8,
  },
  dangerIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(220,38,38,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  dialogTitle: { fontSize: 17, fontWeight: "800", color: colors.onSurface },
  dialogSub: { fontSize: 13, color: colors.muted, textAlign: "center" },
  dialogActions: { flexDirection: "row", gap: 10, marginTop: 12, width: "100%" },
  dialogBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  dialogBtnTxt: { fontSize: 14, fontWeight: "700" },
}));
