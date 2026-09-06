import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Feather from "@react-native-vector-icons/feather";

import { api } from "@/src/api";
import { useToast } from "@/src/toast";
import { makeStyles, useTheme } from "@/src/theme";

export default function OurStory() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const toast = useToast();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
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
    })();
  }, [toast]);

  return (
    <View style={styles.root}>
      {loading ? (
        <View style={[styles.root, { alignItems: "center", justifyContent: "center" }]}>
          <ActivityIndicator color={colors.brandPrimary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            {images[0] ? (
              <Image
                source={{ uri: images[0] }}
                style={styles.heroImg}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.heroImg, styles.heroPlaceholder]}>
                <Feather name="image" size={48} color={colors.muted} />
              </View>
            )}
            <LinearGradient
              colors={["rgba(17,24,39,0.2)", "rgba(17,24,39,0.85)"]}
              style={styles.heroScrim}
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
            </View>
            <View style={styles.heroContent}>
              <View style={styles.brandTag}>
                <Feather name="shopping-bag" size={12} color={colors.onBrand} />
                <Text style={styles.brandTagTxt}>LERAY-POINTEL</Text>
              </View>
              <Text style={styles.title} testID="story-title">
                {title}
              </Text>
            </View>
          </View>

          <View style={styles.body}>
            <Text style={styles.paragraph} testID="story-body">
              {body}
            </Text>

            {images.length > 1 ? (
              <View style={styles.gallery}>
                {images.slice(1).map((uri, idx) => (
                  <Image
                    key={`${uri.slice(0, 20)}-${idx}`}
                    source={{ uri }}
                    style={styles.galleryImg}
                    contentFit="cover"
                    transition={200}
                  />
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  hero: { height: 320, width: "100%", position: "relative" },
  heroImg: { width: "100%", height: "100%", backgroundColor: colors.surfaceTertiary },
  heroPlaceholder: { alignItems: "center", justifyContent: "center" },
  heroScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  heroBar: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  heroContent: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 24,
  },
  brandTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  brandTagTxt: {
    color: colors.onBrand,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  title: {
    color: colors.onSurfaceInverse,
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36,
  },
  body: { padding: 24, gap: 20 },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.onSurface,
  },
  gallery: { gap: 12 },
  galleryImg: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    backgroundColor: colors.surfaceTertiary,
  },
}));
