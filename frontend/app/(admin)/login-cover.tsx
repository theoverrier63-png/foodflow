import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Feather from "@react-native-vector-icons/feather";

import { api } from "@/src/api";
import { useToast } from "@/src/toast";
import { pickImageAsDataUrl } from "@/src/image-picker";
import { makeStyles, useTheme } from "@/src/theme";

export default function AdminLoginCover() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();
  const [current, setCurrent] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.getLoginCover();
      setCurrent(res.image_url);
      setPreview(res.image_url);
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function pick() {
    try {
      const data = await pickImageAsDataUrl();
      if (data) setPreview(data);
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    }
  }

  async function save() {
    if (!preview) return;
    try {
      setBusy(true);
      await api.setLoginCover(preview);
      setCurrent(preview);
      toast.show("Image d'accueil mise à jour", "success");
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    try {
      setBusy(true);
      await api.deleteLoginCover();
      setCurrent(null);
      setPreview(null);
      toast.show("Image d'accueil supprimée", "info");
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setBusy(false);
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
        <Text style={styles.headerTitle}>Photo de connexion</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 32 }}
        >
          <Text style={styles.intro}>
            Photo affichée en haut de l&apos;écran de connexion des clients (Entreprise et
            Particulier). Si vous n&apos;en importez pas, une photo par défaut est utilisée.
          </Text>
          <View style={styles.previewWrap}>
            {preview ? (
              <Image
                source={{ uri: preview }}
                style={styles.preview}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.preview, styles.placeholder]}>
                <Feather name="image" size={36} color={colors.muted} />
                <Text style={styles.placeholderTxt}>Aucune image importée</Text>
              </View>
            )}
          </View>

          <Pressable testID="pick-cover-btn" onPress={pick} style={styles.picker}>
            <Feather name="camera" size={16} color={colors.brandPrimary} />
            <Text style={styles.pickerTxt}>Choisir une image</Text>
          </Pressable>

          <Pressable
            testID="save-cover-btn"
            onPress={save}
            disabled={busy || !preview || preview === current}
            style={({ pressed }) => [
              styles.cta,
              (pressed || busy || !preview || preview === current) && { opacity: 0.5 },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.onBrandPrimary} />
            ) : (
              <Text style={styles.ctaTxt}>Enregistrer</Text>
            )}
          </Pressable>

          {current ? (
            <Pressable
              testID="remove-cover-btn"
              onPress={remove}
              style={styles.dangerBtn}
            >
              <Feather name="trash-2" size={16} color={colors.error} />
              <Text style={styles.dangerTxt}>Rétablir la photo par défaut</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      )}
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
  intro: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  previewWrap: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  preview: { width: "100%", height: 220, backgroundColor: colors.surfaceTertiary },
  placeholder: { alignItems: "center", justifyContent: "center", gap: 8 },
  placeholderTxt: { color: colors.muted, fontSize: 13 },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandSecondary,
  },
  pickerTxt: { fontSize: 14, fontWeight: "700", color: colors.brandPrimary },
  cta: {
    backgroundColor: colors.brandPrimary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  ctaTxt: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: "700" },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.error,
  },
  dangerTxt: { color: colors.error, fontWeight: "700", fontSize: 14 },
}));
