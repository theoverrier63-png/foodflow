import { Platform, Share } from "react-native";

// Download or share a CSV file. On web: triggers browser download.
// On native: opens native share sheet with the CSV text.
export async function downloadCsv(filename: string, content: string) {
  if (Platform.OS === "web") {
    try {
      const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      throw new Error("Téléchargement impossible");
    }
    return;
  }
  // Native share sheet
  await Share.share({
    title: filename,
    message: content,
  });
}
