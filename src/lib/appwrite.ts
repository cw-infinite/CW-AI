import { Client, Account, Storage, ID, Permission, Role, Query } from 'appwrite';
import { validateWorkspace, type Workspace } from './workspace';

export const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID || '6a495da200375e2a8e84');
export const account = new Account(client);
const storage = new Storage(client);
const bucketId = import.meta.env.VITE_APPWRITE_BUCKET_ID || 'workspaces';
export async function backupWorkspace(userId: string, workspace: Workspace) {
  const file = new File([JSON.stringify(workspace)], `workspace-${userId}.json`, { type: 'application/json' });
  return storage.createFile({ bucketId, fileId: ID.unique(), file, permissions: [Permission.read(Role.user(userId)), Permission.delete(Role.user(userId))] });
}
export async function restoreWorkspace(userId: string): Promise<Workspace> {
  const result = await storage.listFiles({ bucketId, queries: [Query.equal('name', `workspace-${userId}.json`), Query.orderDesc('$createdAt'), Query.limit(1)] });
  const file = result.files[0];
  if (!file) throw new Error('No cloud backup exists for this account yet.');
  // Use the SDK transport so Appwrite cookie fallback also works in browsers
  // that block third-party cookies. Never use a server API key in this app.
  const data = await client.call('GET', new URL(storage.getFileDownload({ bucketId, fileId: file.$id })), {}, {}, 'arrayBuffer');
  return validateWorkspace(data instanceof ArrayBuffer ? JSON.parse(new TextDecoder().decode(data)) : data);
}
