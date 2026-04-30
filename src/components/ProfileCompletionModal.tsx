import React, { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthProvider';
import { handleFirestoreError, OperationType } from '../lib/errorHandling';
import { User, ShieldCheck, Phone, MapPin, CreditCard, UserCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ProfileCompletionModal() {
  const { user, dbUser, loading } = useAuth();
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dni, setDni] = useState('');
  const [address, setAddress] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && dbUser) {
      const isComplete = 
        dbUser.name && 
        dbUser.lastName && 
        dbUser.dni && 
        dbUser.address && 
        dbUser.whatsapp;
      
      if (!isComplete) {
        setName(dbUser.name || '');
        setLastName(dbUser.lastName || '');
        setDni(dbUser.dni || '');
        setAddress(dbUser.address || '');
        setWhatsapp(dbUser.whatsapp || '');
        setShow(true);
      } else {
        setShow(false);
      }
    } else {
        setShow(false);
    }
  }, [dbUser, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSubmitting(true);
    setError(null);
    try {
      const trimmedDni = dni.trim();
      // 1. Check if DNI is already used by someone else
      const dniQuery = query(collection(db, 'users'), where('dni', '==', trimmedDni));
      let dniSnap;
      try {
          dniSnap = await getDocs(dniQuery);
      } catch (err) {
          handleFirestoreError(err, OperationType.LIST, 'users (dni check)');
          throw err;
      }

      const otherUserWithDni = dniSnap.docs.find(d => d.id !== user.uid);
      
      if (otherUserWithDni) {
        setError('Este DNI ya está registrado con otro usuario.');
        setSubmitting(false);
        return;
      }

      try {
          await updateDoc(doc(db, 'users', user.uid), {
            name: name.trim(),
            lastName: lastName.trim(),
            dni: trimmedDni,
            address: address.trim(),
            whatsapp: whatsapp.trim(),
            updatedAt: serverTimestamp()
          });
      } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
          throw err;
      }

      setShow(false);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setError('Hubo un error al actualizar tu perfil. Por favor, intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/80 backdrop-blur-md">
          <div className="flex min-h-full items-center justify-center p-4 py-12">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, rotate: -2 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.9, opacity: 0, rotate: 2 }}
              className="bg-white border-8 border-black rounded-[3rem] p-8 max-w-xl w-full relative shadow-[20px_20px_0px_0px_#ff4d4d]"
            >
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-yellow-400 border-4 border-black px-6 py-2 rounded-full shadow-[4px_4px_0px_0px_#000] z-10 w-fit whitespace-nowrap">
                  <p className="font-comic text-2xl font-bold flex items-center gap-2">
                      <ShieldCheck className="w-8 h-8" />
                      ¡REQUISITO IMPORTANTE!
                  </p>
              </div>

              <div className="mt-4 text-center">
                  <p className="font-bold text-lg mb-6 bg-cyan-100 border-2 border-black inline-block px-4 py-1 rounded-lg transform -rotate-1">
                      Para participar en los sorteos debes completar tus datos reales.
                  </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                 {error && (
                   <div className="bg-red-100 border-4 border-red-600 p-3 rounded-2xl text-red-600 font-black text-sm text-center animate-pulse">
                     ⚠️ {error}
                   </div>
                 )}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 font-bold text-sm ml-2">
                          <User className="w-4 h-4" /> Nombres
                      </label>
                      <input 
                          type="text" 
                          value={name} 
                          onChange={e => setName(e.target.value)} 
                          required 
                          placeholder="Tus nombres"
                          className="w-full border-4 border-black p-3 rounded-2xl shadow-[4px_4px_0px_0px_#000] focus:shadow-none focus:translate-x-1 focus:translate-y-1 transition-all outline-none font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 font-bold text-sm ml-2">
                          <UserCircle className="w-4 h-4" /> Apellidos
                      </label>
                      <input 
                          type="text" 
                          value={lastName} 
                          onChange={e => setLastName(e.target.value)} 
                          required 
                          placeholder="Tus apellidos"
                          className="w-full border-4 border-black p-3 rounded-2xl shadow-[4px_4px_0px_0px_#000] focus:shadow-none focus:translate-x-1 focus:translate-y-1 transition-all outline-none font-bold"
                      />
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 font-bold text-sm ml-2">
                          <CreditCard className="w-4 h-4" /> DNI
                      </label>
                      <input 
                          type="text" 
                          value={dni} 
                          onChange={e => setDni(e.target.value)} 
                          required 
                          maxLength={8}
                          placeholder="Documento de Identidad"
                          className="w-full border-4 border-black p-3 rounded-2xl shadow-[4px_4px_0px_0px_#000] focus:shadow-none focus:translate-x-1 focus:translate-y-1 transition-all outline-none font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="flex items-center gap-2 font-bold text-sm ml-2">
                          <Phone className="w-4 h-4" /> WhatsApp
                      </label>
                      <input 
                          type="text" 
                          value={whatsapp} 
                          onChange={e => setWhatsapp(e.target.value)} 
                          required 
                          placeholder="Ej: 987654321"
                          className="w-full border-4 border-black p-3 rounded-2xl shadow-[4px_4px_0px_0px_#000] focus:shadow-none focus:translate-x-1 focus:translate-y-1 transition-all outline-none font-bold"
                      />
                    </div>
                 </div>

                 <div className="space-y-1">
                   <label className="flex items-center gap-2 font-bold text-sm ml-2">
                      <MapPin className="w-4 h-4" /> Dirección Actual
                   </label>
                   <input 
                      type="text" 
                      value={address} 
                      onChange={e => setAddress(e.target.value)} 
                      required 
                      placeholder="Calle, Distrito, Ciudad"
                      className="w-full border-4 border-black p-3 rounded-2xl shadow-[4px_4px_0px_0px_#000] focus:shadow-none focus:translate-x-1 focus:translate-y-1 transition-all outline-none font-bold"
                   />
                 </div>

                 <div className="pt-6">
                    <button 
                      type="submit" 
                      disabled={submitting}
                      className="w-full bg-green-500 text-white font-comic text-2xl py-4 rounded-3xl border-4 border-black shadow-[8px_8px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                      {submitting ? 'GUARDANDO...' : '¡LISTO, ACTUALIZAR!'}
                    </button>
                    <p className="text-center text-xs font-bold text-gray-500 mt-4 px-4 uppercase tracking-tighter">
                      Tus datos son seguros y solo se usarán para fines de identificación en caso de resultar ganador.
                    </p>
                 </div>
              </form>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
