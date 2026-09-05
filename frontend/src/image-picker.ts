import * as ImagePicker from "expo-image-picker";

// Ask permissions and open the gallery to pick an image, returning it as a
// `data:image/...;base64,<...>` URL that can be stored directly.
export async function pickImageAsDataUrl(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new Error("Permission d'accès à la galerie refusée");
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
    base64: true,
    allowsEditing: true,
    aspect: [4, 3],
  });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  const mime = asset.mimeType || "image/jpeg";
  if (!asset.base64) return null;
  return `data:${mime};base64,${asset.base64}`;
}
