import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import Feather from "@react-native-vector-icons/feather";

import { useAuth } from "@/src/auth-context";
import { useToast } from "@/src/toast";
import { makeStyles, useTheme } from "@/src/theme";
import PasswordInput from "@/src/components/PasswordInput";

type F = {
  full_name: string;
  email: string;
  phone: string;
  delivery_address: string;
  password: string;
};

export default function RegisterPersonal() {
  const [f, setF] = useState<F>({
    full_name: "",
    email: "",
    phone: "",
    delivery_address: "",
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const { signUpPersonal } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();

  function set<K extends keyof F>(k: K, v: string) {
    setF((p) => ({ ...p, [k]: v }));
  }

  async function submit() {
    if (f.full_name.trim().length < 2) return toast.show("Nom trop court", "error");
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return toast.show("Email invalide", "error");
    if (f.phone.trim().length < 6) return toast.show("Téléphone invalide", "error");
    if (f.delivery_address.trim().length < 5) return toast.show("Adresse trop courte", "error");
    if (f.password.length < 6) return toast.show("Mot de passe : 6 caractères min", "error");
    try {
      setBusy(true);
      await signUpPersonal({ ...f, email: f.email.trim().toLowerCase() });
      toast.show("Compte créé !", "success");
      router.replace("/(app)");
    } catch (e: any) {
      toast.show(e?.message || "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Link href="/(auth)/login" asChild>
          <Pressable testID="back-btn" hitSlop={16} style={styles.backBtn}>
            <Feather name="chevron-left" size={24} color={colors.onSurface} />
          </Pressable>
        </Link>
        <Text style={styles.headerTitle}>Compte particulier</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 120, gap: 14 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>Créez votre compte pour commander en tant que particulier.</Text>

        {[
          { k: "full_name", label: "Nom complet", ph: "Ex : Jean Dupont", tid: "pers-name", kb: undefined },
          { k: "email", label: "Email", ph: "vous@example.com", tid: "pers-email", kb: "email-address" as const, autoCap: "none" as const },
          { k: "phone", label: "Téléphone", ph: "+33 6 12 34 56 78", tid: "pers-phone", kb: "phone-pad" as const },
          { k: "delivery_address", label: "Adresse de livraison", ph: "10 rue …", tid: "pers-address", multi: true },
        ].map((row: any) => (
          <View key={row.k} style={styles.field}>
            <Text style={styles.label}>{row.label}</Text>
            <TextInput
              testID={row.tid}
              value={(f as any)[row.k]}
              onChangeText={(v) => set(row.k, v)}
              placeholder={row.ph}
              placeholderTextColor={colors.muted}
              keyboardType={row.kb}
              autoCapitalize={row.autoCap}
              multiline={row.multi}
              style={[styles.input, row.multi && { minHeight: 72, textAlignVertical: "top" }]}
            />
          </View>
        ))}
        <View style={styles.field}>
          <Text style={styles.label}>Mot de passe</Text>
          <PasswordInput
            testID="pers-password"
            value={f.password}
            onChangeText={(v) => set("password", v)}
            placeholder="••••••••"
          />
        </View>
      </ScrollView>

      <View style={[styles.stickyCta, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          testID="register-personal-submit"
          onPress={submit}
          disabled={busy}
          style={({ pressed }) => [styles.cta, (pressed || busy) && { opacity: 0.85 }]}
        >
          {busy ? (
            <ActivityIndicator color={colors.onBrandPrimary} />
          ) : (
            <Text style={styles.ctaTxt}>Créer mon compte</Text>
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
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  intro: { fontSize: 14, color: colors.muted, marginBottom: 4 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600", color: colors.onSurface },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.onSurface,
  },
  stickyCta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
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
