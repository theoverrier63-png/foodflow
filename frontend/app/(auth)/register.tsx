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
  company_name: string;
  siret: string;
  email: string;
  phone: string;
  delivery_address: string;
  password: string;
};

export default function Register() {
  const [f, setF] = useState<F>({
    company_name: "",
    siret: "",
    email: "",
    phone: "",
    delivery_address: "",
    password: "",
  });
  const [busy, setBusy] = useState(false);
  const { signUp } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { colors } = useTheme();

  function set<K extends keyof F>(k: K, v: string) {
    setF((p) => ({ ...p, [k]: v }));
  }

  function validate(): string | null {
    if (f.company_name.trim().length < 2) return "Nom d'entreprise trop court";
    if (!/^\d{14}$/.test(f.siret.replace(/\s/g, "")))
      return "SIRET invalide (14 chiffres requis)";
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return "Email invalide";
    if (f.phone.trim().length < 6) return "Téléphone invalide";
    if (f.delivery_address.trim().length < 5) return "Adresse trop courte";
    if (f.password.length < 6) return "Mot de passe : 6 caractères minimum";
    return null;
  }

  async function submit() {
    const err = validate();
    if (err) {
      toast.show(err, "error");
      return;
    }
    try {
      setBusy(true);
      await signUp({ ...f, siret: f.siret.replace(/\s/g, ""), email: f.email.trim().toLowerCase() });
      toast.show("Compte créé !", "success");
      router.replace("/(app)");
    } catch (e: any) {
      toast.show(e?.message || "Inscription impossible", "error");
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
          <Pressable testID="back-to-login-button" hitSlop={16} style={styles.backBtn}>
            <Feather name="chevron-left" size={24} color={colors.onSurface} />
          </Pressable>
        </Link>
        <Text style={styles.headerTitle}>Créer un compte</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 120, gap: 14 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Enregistrez votre entreprise pour commander des fruits & légumes frais.
        </Text>

        <Field label="Nom de l'entreprise" testID="reg-company-input">
          <TextInput
            testID="reg-company-input"
            value={f.company_name}
            onChangeText={(v) => set("company_name", v)}
            placeholder="Ex : Restaurant Le Verger"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </Field>

        <Field label="SIRET (14 chiffres)">
          <TextInput
            testID="reg-siret-input"
            value={f.siret}
            onChangeText={(v) => set("siret", v)}
            placeholder="12345678901234"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            maxLength={20}
            style={styles.input}
          />
        </Field>

        <Field label="Email professionnel">
          <TextInput
            testID="reg-email-input"
            value={f.email}
            onChangeText={(v) => set("email", v)}
            placeholder="contact@entreprise.fr"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
        </Field>

        <Field label="Téléphone">
          <TextInput
            testID="reg-phone-input"
            value={f.phone}
            onChangeText={(v) => set("phone", v)}
            placeholder="+33 6 12 34 56 78"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            style={styles.input}
          />
        </Field>

        <Field label="Adresse de livraison">
          <TextInput
            testID="reg-address-input"
            value={f.delivery_address}
            onChangeText={(v) => set("delivery_address", v)}
            placeholder="10 rue des Halles, 75001 Paris"
            placeholderTextColor={colors.muted}
            multiline
            style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
          />
        </Field>

        <Field label="Mot de passe">
          <PasswordInput
            testID="reg-password-input"
            value={f.password}
            onChangeText={(v) => set("password", v)}
            placeholder="••••••••"
          />
        </Field>
      </ScrollView>

      <View style={[styles.stickyCta, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          testID="register-submit-button"
          onPress={submit}
          disabled={busy}
          style={({ pressed }) => [
            styles.cta,
            (pressed || busy) && { opacity: 0.85 },
          ]}
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

function Field({ label, children }: { label: string; children: React.ReactNode; testID?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
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
