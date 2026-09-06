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

export default function AdminWatermark() {
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
      const res = await api.getWatermark();
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
      await api.setWatermark(preview);
      setCurrent(preview);
      toast.show("Filigrane mis à jour", "success");
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    try {
      setBusy(true);
      await api.deleteWatermark();
      setCurrent(null);
      setPreview(null);
      toast.show("Filigrane supprimé", "info");
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
        <Text style={styles.headerTitle}>Filigrane catalogue</Text>
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
            Le filigrane est affiché au centre du catalogue, derrière la liste des
            produits, avec une transparence de 6 %. Choisissez de préférence un logo
            simple sur fond transparent (PNG).
          </Text>
          <View style={styles.previewOuter}>
            {preview ? (
              <View style={styles.previewCanvas}>
                <View pointerEvents="none" style={styles.wmContainer}>
                  <Image source={{ uri: preview }} style={styles.wmImg} contentFit="contain" />
                </View>
                {/* Fake catalog line for illustration */}
                <View style={styles.fakeCard}>
                  <View style={styles.fakeThumb} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.fakeLine} />
                    <View style={[styles.fakeLine, { width: "40%", marginTop: 6 }]} />
                  </View>
                </View>
                <View style={styles.fakeCard}>
                  <View style={styles.fakeThumb} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.fakeLine} />
                    <View style={[styles.fakeLine, { width: "40%", marginTop: 6 }]} />
                  </View>
                </View>
              </View>
            ) : (
              <View style={[styles.previewCanvas, styles.placeholder]}>
                <Feather name="image" size={36} color={colors.muted} />
                <Text style={styles.placeholderTxt}>Aucun filigrane importé</Text>
              </View>
            )}
          </View>

          <Pressable testID="pick-wm-btn" onPress={pick} style={styles.picker}>
            <Feather name="camera" size={16} color={colors.brandPrimary} />
            <Text style={styles.pickerTxt}>Choisir une image</Text>
          </Pressable>

          <Pressable
            testID="save-wm-btn"
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
              testID="remove-wm-btn"
              onPress={remove}
              style={styles.dangerBtn}
            >
              <Feather name="trash-2" size={16} color={colors.error} />
              <Text style={styles.dangerTxt}>Supprimer le filigrane actuel</Text>
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
  intro: { fontSize: 13, color: colors.muted, lineHeight: 19 },
  previewOuter: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  previewCanvas: {
    height: 260,
    padding: 14,
    gap: 10,
    position: "relative",
  },
  wmContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.06,
  },
  wmImg: { width: "70%", height: "70%" },
  fakeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fakeThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.surfaceTertiary,
  },
  fakeLine: {
    height: 8,
    borderRadius: 4,
    width: "70%",
    backgroundColor: colors.surfaceTertiary,
  },
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
