import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'student' | 'admin' | 'superadmin';
  university: string;
  problemsSolved: number;
  totalSubmissions: number;
  score: number;
  createdAt: unknown;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Super admin email is configured via environment variable so it is never
// hard-coded in source and can differ across environments without a code change.
const SUPER_ADMIN_EMAIL = import.meta.env.VITE_SUPER_ADMIN_EMAIL as string | undefined;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser]       = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (u: User): Promise<UserProfile | null> => {
    const ref  = doc(db, 'users', u.uid);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as UserProfile) : null;
  };

  const refreshProfile = async () => {
    if (user) {
      const p = await fetchProfile(user);
      setProfile(p);
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const p = await fetchProfile(u);
        setProfile(p);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (email: string, password: string, name: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });

    const role: UserProfile['role'] =
      SUPER_ADMIN_EMAIL && email === SUPER_ADMIN_EMAIL ? 'superadmin' : 'student';

    const newProfile: UserProfile = {
      uid: cred.user.uid,
      email,
      displayName: name,
      role,
      university: 'MCA University',
      problemsSolved: 0,
      totalSubmissions: 0,
      score: 0,
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, 'users', cred.user.uid), newProfile);
    setProfile(newProfile);
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
  };

  const isAdmin      = profile?.role === 'admin' || profile?.role === 'superadmin';
  const isSuperAdmin = profile?.role === 'superadmin';

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, login, register, logout, isAdmin, isSuperAdmin, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
