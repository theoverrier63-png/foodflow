import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Feather from "@react-native-vector-icons/feather";

import { api } from "@/src/api";
import { useToast } from "@/src/toast";
import { makeStyles, useTheme } from "@/src/theme";

type Season = "summer" | "winter" | "all";

const OPTIONS: { key: Season; label: string; description: string; icon: string }[] = [
  {
    key: "all",
    label: "Toute l'année",
    description:
      "Affiche tous les produits, même ceux marqués été ou hiver. À utiliser en période de transition.",
    icon: "refresh-cw",
  },
  {
    key: "summer",
    label: "Été",
    description:
      "Affiche les produits « toute l'année » et « été » uniquement. Les produits d'hiver sont masqués du catalogue.",
    icon: "sun",
  },
  {
    key: "winter",
    label: "Hiver",
    description:
      "Affiche les produits « toute l'année » et « hiver » uniquement. Les produits d'été sont masqués du catalogue.",
    icon: "cloud-snow",
  },
];

export default function AdminSeason() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const [current, setCurrent] = useState<Season | null>(null);
  const [saving, setSaving] = useState<Season | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.getSeason();
        setCurrent(res.season);
      } catch (e: any) {
        toast.show(e?.message || "Erreur", "error");
      }
    })();
  }, [toast]);

  async function choose(s: Season) {
    if (current === s) return;
    try {
      setSaving(s);
      await api.setSeason(s);
      setCurrent(s);
      toast.show("Saison mise à jour", "success");
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setSaving(null);
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
        <Text style={styles.headerTitle}>Saison en cours</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 32,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          La saison sélectionnée détermine les produits visibles dans le catalogue
          client. Les produits marqués « toute l'année » sont toujours affichés.
        </Text>

        {current == null ? (
          <View style={{ paddingVertical: 40, alignItems: "center" }}>
            <ActivityIndicator color={colors.brandPrimary} />
          </View>
        ) : (
          OPTIONS.map((opt) => {
            const active = current === opt.key;
            const isSaving = saving === opt.key;
            return (
              <Pressable
                key={opt.key}
                testID={`season-opt-${opt.key}`}
                onPress={() => choose(opt.key)}
                disabled={!!saving}
                style={({ pressed }) => [
                  styles.card,
                  active && { borderColor: colors.brandPrimary, backgroundColor: colors.brandSecondary },
                  pressed && { opacity: 0.9 },
                ]}
              >
                <View
                  style={[
                    styles.cardIcon,
                    active
                      ? { backgroundColor: colors.brandPrimary }
                      : { backgroundColor: colors.surfaceTertiary },
                  ]}
                >
                  <Feather
                    name={opt.icon as any}
                    size={20}
                    color={active ? colors.onBrandPrimary : colors.brandPrimary}
                  />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.titleRow}>
                    <Text style={styles.cardTitle}>{opt.label}</Text>
                    {active ? (
                      <View style={styles.activePill}>
                        <Feather name="check" size={11} color={colors.onBrandPrimary} />
                        <Text style={styles.activePillTxt}>En cours</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.cardDesc}>{opt.description}</Text>
                </View>
                {isSaving ? (
                  <ActivityIndicator color={colors.brandPrimary} />
                ) : (
                  <Feather
                    name={active ? "check-circle" : "circle"}
                    size={22}
                    color={active ? colors.brandPrimary : colors.muted}
                  />
                )}
              </Pressable>
            );
          })
        )}
      </ScrollView>
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
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: colors.onSurface },
  cardDesc: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: colors.brandPrimary,
  },
  activePillTxt: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.onBrandPrimary,
    letterSpacing: 0.4,
  },
}));
