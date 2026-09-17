import { create } from 'zustand';
import { AppwriteException, ID, type Models } from 'appwrite';
import { account } from '../lib/appwrite';
import { useChatStore } from './useChatStore';
import { useMcpStore } from './useMcpStore';

interface AuthState {
  user: Models.User<Models.Preferences> | null;
  busy: boolean;
  error: string;
  initialize: () => Promise<void>;
  login: (email: string, password: string, register: boolean) => Promise<void>;
  logout: () => Promise<void>;
}
let initialization: Promise<void> | undefined;
export const useAuthStore = create<AuthState>((set) => ({
  user: null, busy: true, error: '',
  initialize: () => initialization ??= (async () => {
    try {
      let user: Models.User<Models.Preferences> | null = null;
      try { user = await account.get(); }
      catch (error) {
        if (!(error instanceof AppwriteException && error.code === 401)) set({ error: 'Appwrite could not be reached. Guest mode is available; check the project web platform settings.' });
      }
      set({ user });
      await useChatStore.getState().loadWorkspace(user?.$id);
      useMcpStore.getState().loadServers();
    } catch (error) { set({ error: error instanceof Error ? error.message : 'Could not load workspace.' }); }
    finally { set({ busy: false }); }
  })(),
  login: async (email, password, register) => {
    if (Object.keys(useChatStore.getState().activeStreams).length) throw new Error('Stop generation before signing in.');
    useChatStore.setState({ ready: false });
    set({ busy: true, error: '' });
    try {
      if (register) await account.create({ userId: ID.unique(), email, password });
      await account.createEmailPasswordSession({ email, password });
      const user = await account.get();
      set({ user });
      await useChatStore.getState().loadWorkspace(user.$id);
      useMcpStore.getState().loadServers();
    } finally { set({ busy: false }); useChatStore.setState({ ready: true }); }
  },
  logout: async () => {
    if (Object.keys(useChatStore.getState().activeStreams).length) throw new Error('Stop generation before signing out.');
    useChatStore.setState({ ready: false });
    set({ busy: true });
    try {
      await account.deleteSession({ sessionId: 'current' });
      set({ user: null });
      await useChatStore.getState().loadWorkspace();
      useMcpStore.getState().loadServers();
    } finally { set({ busy: false }); useChatStore.setState({ ready: true }); }
  },
}));
