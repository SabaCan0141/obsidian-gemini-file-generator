export async function fileToBase64(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // data:*/*;base64,XXXX
      const base64 = dataUrl.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

export function ensureUniqueFilename(vault, folderPath: string, baseName: string): string {
  return baseName;
}
