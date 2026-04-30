import { Link, Outlet, useNavigate } from 'react-router';
import { Ticket, User as UserIcon, LogOut, LogIn, Menu, ShieldAlert, Bell } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { signInWithGoogle, logOut, db } from '../lib/firebase';
import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import ProfileCompletionModal from './ProfileCompletionModal';

export default function Layout() {
  const { user, dbUser } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [readIds, setReadIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('read_notifications');
    return saved ? JSON.parse(saved) : [];
  });
  const lastEventId = useRef<string | null>(null);

  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id);
    const newReadIds = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(newReadIds);
    localStorage.setItem('read_notifications', JSON.stringify(newReadIds));
    setShowNotifPanel(false);
  };

  const filteredNotifications = notifications.filter(n => !readIds.includes(n.id));

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    let q;
    if (dbUser?.role === 'admin') {
      // Admins: Listen to ANY new pending_payment ticket
      q = query(
        collection(db, 'tickets'),
        where('status', '==', 'pending_payment'),
        orderBy('createdAt', 'desc'),
        limit(10)
      );
    } else {
      // Users: Listen to their tickets that were approved (paid) or rejected
      q = query(
        collection(db, 'tickets'),
        where('userId', '==', user.uid),
        where('status', 'in', ['paid', 'rejected']),
        orderBy('updatedAt', 'desc'),
        limit(10)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      
      if (docs.length > 0) {
        const latest = docs[0] as any;
        // Compare with last event ID to avoid repeats
        if (latest.id !== lastEventId.current) {
          if (lastEventId.current !== null) {
            playFacilito();
          }
          lastEventId.current = latest.id;
        }
      } else if (lastEventId.current === null) {
        lastEventId.current = 'empty';
      }
      
      setNotifications(docs);
    });

    return () => unsubscribe();
  }, [user, dbUser]);

  const playFacilito = () => {
    // 1. Try playing custom sound if exists
    const audio = new Audio('/facilito.mp3');
    audio.play().catch(() => {
      // 2. Fallback to Voice synthesis saying "FACILITO"
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance('FACILITO');
        utterance.lang = 'es-ES';
        utterance.rate = 0.9;
        utterance.pitch = 1.2;
        window.speechSynthesis.speak(utterance);
      } else {
        console.log('Audio alert for "FACILITO" triggered.');
      }
    });
  };

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = async () => {
    await logOut();
    navigate('/');
  };

  const handleScrollToHowItWorks = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuOpen(false);
    if (window.location.pathname === '/' || window.location.pathname === '/como-funciona') {
      const element = document.getElementById('como-funciona');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    } else {
      navigate('/?scroll=como-funciona');
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('scroll') === 'como-funciona') {
      setTimeout(() => {
        const element = document.getElementById('como-funciona');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
          // Clean up URL
          window.history.replaceState({}, '', '/');
        }
      }, 100);
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col font-sans text-black">
      <ProfileCompletionModal />
      <header className="bg-yellow-400 shadow-sm border-b-4 border-black sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link to="/" className="flex items-center space-x-2 group">
              <div className="bg-white p-2 rounded-full border-4 border-black shadow-[4px_4px_0px_0px_#000] group-hover:translate-y-1 group-hover:translate-x-1 group-hover:shadow-[0px_0px_0px_0px_#000] transition-all">
                <img src="/logo.png" alt="Facilito" className="w-8 h-8 object-contain" />
              </div>
              <span className="font-comic text-3xl tracking-wide text-red-500 drop-shadow-[2px_2px_0px_#000]">FACILITO</span>
            </Link>

            <nav className="hidden md:flex space-x-8">
              <Link to="/sorteos" className="text-black font-bold text-lg hover:text-red-500 hover:-translate-y-1 transition-transform">Sorteos Activos</Link>
              <Link to="/resultados" className="text-black font-bold text-lg hover:text-red-500 hover:-translate-y-1 transition-transform">Resultados</Link>
              <a href="/como-funciona" onClick={handleScrollToHowItWorks} className="text-black font-bold text-lg hover:text-red-500 hover:-translate-y-1 transition-transform cursor-pointer">Cómo Funciona</a>
            </nav>

            <div className="hidden md:flex items-center space-x-4">
              {user ? (
                <div className="flex items-center space-x-4">
                  {dbUser?.role === 'admin' && (
                    <Link to="/admin" className="flex items-center space-x-1 text-sm font-bold text-black bg-cyan-300 border-2 border-black px-3 py-1.5 rounded-full shadow-[2px_2px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[0px_0px_0px_0px_#000] transition-all">
                      <ShieldAlert className="w-4 h-4" />
                      <span>Admin</span>
                    </Link>
                  )}
                  
                  {/* Notification Bell */}
                  <div className="relative group/notif">
                    <button 
                      onClick={() => setShowNotifPanel(!showNotifPanel)}
                      className={`p-2 border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all ${filteredNotifications.length > 0 ? 'bg-orange-400' : 'bg-white'}`}
                    >
                      <Bell className={`w-5 h-5 ${filteredNotifications.length > 0 ? 'animate-bounce' : ''}`} />
                      {filteredNotifications.length > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-black px-1.5 rounded-full border-2 border-black">
                          {filteredNotifications.length}
                        </span>
                      )}
                    </button>
                    
                    {showNotifPanel && notifications.length > 0 && (
                      <div className="absolute right-0 mt-4 w-72 bg-white border-4 border-black rounded-2xl shadow-[8px_8px_0px_0px_#000] p-4 z-[60]">
                        <div className="flex justify-between items-center border-b-2 border-black mb-2 pb-1">
                           <h4 className="font-comic text-lg">Notificaciones</h4>
                           <button 
                             onClick={markAllAsRead}
                             className="text-[10px] font-bold bg-gray-200 hover:bg-black hover:text-white px-2 py-0.5 rounded border border-black transition-colors"
                           >
                             LIMPIAR
                           </button>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                           {filteredNotifications.length === 0 ? (
                             <p className="text-xs text-center py-4 text-gray-400 italic">No tienes alertas nuevas</p>
                           ) : (
                             filteredNotifications.map((n: any) => (
                               <div key={n.id} className="text-xs p-2 bg-yellow-50 border-2 border-black rounded-lg">
                                 <p className="font-black">
                                   {dbUser?.role === 'admin' ? `Nueva Compra: ${n.userName}` : `Ticket #${n.ticketNumber} ${n.status === 'paid' ? 'APROBADO' : 'RECHAZADO'}`}
                                 </p>
                                 <p className="text-[10px] text-gray-500">{new Date(n.updatedAt?.toMillis?.() || n.createdAt?.toMillis?.() || Date.now()).toLocaleTimeString()}</p>
                               </div>
                             ))
                           )}
                        </div>
                      </div>
                    )}
                  </div>

                  <Link to="/panel" className="flex items-center space-x-2 text-black bg-white border-4 border-black px-4 py-2 rounded-xl shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-[0px_0px_0px_0px_#000] transition-all">
                    <img src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} alt="Avatar" className="w-6 h-6 rounded-full border-2 border-black" />
                    <span className="font-bold">Mi Panel</span>
                  </Link>
                  <button onClick={handleLogout} className="bg-red-500 text-white p-2 border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-[0px_0px_0px_0px_#000] transition-all">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleLogin}
                  className="flex items-center justify-center space-x-2 bg-red-500 text-white border-4 border-black px-6 py-2 rounded-xl font-bold text-lg shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-[0px_0px_0px_0px_#000] transition-all"
                >
                  <LogIn className="w-5 h-5" />
                  <span>¡Ingresar!</span>
                </button>
              )}
            </div>

            <div className="md:hidden flex items-center">
              <button onClick={() => setMenuOpen(!menuOpen)} className="bg-white p-2 border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_#000]">
                <Menu className="w-6 h-6 text-black" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-b-4 border-black bg-yellow-300 absolute w-full shadow-[0px_8px_0px_0px_#000] z-40">
            <div className="px-4 pt-4 pb-6 space-y-3">
              <Link to="/sorteos" onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl border-4 border-black bg-white font-bold text-black shadow-[4px_4px_0px_0px_#000]">Sorteos Activos</Link>
              <Link to="/resultados" onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl border-4 border-black bg-white font-bold text-black shadow-[4px_4px_0px_0px_#000]">Resultados</Link>
              <a href="/como-funciona" onClick={handleScrollToHowItWorks} className="block px-4 py-3 rounded-xl border-4 border-black bg-white font-bold text-black shadow-[4px_4px_0px_0px_#000] cursor-pointer">Cómo Funciona</a>
              
              {user ? (
                <>
                  <Link to="/panel" onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl border-4 border-black bg-cyan-300 font-bold text-black shadow-[4px_4px_0px_0px_#000] flex justify-between items-center">
                    <span>Mi Panel</span>
                    {filteredNotifications.length > 0 && (
                      <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full border-2 border-black">
                        {filteredNotifications.length}
                      </span>
                    )}
                  </Link>
                  {dbUser?.role === 'admin' && (
                    <Link to="/admin" onClick={() => setMenuOpen(false)} className="block px-4 py-3 rounded-xl border-4 border-black bg-orange-300 font-bold text-black shadow-[4px_4px_0px_0px_#000]">Admin Panel</Link>
                  )}
                  <button onClick={() => { handleLogout(); setMenuOpen(false); }} className="w-full text-left block px-4 py-3 rounded-xl border-4 border-black bg-red-500 font-bold text-white shadow-[4px_4px_0px_0px_#000]">Cerrar Sesión</button>
                </>
              ) : (
                <button onClick={() => { handleLogin(); setMenuOpen(false); }} className="w-full text-left block px-4 py-3 rounded-xl border-4 border-black bg-red-500 font-bold text-white shadow-[4px_4px_0px_0px_#000]">¡Ingresar / Registro!</button>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-grow">
        <Outlet />
      </main>

      <footer className="bg-cyan-400 text-black border-t-8 border-black mt-auto py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <div className="bg-white p-2 rounded-full border-4 border-black">
                <img src="/logo.png" alt="Facilito" className="w-6 h-6 object-contain" />
              </div>
              <span className="font-comic text-2xl tracking-wide text-black">FACILITO</span>
            </div>
            <p className="text-black font-bold text-sm">La plataforma de sorteos más transparente del Perú. ¡Participa desde S/1 y gana!</p>
          </div>
          <div>
            <h3 className="font-comic text-xl mb-4 text-black underline decoration-4 decoration-yellow-400">ENLACES</h3>
            <ul className="space-y-2 text-sm font-bold text-black">
              <li><Link to="/sorteos" className="hover:text-red-500 transition-colors">Sorteos Activos</Link></li>
              <li><Link to="/resultados" className="hover:text-red-500 transition-colors">Resultados Anteriores</Link></li>
              <li><a href="/como-funciona" onClick={handleScrollToHowItWorks} className="hover:text-red-500 transition-colors cursor-pointer">Cómo Funciona</a></li>
            </ul>
          </div>
          <div>
            <h3 className="font-comic text-xl mb-4 text-black underline decoration-4 decoration-yellow-400">SOPORTE</h3>
            <ul className="space-y-2 text-sm font-bold text-black">
              <li><a href="https://wa.me/51999999999" target="_blank" rel="noreferrer" className="hover:text-red-500 transition-colors">WhatsApp: +51 925 763 903</a></li>
              <li><a href="mailto:soporte@sorteospro.com" className="hover:text-red-500 transition-colors">Email</a></li>
              <li><Link to="/terminos" className="hover:text-red-500 transition-colors">Preguntas Frecuentes</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-comic text-xl mb-4 text-black underline decoration-4 decoration-yellow-400">LEGAL</h3>
            <ul className="space-y-2 text-sm font-bold text-black">
              <li><Link to="/terminos" className="hover:text-red-500 transition-colors">Términos y Condiciones</Link></li>
              <li><Link to="/privacidad" className="hover:text-red-500 transition-colors">Política de Privacidad</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 mt-8 pt-8 border-t-4 border-black text-center font-bold text-black">
          © {new Date().getFullYear()} Facilito. Todos los derechos reservados.
        </div>
      </footer>
    </div>
  );
}
