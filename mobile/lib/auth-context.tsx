import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, sessionFromAuth } from './api';
import { AppSession, clearSession, loadSession, saveSession } from './session';
import { Profile } from './types';

type AuthContextValue = {
  loading: boolean;
  session: AppSession | null;
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<AppSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let mounted = true;
    loadSession()
      .then(async (stored) => {
        if (!mounted) return;
        if (!stored) {
          setSession(null);
          setProfile(null);
          return;
        }
        setSession(stored);
        try {
          const result = await api.sync();
          if (!mounted) return;
          setProfile(result.profile);
          const latest = await loadSession();
          if (latest) setSession(latest);
        } catch {
          const latest = await loadSession();
          if (!latest && mounted) {
            setSession(null);
            setProfile(null);
          }
        }
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        setProfile(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const adopt = useCallback(async (result: Awaited<ReturnType<typeof api.login>>) => {
    const next = sessionFromAuth(result);
    await saveSession(next);
    setSession(next);
    setProfile(result.profile);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await adopt(await api.login(email, password));
    },
    [adopt],
  );

  const signUp = useCallback(
    async (email: string, password: string, displayName: string) => {
      await adopt(await api.register(email, password, displayName));
    },
    [adopt],
  );

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // The local session still goes away if the server is unreachable.
    }
    await clearSession();
    setSession(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const next = await api.me();
    setProfile(next);
  }, []);

  const value = useMemo(
    () => ({
      loading,
      session,
      profile,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [loading, session, profile, signIn, signUp, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
