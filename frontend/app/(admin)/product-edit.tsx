import { useEffect, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Feather from "@react-native-vector-icons/feather";

import { api, Product } from "@/src/api";
import { useToast } from "@/src/toast";
import { makeStyles, useTheme } from "@/src/theme";

type Form = {
  name: string;
  category: string;
  origin: string;
  unit: string;
  image_url: string;
  description: string;
};

const EMPTY: Form = {
  name: "",
  category: "Fruits",
  origin: "France",
  unit: "",
  image_url:
    "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=600",
  description: "",
};

const CATEGORIES = ["Fruits", "Légumes", "Herbes"];

export default function ProductEdit() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ id?: string }>();
  const editing = !!params.id;

  const [form, setForm] = useState<Form>(EMPTY);
  const [priceKgStr, setPriceKgStr] = useState("");
  const [pricePieceStr, setPricePieceStr] = useState("");
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    (async () => {
      try {
        const list = await api.products();
        const p = list.find((x) => x.id === params.id);
        if (!p) {
          toast.show("Produit introuvable", "error");
          router.back();
          return;
        }
        setForm({
          name: p.name,
          category: p.category,
          origin: p.origin,
          unit: p.unit,
          image_url: p.image_url,
          description: p.description,
        });
        setPriceKgStr(p.price_kg != null ? String(p.price_kg) : "");
        setPricePieceStr(p.price_piece != null ? String(p.price_piece) : "");
      } catch (e: any) {
        toast.show(e?.message || "Erreur", "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [editing, params.id, router, toast]);

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function parsePrice(v: string): number | null {
    const n = parseFloat(v.replace(",", ".").trim());
    return isFinite(n) && n > 0 ? n : null;
  }

  async function submit() {
    const priceKg = parsePrice(priceKgStr);
    const pricePiece = parsePrice(pricePieceStr);
    if (!form.name.trim()) return toast.show("Nom requis", "error");
    if (!form.unit.trim()) return toast.show("Format requis", "error");
    if (priceKg == null && pricePiece == null)
      return toast.show("Saisissez au moins un prix (kg ou pièce)", "error");
    if (!form.image_url.trim()) return toast.show("Image requise", "error");
    const payload = {
      ...form,
      price_kg: priceKg ?? undefined,
      price_piece: pricePiece ?? undefined,
    };
    try {
      setSaving(true);
      if (editing && params.id) {
        await api.adminUpdateProduct(params.id, payload as any);
        toast.show("Produit mis à jour", "success");
      } else {
        await api.adminCreateProduct(payload as any);
        toast.show("Produit créé", "success");
      }
      router.back();
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.brandPrimary} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          testID="back-btn"
          onPress={() => router.back()}
          hitSlop={16}
          style={styles.iconBtn}
        >
          <Feather name="chevron-left" size={22} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {editing ? "Modifier produit" : "Nouveau produit"}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 120,
          gap: 14,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image source={{ uri: form.image_url }} style={styles.preview} contentFit="cover" />

        <View style={styles.field}>
          <Text style={styles.label}>Nom du produit</Text>
          <TextInput
            testID="edit-name"
            value={form.name}
            onChangeText={(v) => set("name", v)}
            placeholder="Ex : Pommes Gala"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Catégorie</Text>
          <View style={styles.chipsRow}>
            {CATEGORIES.map((c) => {
              const active = form.category === c;
              return (
                <Pressable
                  key={c}
                  testID={`cat-${c}`}
                  onPress={() => set("category", c)}
                  style={[
                    styles.chip,
                    active
                      ? { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }
                      : { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? colors.onBrandPrimary : colors.onSurface,
                      fontWeight: "600",
                      fontSize: 13,
                    }}
                  >
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Origine</Text>
          <TextInput
            testID="edit-origin"
            value={form.origin}
            onChangeText={(v) => set("origin", v)}
            placeholder="Ex : France"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Format (info)</Text>
          <TextInput
            testID="edit-unit"
            value={form.unit}
            onChangeText={(v) => set("unit", v)}
            placeholder="Ex : Cagette 5kg, Botte, Pièce…"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Prix HT</Text>
          <Text style={styles.hint}>
            Renseignez au moins un prix. Laissez vide l'unité non applicable.
          </Text>
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1, gap: 4 }]}>
              <Text style={styles.subLabel}>Au kilo (€/kg)</Text>
              <TextInput
                testID="edit-price-kg"
                value={priceKgStr}
                onChangeText={setPriceKgStr}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>
            <View style={[styles.field, { flex: 1, gap: 4 }]}>
              <Text style={styles.subLabel}>À la pièce (€/pce)</Text>
              <TextInput
                testID="edit-price-piece"
                value={pricePieceStr}
                onChangeText={setPricePieceStr}
                keyboardType="decimal-pad"
                placeholder="—"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>URL de l'image</Text>
          <TextInput
            testID="edit-image"
            value={form.image_url}
            onChangeText={(v) => set("image_url", v)}
            autoCapitalize="none"
            placeholder="https://…"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            testID="edit-description"
            value={form.description}
            onChangeText={(v) => set("description", v)}
            placeholder="Détails du produit…"
            placeholderTextColor={colors.muted}
            multiline
            style={[styles.input, { minHeight: 80, textAlignVertical: "top" }]}
          />
        </View>
      </ScrollView>

      <View style={[styles.stickyCta, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          testID="save-product-btn"
          onPress={submit}
          disabled={saving}
          style={({ pressed }) => [
            styles.cta,
            (pressed || saving) && { opacity: 0.85 },
          ]}
        >
          {saving ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <Text style={styles.ctaTxt}>{editing ? "Enregistrer" : "Créer le produit"}</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
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
  preview: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    backgroundColor: colors.surfaceTertiary,
  },
  field: { gap: 6 },
  row: { flexDirection: "row", gap: 12 },
  label: { fontSize: 13, fontWeight: "600", color: colors.onSurface },
  subLabel: { fontSize: 12, fontWeight: "500", color: colors.muted },
  hint: { fontSize: 11, color: colors.muted, marginTop: -2 },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.onSurface,
  },
  chipsRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
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
    backgroundColor: colors.brandPrimary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  ctaTxt: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: "700" },
}));
