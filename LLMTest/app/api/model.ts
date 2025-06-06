import RNFS from "react-native-fs";

export default async function downloadModel(
  modelName: string,
  modelUrl: string,
  onProgress: (progress: number) => void
): Promise<string> {
  const destPath = `${RNFS.DocumentDirectoryPath}/${modelName}`;
  try {
    if (!modelName || !modelUrl) {
      throw new Error('Invalid model name or URL');
    }

    const fileExists = await RNFS.exists(destPath);
    if (fileExists) {
      await RNFS.unlink(destPath);
      console.log(`Deleted existing file at ${destPath}`);
    }

    console.log("Starting download from:", modelUrl);

    const downloadResult = await RNFS.downloadFile({
      fromUrl: modelUrl,
      toFile: destPath,
      progressDivider: 5,
      begin: (res) => {
        console.log("Download started:", res);
      },
      progress: ({ bytesWritten, contentLength }) => {
        const progress = (bytesWritten / contentLength) * 100;
        console.log("Download progress:", progress);
        onProgress(Math.floor(progress));
      },
    }).promise;

    if (downloadResult.statusCode === 200) {
      return destPath;
    } else {
      throw new Error(`Download failed with status code: ${downloadResult.statusCode}`);
    }
  } catch (error) {
    throw new Error(`Failed to download model: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

