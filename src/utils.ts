// utils.ts
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
  // vault: this.app.vault を渡す。ここでは概念コード。実装では非同期の exists 等を使う必要あり。
  // ここは main.ts 内で非同期チェックして決定する（下記 main.ts を参照）
  return baseName;
}
