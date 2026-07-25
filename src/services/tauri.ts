import { invoke } from "@tauri-apps/api/core";

export interface MemoryArtifactPayload {
  folder: string;
  fileName: string;
  content: string;
}

export async function writeMemoryArtifact(payload: MemoryArtifactPayload): Promise<string> {
  const result = await invoke<{ path: string }>("write_memory_artifact", {
    artifact: {
      folder: payload.folder,
      file_name: payload.fileName,
      content: payload.content
    }
  });

  return result.path;
}
