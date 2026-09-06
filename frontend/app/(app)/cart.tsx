import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Feather from "@react-native-vector-icons/feather";

import { api, CartItem } from "@/src/api";
import { useAuth } from "@/src/auth-context";
import { useCart } from "@/src/cart-context";
import { useToast } from "@/src/toast";
import { formatQty, parseQty, unitShort } from "@/src/units";
import { makeStyles, useTheme } from "@/src/theme";

const EMPTY_IMG =
  "https://images.unsplash.com/photo-1628102490959-a5b3c905fb9b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NjV8MHwxfHNlYXJjaHwxfHxlbXB0eSUyMGdyb2NlcnklMjBzaG9wcGluZyUyMGJhc2tldHxlbnwwfHx8fDE3ODg1NDgxNzN8MA&ixlib=rb-4.1.0&q=85";

export default function Cart() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { items, inc, dec, remove, setQty, total, clear } = useCart();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const toast = useToast();
  const router = useRouter();

  async function submit() {
    if (!items.length) return;
    if (user?.status === "pending") {
      toast.show("Compte en attente de validation par Leray-Pointel", "error");
      return;
    }
    try {
      setBusy(true);
      await api.createOrder(items, notes.trim());
      clear();
      setNotes("");
      toast.show("Commande envoyée !", "success");
      router.push("/(app)/orders");
    } catch (e: any) {
      toast.show(e?.message || "Erreur de validation", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Panier</Text>
        <Text style={styles.count}>
          {items.length} article{items.length > 1 ? "s" : ""}
        </Text>
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <Image source={{ uri: EMPTY_IMG }} style={styles.emptyImg} contentFit="cover" />
          <Text style={styles.emptyTitle}>Votre panier est vide</Text>
          <Text style={styles.emptySub}>Ajoutez des produits du catalogue.</Text>
          <Pressable
            testID="empty-go-catalog-button"
            style={styles.emptyCta}
            onPress={() => router.push("/(app)")}
          >
            <Text style={styles.emptyCtaTxt}>Voir le catalogue</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <FlatList
            testID="cart-list"
            data={items}
            keyExtractor={(i) => i.product_id + i.sell_unit}
            contentContainerStyle={{
              padding: 16,
              paddingBottom: 300 + insets.bottom,
              gap: 10,
            }}
            ListFooterComponent={
              <View style={styles.notesCard} testID="notes-card">
                <Text style={styles.notesLabel}>Commentaire / spécifications</Text>
                <TextInput
                  testID="order-notes-input"
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Ex : livraison avant 10h, produits bien mûrs…"
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={3}
                  style={styles.notesInput}
                />
              </View>
            }
            renderItem={({ item }) => (
              <CartRow
                item={item}
                onInc={() => inc(item.product_id)}
                onDec={() => dec(item.product_id)}
                onRemove={() => remove(item.product_id)}
                onSet={(q) => setQty(item.product_id, q)}
              />
            )}
          />

          <View style={[styles.summary, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.notice}>
              <Feather name="info" size={14} color={colors.onBrandSecondary} />
              <Text style={styles.noticeTxt}>Paiement hors application (facturation)</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total HT</Text>
              <Text style={styles.totalVal} testID="cart-total">
                {total.toFixed(2)} €
              </Text>
            </View>
            <Pressable
              testID="submit-order-button"
              onPress={submit}
              disabled={busy}
              style={({ pressed }) => [styles.cta, (pressed || busy) && { opacity: 0.85 }]}
            >
              {busy ? (
                <ActivityIndicator color={colors.onBrandPrimary} />
              ) : (
                <Text style={styles.ctaTxt}>Valider la commande</Text>
              )}
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

function CartRow({
  item,
  onInc,
  onDec,
  onRemove,
  onSet,
}: {
  item: CartItem;
  onInc: () => void;
  onDec: () => void;
  onRemove: () => void;
  onSet: (q: number) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [editing, setEditing] = useState(formatQty(item.quantity));

  // Keep the input aligned with the model when steppers change
  React.useEffect(() => {
    setEditing(formatQty(item.quantity));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.quantity]);

  const commit = () => {
    const q = parseQty(editing);
    if (q > 0) onSet(q);
    else setEditing(formatQty(item.quantity));
  };

  return (
    <View style={styles.row} testID={`cart-row-${item.product_id}`}>
      <View style={styles.rowInfo}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowName} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {item.price.toFixed(2)} € / {unitShort(item.sell_unit)} • {item.unit}
          </Text>
        </View>
        <Pressable
          testID={`del-${item.product_id}`}
          onPress={onRemove}
          hitSlop={12}
          style={styles.delBtn}
        >
          <Feather name="trash-2" size={16} color={colors.error} />
        </Pressable>
      </View>

      <View style={styles.rowControls}>
        <View style={styles.stepper}>
          <Pressable
            testID={`dec-${item.product_id}`}
            onPress={onDec}
            hitSlop={12}
            style={styles.stepBtn}
          >
            <Feather name="minus" size={16} color={colors.onSurface} />
          </Pressable>
          <View style={styles.qtyEditWrap}>
            <TextInput
              testID={`qty-${item.product_id}`}
              value={editing}
              onChangeText={setEditing}
              onBlur={commit}
              onSubmitEditing={commit}
              keyboardType={item.sell_unit === "kg" ? "decimal-pad" : "number-pad"}
              selectTextOnFocus
              style={styles.qtyEditInput}
              returnKeyType="done"
            />
            <Text style={styles.qtyEditUnit}>{unitShort(item.sell_unit)}</Text>
          </View>
          <Pressable
            testID={`inc-${item.product_id}`}
            onPress={onInc}
            hitSlop={12}
            style={styles.stepBtn}
          >
            <Feather name="plus" size={16} color={colors.onSurface} />
          </Pressable>
        </View>
        <Text style={styles.rowLineTotal}>
          {(item.price * item.quantity).toFixed(2)} €
        </Text>
      </View>
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
  count: { fontSize: 12, color: colors.muted, marginTop: 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  emptyImg: { width: 180, height: 180, borderRadius: 24, marginBottom: 16, opacity: 0.9 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.onSurface },
  emptySub: { fontSize: 14, color: colors.muted },
  emptyCta: {
    marginTop: 16,
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  emptyCtaTxt: { color: colors.onBrandPrimary, fontWeight: "700" },
  row: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    gap: 10,
  },
  rowInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  rowControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  rowName: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  rowMeta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  rowLineTotal: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.brandPrimary,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: "hidden",
  },
  stepBtn: {
    width: 32,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTertiary,
  },
  qtyEditWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    height: 40,
    minWidth: 60,
    gap: 3,
    backgroundColor: colors.surfaceSecondary,
  },
  qtyEditInput: {
    minWidth: 30,
    textAlign: "center",
    fontWeight: "700",
    fontSize: 14,
    color: colors.onSurface,
    padding: 0,
  },
  qtyEditUnit: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.muted,
  },
  notesCard: {
    marginTop: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    gap: 8,
  },
  notesLabel: { fontSize: 13, fontWeight: "700", color: colors.onSurface },
  notesInput: {
    minHeight: 80,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    fontSize: 14,
    color: colors.onSurface,
    textAlignVertical: "top",
  },
  delBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  summary: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.brandSecondary,
    borderRadius: 10,
    padding: 10,
  },
  noticeTxt: { fontSize: 12, color: colors.onBrandSecondary, fontWeight: "600" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 15, color: colors.muted },
  totalVal: { fontSize: 24, fontWeight: "800", color: colors.onSurface },
  cta: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  ctaTxt: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: "700" },
}));
