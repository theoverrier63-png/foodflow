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
  Switch,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import Feather from "@react-native-vector-icons/feather";

import { api } from "@/src/api";
import { useToast } from "@/src/toast";
import { pickImageAsDataUrl } from "@/src/image-picker";
import { makeStyles, useTheme } from "@/src/theme";

type Form = {
  name: string;
  category: string;
  subcategory: string;
  origin: string;
  unit: string;
  image_url: string;
  description: string;
  season: "summer" | "winter" | "all";
  sell_by_kg: boolean;
  sell_by_piece: boolean;
};

const EMPTY: Form = {
  name: "",
  category: "Fruits",
  subcategory: "",
  origin: "France",
  unit: "",
  image_url:
    "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=600",
  description: "",
  season: "all",
  sell_by_kg: false,
  sell_by_piece: true,
};

const CATEGORIES = ["Fruits", "Légumes", "Herbes"];

const SEASONS: { key: Form["season"]; label: string; icon: string }[] = [
  { key: "all", label: "Toute l'année", icon: "refresh-cw" },
  { key: "summer", label: "Été", icon: "sun" },
  { key: "winter", label: "Hiver", icon: "cloud-snow" },
];

export default function ProductEdit() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ id?: string }>();
  const editing = !!params.id;

  const [form, setForm] = useState<Form>(EMPTY);
  const [cagetteMode, setCagetteMode] = useState<"none" | "pieces" | "kg">("none");
  const [cagetteContentStr, setCagetteContentStr] = useState("");
  const [subSuggestions, setSubSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);

  // Load subcategory suggestions when the selected category changes
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.subcategories(form.category);
        if (alive) setSubSuggestions(res.by_category[form.category] ?? []);
      } catch {
        if (alive) setSubSuggestions([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [form.category]);

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
          subcategory: (p as any).subcategory ?? "",
          origin: p.origin,
          unit: p.unit,
          image_url: p.image_url,
          description: p.description,
          season: (p.season as any) ?? "all",
          sell_by_kg: (p as any).sell_by_kg ?? (p.sell_unit === "kg"),
          sell_by_piece: (p as any).sell_by_piece ?? (p.sell_unit !== "kg"),
        });
        if (p.cagette_content_pieces != null && p.cagette_content_pieces > 0) {
          setCagetteMode("pieces");
          setCagetteContentStr(String(p.cagette_content_pieces));
        } else if (p.cagette_content_kg != null && p.cagette_content_kg > 0) {
          setCagetteMode("kg");
          setCagetteContentStr(String(p.cagette_content_kg));
        } else {
          setCagetteMode("none");
          setCagetteContentStr("");
        }
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

  function parseFloatSafe(v: string): number | null {
    const n = parseFloat(v.replace(",", ".").trim());
    return isFinite(n) && n > 0 ? n : null;
  }

  async function submit() {
    if (!form.name.trim()) return toast.show("Nom requis", "error");
    if (!form.unit.trim()) return toast.show("Format requis", "error");
    if (!form.image_url.trim()) return toast.show("Image requise", "error");

    let cagette_content_pieces: number | undefined;
    let cagette_content_kg: number | undefined;
    if (cagetteMode === "pieces") {
      const n = parseInt(cagetteContentStr.trim(), 10);
      if (!Number.isFinite(n) || n <= 0)
        return toast.show("Nombre de pièces par cagette invalide", "error");
      if (!form.sell_by_piece)
        return toast.show("Activez la vente à la pièce pour proposer une cagette en pièces", "error");
      cagette_content_pieces = n;
    } else if (cagetteMode === "kg") {
      const n = parseFloatSafe(cagetteContentStr);
      if (n == null)
        return toast.show("Poids par cagette invalide", "error");
      if (!form.sell_by_kg)
        return toast.show("Activez la vente au kilo pour proposer une cagette en kg", "error");
      cagette_content_kg = n;
    }

    if (!form.sell_by_kg && !form.sell_by_piece && cagetteMode === "none") {
      return toast.show("Sélectionnez au moins une unité de vente", "error");
    }

    const payload = {
      ...form,
      subcategory: form.subcategory.trim() || undefined,
      cagette_content_pieces,
      cagette_content_kg,
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
          <Text style={styles.label}>Sous-catégorie (optionnel)</Text>
          <Text style={styles.hint}>
            Regroupe des produits proches dans la catégorie « {form.category} » (ex : « Fruits rouges », « Racines », « Aromatiques »).
          </Text>
          <TextInput
            testID="edit-subcategory"
            value={form.subcategory}
            onChangeText={(v) => set("subcategory", v)}
            placeholder="Laissez vide si aucune"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          {subSuggestions.length > 0 ? (
            <View style={styles.chipsRow}>
              {subSuggestions.map((s) => {
                const active =
                  form.subcategory.trim().toLowerCase() === s.toLowerCase();
                return (
                  <Pressable
                    key={s}
                    testID={`sub-suggest-${s}`}
                    onPress={() => set("subcategory", active ? "" : s)}
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
                        fontSize: 12,
                      }}
                    >
                      {s}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
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
          <Text style={styles.label}>Unités de vente</Text>
          <Text style={styles.hint}>
            Cochez les unités dans lesquelles ce produit peut être commandé. Aucun prix n&apos;est demandé.
          </Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabel}>
              <Feather name="package" size={16} color={colors.brandPrimary} />
              <Text style={styles.toggleTxt}>Vendu au kilo</Text>
            </View>
            <Switch
              testID="toggle-kg"
              value={form.sell_by_kg}
              onValueChange={(v) => set("sell_by_kg", v)}
              trackColor={{ false: colors.surfaceTertiary, true: colors.brandPrimary }}
              thumbColor={colors.surface}
            />
          </View>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLabel}>
              <Feather name="box" size={16} color={colors.brandPrimary} />
              <Text style={styles.toggleTxt}>Vendu à la pièce</Text>
            </View>
            <Switch
              testID="toggle-piece"
              value={form.sell_by_piece}
              onValueChange={(v) => set("sell_by_piece", v)}
              trackColor={{ false: colors.surfaceTertiary, true: colors.brandPrimary }}
              thumbColor={colors.surface}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Cagette (optionnel)</Text>
          <Text style={styles.hint}>
            Indique le contenu d&apos;une cagette. Le client pourra ensuite commander directement en cagettes.
          </Text>
          <View style={styles.chipsRow}>
            {(
              [
                { key: "none", label: "Non proposée", icon: "x" },
                { key: "pieces", label: "En pièces", icon: "box" },
                { key: "kg", label: "En kg", icon: "package" },
              ] as const
            ).map((opt) => {
              const active = cagetteMode === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  testID={`cagette-mode-${opt.key}`}
                  onPress={() => setCagetteMode(opt.key)}
                  style={[
                    styles.chip,
                    { flexDirection: "row", gap: 6 },
                    active
                      ? { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }
                      : { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                  ]}
                >
                  <Feather
                    name={opt.icon as any}
                    size={13}
                    color={active ? colors.onBrandPrimary : colors.onSurface}
                  />
                  <Text
                    style={{
                      color: active ? colors.onBrandPrimary : colors.onSurface,
                      fontWeight: "600",
                      fontSize: 13,
                    }}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {cagetteMode !== "none" ? (
            <View style={[styles.field, { marginTop: 4, gap: 4 }]}>
              <Text style={styles.subLabel}>
                {cagetteMode === "pieces"
                  ? "Nombre de pièces par cagette"
                  : "Poids par cagette (kg)"}
              </Text>
              <TextInput
                testID="edit-cagette-content"
                value={cagetteContentStr}
                onChangeText={setCagetteContentStr}
                keyboardType={cagetteMode === "pieces" ? "number-pad" : "decimal-pad"}
                placeholder={cagetteMode === "pieces" ? "Ex : 24" : "Ex : 5"}
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Saison</Text>
          <Text style={styles.hint}>
            Le produit sera masqué automatiquement hors saison.
          </Text>
          <View style={styles.chipsRow}>
            {SEASONS.map((s) => {
              const active = form.season === s.key;
              return (
                <Pressable
                  key={s.key}
                  testID={`season-${s.key}`}
                  onPress={() => set("season", s.key)}
                  style={[
                    styles.chip,
                    {
                      flexDirection: "row",
                      gap: 6,
                    },
                    active
                      ? { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }
                      : { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                  ]}
                >
                  <Feather
                    name={s.icon as any}
                    size={13}
                    color={active ? colors.onBrandPrimary : colors.onSurface}
                  />
                  <Text
                    style={{
                      color: active ? colors.onBrandPrimary : colors.onSurface,
                      fontWeight: "600",
                      fontSize: 13,
                    }}
                  >
                    {s.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          testID="pick-image-btn"
          onPress={async () => {
            try {
              const data = await pickImageAsDataUrl();
              if (data) set("image_url", data);
            } catch (e: any) {
              toast.show(e?.message || "Erreur", "error");
            }
          }}
          style={({ pressed }) => [styles.photoPicker, pressed && { opacity: 0.85 }]}
        >
          <Feather name="camera" size={16} color={colors.brandPrimary} />
          <Text style={styles.photoPickerTxt}>Choisir une photo depuis la galerie</Text>
        </Pressable>

        <View style={styles.field}>
          <Text style={styles.label}>URL de l&apos;image (optionnel)</Text>
          <TextInput
            testID="edit-image"
            value={form.image_url.startsWith("data:") ? "" : form.image_url}
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
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  toggleLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  toggleTxt: { fontSize: 14, fontWeight: "600", color: colors.onSurface },
  photoPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandSecondary,
  },
  photoPickerTxt: { fontSize: 13, fontWeight: "700", color: colors.brandPrimary },
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
