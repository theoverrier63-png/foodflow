import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Feather from "@react-native-vector-icons/feather";

import { api, Product } from "@/src/api";
import { useAuth } from "@/src/auth-context";
import { availableUnits, priceFor, priceLabelFor, priceModeFor, useCart } from "@/src/cart-context";
import { useToast } from "@/src/toast";
import { formatQty, parseQty, roundQty, SellUnit, stepFor, unitLabel, unitShort } from "@/src/units";
import { makeStyles, useTheme } from "@/src/theme";

export default function ProductDetail() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ id?: string }>();
  const { add } = useCart();
  const { user } = useAuth();
  const priceMode = priceModeFor(user);
  const priceLabel = priceLabelFor(priceMode);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [qtyStr, setQtyStr] = useState("1");
  const [selectedUnit, setSelectedUnit] = useState<SellUnit | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    (async () => {
      try {
        const p = await api.getProduct(params.id!);
        setProduct(p);
        // Preselect the product's default unit if available, else the only one that is
        const units = availableUnits(p);
        setSelectedUnit(units.includes(p.sell_unit) ? p.sell_unit : units[0] ?? null);
      } catch (e: any) {
        toast.show(e?.message || "Produit introuvable", "error");
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [params.id, router, toast]);

  if (loading || !product || !selectedUnit) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </View>
    );
  }

  const units = availableUnits(product);
  const price = priceFor(product, selectedUnit, priceMode) ?? 0;
  const step = stepFor(selectedUnit);
  const qNum = roundQty(parseQty(qtyStr), selectedUnit);
  const lineTotal = Math.round(qNum * price * 100) / 100;

  const bumpQty = (delta: number) => {
    const next = roundQty(Math.max(0, qNum + delta), selectedUnit);
    setQtyStr(next > 0 ? formatQty(next) : "0");
  };

  const chooseUnit = (u: SellUnit) => {
    if (!units.includes(u)) {
      const other = u === "kg" ? "à la pièce" : "au kilo";
      toast.show(`Ce produit est vendu ${other} uniquement`, "info");
      return;
    }
    setSelectedUnit(u);
    // Reset quantity to a sensible default when switching (e.g. 1)
    setQtyStr("1");
  };

  const handleAdd = () => {
    if (qNum <= 0) {
      toast.show("Saisissez une quantité", "error");
      return;
    }
    setAdding(true);
    add(product, qNum, selectedUnit, priceMode);
    toast.show(
      `${product.name} : ${formatQty(qNum)} ${unitShort(selectedUnit)} ajouté(s)`,
      "success"
    );
    setTimeout(() => {
      setAdding(false);
      router.back();
    }, 250);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero image with back */}
        <View style={styles.hero}>
          <Image source={{ uri: product.image_url }} style={styles.heroImg} contentFit="cover" />
          <LinearGradient
            colors={["rgba(17,24,39,0.35)", "rgba(17,24,39,0)"]}
            style={styles.heroTop}
          />
          <View style={[styles.heroBar, { paddingTop: insets.top + 12 }]}>
            <Pressable
              testID="back-btn"
              onPress={() => router.back()}
              hitSlop={16}
              style={styles.iconBtn}
            >
              <Feather name="chevron-left" size={22} color={colors.onSurface} />
            </Pressable>
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>{product.category}</Text>
            </View>
          </View>
        </View>

        {/* Info */}
        <View style={styles.body}>
          <Text style={styles.name} testID="detail-name">
            {product.name}
          </Text>
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={13} color={colors.muted} />
            <Text style={styles.meta}>{product.origin}</Text>
            <View style={styles.dot} />
            <Text style={styles.meta}>{product.unit}</Text>
          </View>
          {selectedUnit === "kg" ? (
            <Text style={styles.price} testID="detail-price">
              {price.toFixed(2)} € {priceLabel}
              <Text style={styles.priceUnit}> / {unitLabel(selectedUnit)}</Text>
            </Text>
          ) : (
            <Text style={styles.pricePiece} testID="detail-price-piece">
              Prix à la pièce sur devis
            </Text>
          )}

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>
              {product.description || "Aucune description disponible pour ce produit."}
            </Text>
          </View>

          {/* Unit choice */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Unité de vente</Text>
            <View style={styles.unitRow}>
              <UnitChip
                testID="unit-kg"
                icon="package"
                label="Au kilo"
                price={priceFor(product, "kg", priceMode)}
                showPrice
                active={selectedUnit === "kg"}
                available={units.includes("kg")}
                onPress={() => chooseUnit("kg")}
              />
              <UnitChip
                testID="unit-piece"
                icon="box"
                label="À la pièce"
                price={priceFor(product, "piece", priceMode)}
                showPrice={false}
                active={selectedUnit === "piece"}
                available={units.includes("piece")}
                onPress={() => chooseUnit("piece")}
              />
            </View>
            <Text style={styles.unitHint}>
              {units.length === 2
                ? "Choisissez l'unité qui vous convient."
                : `Ce produit est vendu ${selectedUnit === "kg" ? "au kilo" : "à la pièce"}.`}
            </Text>
          </View>

          {/* Quantity */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quantité</Text>
            <View style={styles.qtyRow}>
              <Pressable
                testID="qty-dec"
                onPress={() => bumpQty(-step)}
                hitSlop={12}
                style={styles.qtyStep}
              >
                <Feather name="minus" size={18} color={colors.onSurface} />
              </Pressable>
              <View style={styles.qtyInputWrap}>
                <TextInput
                  testID="detail-qty-input"
                  value={qtyStr}
                  onChangeText={setQtyStr}
                  selectTextOnFocus
                  keyboardType={selectedUnit === "kg" ? "decimal-pad" : "number-pad"}
                  style={styles.qtyInput}
                  returnKeyType="done"
                />
                <Text style={styles.qtyUnit}>{unitShort(selectedUnit)}</Text>
              </View>
              <Pressable
                testID="qty-inc"
                onPress={() => bumpQty(step)}
                hitSlop={12}
                style={styles.qtyStep}
              >
                <Feather name="plus" size={18} color={colors.onSurface} />
              </Pressable>
            </View>
            {selectedUnit === "kg" ? (
              <View style={styles.subtotal}>
                <Text style={styles.subtotalLabel}>Sous-total {priceLabel}</Text>
                <Text style={styles.subtotalVal} testID="detail-subtotal">
                  {lineTotal.toFixed(2)} €
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.stickyCta, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          testID="detail-add-to-cart"
          onPress={handleAdd}
          disabled={adding}
          style={({ pressed }) => [styles.cta, (pressed || adding) && { opacity: 0.85 }]}
        >
          {adding ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <>
              <Feather name="shopping-cart" size={18} color={colors.onBrandPrimary} />
              <Text style={styles.ctaTxt}>
                {selectedUnit === "kg"
                  ? `Ajouter au panier • ${lineTotal.toFixed(2)} €`
                  : "Ajouter au panier"}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function UnitChip({
  icon,
  label,
  price,
  showPrice = true,
  active,
  available,
  onPress,
  testID,
}: {
  icon: string;
  label: string;
  price?: number | null;
  showPrice?: boolean;
  active: boolean;
  available: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const fg = !available ? colors.muted : active ? colors.onBrandPrimary : colors.onSurface;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.unitChip,
        active
          ? { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }
          : { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
        !available && { opacity: 0.55 },
        pressed && { opacity: 0.8 },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Feather name={icon as any} size={15} color={fg} />
        <Text style={[styles.unitChipTxt, { color: fg }]}>{label}</Text>
        {active ? <Feather name="check" size={14} color={fg} /> : null}
      </View>
      {showPrice ? (
        <Text style={[styles.unitChipPrice, { color: fg }]}>
          {available && price != null ? `${price.toFixed(2)} €` : "—"}
        </Text>
      ) : (
        <Text style={[styles.unitChipPrice, { color: fg, fontSize: 11, fontWeight: "600" }]}>
          {available ? "sur devis" : "—"}
        </Text>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 300, width: "100%", position: "relative" },
  heroImg: { width: "100%", height: "100%" },
  heroTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 150,
  },
  heroBar: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  badgeTxt: { fontSize: 11, fontWeight: "800", color: colors.onSurface, letterSpacing: 0.6 },
  body: { padding: 20, gap: 8 },
  name: { fontSize: 26, fontWeight: "800", color: colors.onSurface },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  meta: { fontSize: 13, color: colors.muted },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.muted },
  price: { fontSize: 22, fontWeight: "800", color: colors.brandPrimary, marginTop: 8 },
  priceUnit: { fontSize: 14, fontWeight: "600", color: colors.muted },
  pricePiece: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.muted,
    marginTop: 8,
    fontStyle: "italic",
  },

  section: { marginTop: 16, gap: 10 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 14,
    color: colors.onSurface,
    lineHeight: 21,
  },

  unitRow: { flexDirection: "row", gap: 10 },
  unitChip: {
    flex: 1,
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 62,
  },
  unitChipTxt: { fontSize: 14, fontWeight: "700" },
  unitChipPrice: { fontSize: 13, fontWeight: "800" },
  unitHint: { fontSize: 12, color: colors.muted, marginTop: -2 },

  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  qtyStep: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTertiary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qtyInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    height: 48,
    backgroundColor: colors.surfaceSecondary,
  },
  qtyInput: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.onSurface,
    textAlign: "center",
    minWidth: 60,
    padding: 0,
  },
  qtyUnit: { fontSize: 14, fontWeight: "700", color: colors.muted },

  subtotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.brandSecondary,
  },
  subtotalLabel: { fontSize: 13, fontWeight: "700", color: colors.onBrandSecondary },
  subtotalVal: { fontSize: 20, fontWeight: "800", color: colors.brandPrimary },

  stickyCta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.brandPrimary,
    paddingVertical: 15,
    borderRadius: 12,
  },
  ctaTxt: { color: colors.onBrandPrimary, fontSize: 15, fontWeight: "700" },
}));
