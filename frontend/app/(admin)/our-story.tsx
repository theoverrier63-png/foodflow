import { useCallback, useEffect, useState } from "react";
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
import { useRouter } from "expo-router";
import Feather from "@react-native-vector-icons/feather";

import { api } from "@/src/api";
import { useToast } from "@/src/toast";
import { pickImageAsDataUrl } from "@/src/image-picker";
import { makeStyles, useTheme } from "@/src/theme";

const MAX_IMAGES = 4;

export default function AdminOurStory() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.getOurStory();
      setTitle(res.title);
      setBody(res.body);
      setImages(res.images);
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function addImage() {
    if (images.length >= MAX_IMAGES) {
      toast.show(`${MAX_IMAGES} images maximum`, "info");
      return;
    }
    try {
      const data = await pickImageAsDataUrl();
      if (data) setImages((prev) => [...prev, data]);
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    }
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  async function save() {
    if (!title.trim()) return toast.show("Titre requis", "error");
    if (!body.trim()) return toast.show("Texte requis", "error");
    try {
      setSaving(true);
      await api.setOurStory(title.trim(), body.trim(), images);
      toast.show("Page mise à jour", "success");
      router.back();
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setSaving(false);
    }
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
        <Text style={styles.headerTitle}>Notre histoire</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: insets.bottom + 120,
            gap: 14,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.intro}>
            Rédigez la page « Notre histoire » que verront vos clients depuis
            l&apos;écran d&apos;accueil du catalogue. Vous pouvez ajouter jusqu&apos;à{" "}
            {MAX_IMAGES} photos : la première sert de bandeau, les autres apparaissent
            sous le texte.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Titre</Text>
            <TextInput
              testID="story-title-input"
              value={title}
              onChangeText={setTitle}
              placeholder="Ex : Notre histoire"
              placeholderTextColor={colors.muted}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Texte</Text>
            <TextInput
              testID="story-body-input"
              value={body}
              onChangeText={setBody}
              placeholder="Racontez l'histoire de Leray-Pointel…"
              placeholderTextColor={colors.muted}
              multiline
              style={[styles.input, { minHeight: 180, textAlignVertical: "top" }]}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Photos ({images.length}/{MAX_IMAGES})</Text>
            {images.length > 0 ? (
              <View style={styles.imagesGrid}>
                {images.map((uri, idx) => (
                  <View
                    key={`${uri.slice(0, 20)}-${idx}`}
                    style={styles.imageCard}
                    testID={`story-image-${idx}`}
                  >
                    <Image source={{ uri }} style={styles.imageThumb} contentFit="cover" />
                    {idx === 0 ? (
                      <View style={styles.coverBadge}>
                        <Text style={styles.coverBadgeTxt}>Bandeau</Text>
                      </View>
                    ) : null}
                    <Pressable
                      testID={`story-remove-image-${idx}`}
                      onPress={() => removeImage(idx)}
                      hitSlop={8}
                      style={styles.removeImg}
                    >
                      <Feather name="x" size={14} color={colors.onError} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
            {images.length < MAX_IMAGES ? (
              <Pressable
                testID="story-add-image"
                onPress={addImage}
                style={styles.picker}
              >
                <Feather name="camera" size={16} color={colors.brandPrimary} />
                <Text style={styles.pickerTxt}>Ajouter une photo</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      )}

      <View style={[styles.stickyCta, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          testID="save-story-btn"
          onPress={save}
          disabled={saving}
          style={({ pressed }) => [styles.cta, (pressed || saving) && { opacity: 0.85 }]}
        >
          {saving ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <Text style={styles.ctaTxt}>Enregistrer</Text>
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
  intro: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: colors.onSurface },
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
  imagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  imageCard: {
    width: "48%",
    aspectRatio: 1,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTertiary,
    position: "relative",
  },
  imageThumb: { width: "100%", height: "100%" },
  coverBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.brandPrimary,
  },
  coverBadgeTxt: {
    color: colors.onBrandPrimary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  removeImg: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
  },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandSecondary,
    marginTop: 4,
  },
  pickerTxt: { fontSize: 14, fontWeight: "700", color: colors.brandPrimary },
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
