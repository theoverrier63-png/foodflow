import { useState } from "react";
import { View, TextInput, TextInputProps, Pressable, StyleSheet } from "react-native";
import Feather from "@react-native-vector-icons/feather";
import { useTheme } from "@/src/theme";

type Props = Omit<TextInputProps, "secureTextEntry"> & {
  testID?: string;
  toggleTestID?: string;
};

/**
 * Password input with a right-side "eye" toggle to show / hide the value.
 * The visual chrome (border, radius, colors) matches the plain `styles.input`
 * used in the auth screens.
 */
export default function PasswordInput({
  testID,
  toggleTestID,
  style,
  ...rest
}: Props) {
  const [visible, setVisible] = useState(false);
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.surfaceSecondary,
          borderColor: colors.border,
        },
      ]}
    >
      <TextInput
        testID={testID}
        secureTextEntry={!visible}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        {...rest}
        style={[styles.input, { color: colors.onSurface }, style]}
      />
      <Pressable
        testID={toggleTestID ?? (testID ? `${testID}-toggle` : undefined)}
        onPress={() => setVisible((v) => !v)}
        hitSlop={12}
        style={styles.eye}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
      >
        <Feather name={visible ? "eye-off" : "eye"} size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
  },
  eye: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
