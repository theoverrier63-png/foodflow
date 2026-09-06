import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ScrollView,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Feather from "@react-native-vector-icons/feather";

import { api, Product } from "@/src/api";
import { useAuth } from "@/src/auth-context";
import { priceFor, priceLabelFor, priceModeFor, useCart } from "@/src/cart-context";
import { useToast } from "@/src/toast";
import { formatQty, parseQty, roundQty, unitLabel, unitShort } from "@/src/units";
import { makeStyles, useTheme } from "@/src/theme";

export default function Catalog() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { add } = useCart();
  const toast = useToast();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [cats, setCats] = useState<string[]>(["Tous"]);
  const [selectedCat, setSelectedCat] = useState("Tous");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  async function load() {
    try {
      setError(null);
      const [cs, ps, bn] = await Promise.all([
        api.categories(),
        api.products(),
        api.getBanner().catch(() => ({ image_url: null })),
      ]);
      setCats(cs.categories);
      setProducts(ps);
      setBanner(bn.image_url);
    } catch (e: any) {
      setError(e?.message || "Erreur");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = products;
    if (selectedCat !== "Tous") list = list.filter((p) => p.category === selectedCat);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.origin.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, selectedCat, search]);

  return (
    <View style={styles.root}>
      {/* Sticky Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.hello}>Bonjour</Text>
            <Text style={styles.company} numberOfLines={1}>
              {user?.company_name || "Entreprise"}
            </Text>
          </View>
          <View style={styles.logo}>
            <Feather name="shopping-bag" size={20} color={colors.onBrandPrimary} />
          </View>
        </View>

        <View style={styles.searchBox}>
          <Feather name="search" size={18} color={colors.muted} />
          <TextInput
            testID="catalog-search-input"
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher un produit…"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} hitSlop={12}>
              <Feather name="x" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          style={styles.chipsScroll}
        >
          {cats.map((c) => {
            const active = c === selectedCat;
            return (
              <Pressable
                key={c}
                testID={`cat-chip-${c}`}
                onPress={() => setSelectedCat(c)}
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
                  {c}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Feather name="alert-circle" size={32} color={colors.error} />
          <Text style={styles.errorTxt}>{error}</Text>
          <Pressable style={styles.retry} onPress={load} testID="retry-button">
            <Text style={styles.retryTxt}>Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          testID="products-list"
          data={filtered}
          keyExtractor={(item) => item.id}
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
          ListHeaderComponent={
            <View>
              {banner ? (
                <Image
                  source={{ uri: banner }}
                  style={styles.bannerImg}
                  contentFit="cover"
                  transition={200}
                />
              ) : null}
              {user?.status === "pending" ? (
                <View style={styles.pendingCard} testID="pending-status-banner">
                  <Feather name="clock" size={16} color={colors.onWarning} />
                  <Text style={styles.pendingTxt}>
                    Compte en attente de validation par Leray-Pointel. Vous ne pouvez pas
                    encore passer de commande.
                  </Text>
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <ProductRow
              product={item}
              priceMode={priceModeFor(user)}
              onOpen={() =>
                router.push({
                  pathname: "/(app)/product-detail",
                  params: { id: item.id },
                })
              }
              onAdd={(q) => {
                add(item, q, undefined, priceModeFor(user));
                toast.show(
                  `${item.name} ajouté (${formatQty(q)} ${unitShort(item.sell_unit)})`,
                  "success"
                );
              }}
            />
          )}
        />
      )}
    </View>
  );
}

function ProductRow({
  product,
  priceMode,
  onAdd,
  onOpen,
}: {
  product: Product;
  priceMode: "ht" | "ttc";
  onAdd: (quantity: number) => void;
  onOpen: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [qtyStr, setQtyStr] = React.useState(product.sell_unit === "kg" ? "1" : "1");
  const displayPrice = priceFor(product, product.sell_unit, priceMode) ?? product.price;

  const submit = () => {
    const q = roundQty(parseQty(qtyStr), product.sell_unit);
    if (q <= 0) return;
    onAdd(q);
    setQtyStr(product.sell_unit === "kg" ? "1" : "1");
  };

  return (
    <View style={styles.card} testID={`product-card-${product.id}`}>
      <Pressable
        testID={`open-${product.id}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.cardTapArea, pressed && { opacity: 0.85 }]}
      >
        <Image
          source={{ uri: product.image_url }}
          style={styles.cardImg}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={1}>
            {product.name}
          </Text>
          <View style={styles.cardMetaRow}>
            <Feather name="map-pin" size={11} color={colors.muted} />
            <Text style={styles.cardMeta}>{product.origin}</Text>
            <View style={styles.dot} />
            <Text style={styles.cardMeta}>{product.unit}</Text>
          </View>
          <Text style={styles.cardPrice}>
            {displayPrice.toFixed(2)} € {priceLabelFor(priceMode)}
            <Text style={styles.cardPriceUnit}> / {unitLabel(product.sell_unit)}</Text>
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={colors.muted} />
      </Pressable>

      <View style={styles.qtyRow}>
        <View style={styles.qtyInputWrap}>
          <TextInput
            testID={`qty-${product.id}`}
            value={qtyStr}
            onChangeText={setQtyStr}
            keyboardType={product.sell_unit === "kg" ? "decimal-pad" : "number-pad"}
            selectTextOnFocus
            style={styles.qtyInput}
            onSubmitEditing={submit}
            returnKeyType="done"
          />
          <Text style={styles.qtyUnit}>{unitShort(product.sell_unit)}</Text>
        </View>
        <Pressable
          testID={`add-${product.id}`}
          onPress={submit}
          hitSlop={8}
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.85 }]}
        >
          <Feather name="plus" size={16} color={colors.onBrandPrimary} />
          <Text style={styles.addBtnTxt}>Ajouter</Text>
        </Pressable>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  hello: { fontSize: 12, color: colors.muted, letterSpacing: 0.4 },
  company: { fontSize: 20, fontWeight: "800", color: colors.onSurface, maxWidth: 250 },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, color: colors.onSurface, fontSize: 15 },
  chipsScroll: { marginTop: 12, marginHorizontal: -16 },
  chipsRow: { gap: 8, paddingHorizontal: 16, alignItems: "center", height: 56 },
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorTxt: { color: colors.onSurface, fontSize: 14 },
  retry: {
    backgroundColor: colors.brandPrimary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
  },
  retryTxt: { color: colors.onBrandPrimary, fontWeight: "700" },
  emptyWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 8 },
  emptyTxt: { color: colors.muted, fontSize: 14 },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  bannerImg: {
    width: "100%",
    height: 140,
    borderRadius: 14,
    marginBottom: 12,
    backgroundColor: colors.surfaceTertiary,
  },
  pendingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.warning,
    marginBottom: 12,
  },
  pendingTxt: { color: colors.onWarning, fontSize: 12, fontWeight: "600", flex: 1 },
  cardTapArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cardImg: { width: 68, height: 68, borderRadius: 12, backgroundColor: colors.surfaceTertiary },
  cardBody: { flex: 1, gap: 4 },
  cardName: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  cardMetaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardMeta: { fontSize: 12, color: colors.muted },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.muted },
  cardPrice: { fontSize: 15, fontWeight: "800", color: colors.brandPrimary, marginTop: 2 },
  cardPriceUnit: { fontSize: 12, fontWeight: "600", color: colors.muted },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  qtyInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    height: 36,
    gap: 4,
    minWidth: 72,
  },
  qtyInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: colors.onSurface,
    padding: 0,
    minWidth: 30,
  },
  qtyUnit: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.brandPrimary,
  },
  addBtnTxt: {
    color: colors.onBrandPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
}));
