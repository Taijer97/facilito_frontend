import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, getDocFromCache, setDoc, serverTimestamp, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/errorHandling';

interface AuthContextType {
  user: User | null;
  dbUser: any | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, dbUser: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (unsubscribeUser) {
        unsubscribeUser();
        unsubscribeUser = null;
      }

      if (currentUser) {
        setLoading(true);
        const userRef = doc(db, 'users', currentUser.uid);
        
        unsubscribeUser = onSnapshot(userRef, async (userSnap) => {
          if (userSnap.exists()) {
            const data = userSnap.data();
            const isSuperAdmin = currentUser.email === 'dj.taijer@gmail.com';
            
            // Auto promote to admin if they are superadmin but their document says otherwise
            if (isSuperAdmin && data.role !== 'admin') {
              try {
                  await updateDoc(userRef, { role: 'admin' });
                  // The snapshot will trigger again with updated data
              } catch (e) {
                  console.error('Failed to promote user to admin', e);
              }
            }
            
            setDbUser(data);
            setLoading(false);
          } else {
            // Document doesn't exist, create it
            const isSuperAdmin = currentUser.email === 'dj.taijer@gmail.com';
            const params = new URLSearchParams(window.location.search);
            const refCodeUrl = params.get('ref');
            const storedRefCode = localStorage.getItem('referralCode');
            const referredBy = refCodeUrl || storedRefCode || null;
            
            const newReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();

            const newUser = {
              email: currentUser.email || '',
              name: currentUser.displayName || 'Usuario',
              role: isSuperAdmin ? 'admin' : 'user',
              createdAt: serverTimestamp(),
              referralCode: newReferralCode,
              referredBy: referredBy,
              referralBalance: 0,
              referralCount: 0
            };

            try {
              if (navigator.onLine) {
                 await setDoc(userRef, newUser);
                 if (storedRefCode) localStorage.removeItem('referralCode');
              }
              // setDbUser will be handled by the next onSnapshot trigger
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`);
              setLoading(false);
            }
          }
        }, (error) => {
          console.error("User document listener error:", error);
          setLoading(false);
        });
      } else {
        setDbUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, dbUser, loading }}>
        {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
