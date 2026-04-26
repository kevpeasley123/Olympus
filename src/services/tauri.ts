import { invoke } from "@tauri-apps/api/core";

export interface MemoryArtifactPayload {
  vaultPath: string;
  folder: string;
  fileName: string;
  content: string;
}

export async function initializeDatabase(): Promise<string> {
  return invoke<string>("initialize_database");
}

export async function writeMemoryArtifact(payload: MemoryArtifactPayload): Promise<string> {
  const result = await invoke<{ path: string }>("write_memory_artifact", {
    artifact: {
      vault_path: payload.vaultPath,
      folder: payload.folder,
      file_name: payload.fileName,
      content: payload.content
    }
  });

  return result.path;
}
