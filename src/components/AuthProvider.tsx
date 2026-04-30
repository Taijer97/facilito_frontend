import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userSnap = await getDoc(userRef);
          
          if (userSnap.exists()) {
            const data = userSnap.data();
            const isSuperAdmin = currentUser.email === 'dj.taijer@gmail.com';
            
            // Auto promote to admin if they are superadmin but their document says otherwise
            if (isSuperAdmin && data.role !== 'admin') {
              try {
                  const updateData = { role: 'admin' };
                  const { updateDoc } = await import('firebase/firestore');
                  await updateDoc(userRef, updateData);
                  data.role = 'admin';
              } catch (e) {
                  console.error(e);
              }
            }
            
            setDbUser(data);
          } else {
            // Check if email already exists for another user (to prevent duplicate emails)
            const { collection, query, where, getDocs } = await import('firebase/firestore');
            const emailQuery = query(collection(db, 'users'), where('email', '==', currentUser.email));
            const emailSnap = await getDocs(emailQuery);

            if (!emailSnap.empty) {
              // Email exists in another account - handle carefully
              // For now, we will link it or just alert, but usually this shouldn't happen with single provider
              // We'll set dbUser to the found data if we want to "link", but security-wise that's risky.
              // Better to just show error or block.
              console.warn("User tried to login with an email that is already registered with another UID.");
              // Optionally show error in UI via state, but AuthProvider is a bit low-level here.
            }

            // Check if super admin
            const isSuperAdmin = currentUser.email === 'dj.taijer@gmail.com';
            const newUser = {
              email: currentUser.email || '',
              name: currentUser.displayName || 'Usuario',
              role: isSuperAdmin ? 'admin' : 'user',
              createdAt: serverTimestamp(),
            };
            try {
              await setDoc(userRef, newUser);
              setDbUser(newUser);
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, `users/${currentUser.uid}`);
            }
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
        }
      } else {
        setDbUser(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, dbUser, loading }}>
        {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
