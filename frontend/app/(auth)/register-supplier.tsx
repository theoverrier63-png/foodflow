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

type F = {
  company_name: string;
  siret: string;
  email: string;
  phone: string;
  delivery_address: string;
  password: string;
  access_code: string;
};

export default function RegisterSupplier() {
  const [f, setF] = useState<F>({
    company_name: "",
    siret: "",
    email: "",
    phone: "",
    delivery_address: "",
    password: "",
    access_code: "",
  });
  const [busy, setBusy] = useState(false);
  const { signUpSupplier } = useAuth();
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
    if (!f.access_code.trim()) return "Code d'accès fournisseur requis";
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
      await signUpSupplier({
        ...f,
        siret: f.siret.replace(/\s/g, ""),
        email: f.email.trim().toLowerCase(),
        access_code: f.access_code.trim(),
      });
      toast.show("Compte fournisseur créé !", "success");
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
        <Text style={styles.headerTitle}>Compte fournisseur</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 120, gap: 14 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.banner}>
          <Feather name="truck" size={18} color={colors.brandPrimary} />
          <Text style={styles.bannerTxt}>
            Espace fournisseur — accès complet au catalogue, aux commandes et aux factures.
            Un code d'accès est requis.
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Nom de l'entreprise fournisseur</Text>
          <TextInput
            testID="sup-company-input"
            value={f.company_name}
            onChangeText={(v) => set("company_name", v)}
            placeholder="Ex : SARL Leray-Pointel"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>SIRET (14 chiffres)</Text>
          <TextInput
            testID="sup-siret-input"
            value={f.siret}
            onChangeText={(v) => set("siret", v)}
            placeholder="12345678901234"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            maxLength={20}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Email professionnel</Text>
          <TextInput
            testID="sup-email-input"
            value={f.email}
            onChangeText={(v) => set("email", v)}
            placeholder="contact@leray-pointel.fr"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Téléphone</Text>
          <TextInput
            testID="sup-phone-input"
            value={f.phone}
            onChangeText={(v) => set("phone", v)}
            placeholder="+33 6 12 34 56 78"
            placeholderTextColor={colors.muted}
            keyboardType="phone-pad"
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Adresse du siège / dépôt</Text>
          <TextInput
            testID="sup-address-input"
            value={f.delivery_address}
            onChangeText={(v) => set("delivery_address", v)}
            placeholder="10 rue des Halles, 75001 Paris"
            placeholderTextColor={colors.muted}
            multiline
            style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            testID="sup-password-input"
            value={f.password}
            onChangeText={(v) => set("password", v)}
            placeholder="••••••••"
            placeholderTextColor={colors.muted}
            secureTextEntry
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Code d'accès fournisseur</Text>
          <TextInput
            testID="sup-code-input"
            value={f.access_code}
            onChangeText={(v) => set("access_code", v)}
            placeholder="Fourni par Leray-Pointel"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            style={styles.input}
          />
          <Text style={styles.hint}>
            Ce code sécurise l'inscription fournisseur. Contactez Leray-Pointel si vous ne
            l'avez pas.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.stickyCta, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          testID="register-supplier-submit-button"
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
            <Text style={styles.ctaTxt}>Créer mon compte fournisseur</Text>
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
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.brandSecondary,
    borderRadius: 12,
    padding: 12,
  },
  bannerTxt: {
    flex: 1,
    color: colors.onBrandSecondary,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
  },
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
  hint: { fontSize: 11, color: colors.muted, marginTop: 2 },
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
