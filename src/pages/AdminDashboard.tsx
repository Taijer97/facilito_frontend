import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, doc, serverTimestamp, orderBy, onSnapshot, where, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../components/AuthProvider';
import { Search, MessageCircle, Clock, Zap, XCircle, Ticket, CheckCircle, RotateCcw, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function AdminDashboard() {
  const { user, dbUser } = useAuth();
  const [raffles, setRaffles] = useState<any[]>([]);
  const [pendingTickets, setPendingTickets] = useState<any[]>([]);
  const [now, setNow] = useState(Date.now());

  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null); // For ticket approval modal
  const [isApprovingAll, setIsApprovingAll] = useState(false);

  // Recovery feature state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [appSettings, setAppSettings] = useState<{yapeNumber: string, yapeQrUrl: string, whatsappNumber: string}>({yapeNumber: '', yapeQrUrl: '', whatsappNumber: ''});
  const [activeTab, setActiveTab] = useState<'raffles' | 'users' | 'settings'>('raffles');
  
  // New Raffle state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [prize, setPrize] = useState('');
  const [price, setPrice] = useState('5');
  const [total, setTotal] = useState('100');
  const [imageUrl, setImageUrl] = useState('');
  const [bonusThreshold, setBonusThreshold] = useState('10');
  const [endDateInput, setEndDateInput] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [endTimeInput, setEndTimeInput] = useState('20:00');

  useEffect(() => {
    if (dbUser?.role !== 'admin') return;

    loadAdminData();
    loadUsers();
    loadSettings();

    // Real-time listener for pending tickets
    const q = query(
      collection(db, 'tickets'), 
      where('status', '==', 'pending_payment')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tickets = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || Date.now())
        };
      });
      setPendingTickets(tickets);
    }, (error) => {
      console.error("Firestore Listen Error:", error);
    });

    return () => unsubscribe();
  }, [dbUser]);

  const loadSettings = async () => {
    try {
      const snap = await getDocs(collection(db, 'settings'));
      const config = snap.docs.find(d => d.id === 'config');
      if (config) {
        setAppSettings(config.data() as any);
      }
    } catch (e) { console.error(e); }
  };

  const loadUsers = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
      setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'settings', 'config'), {
        ...appSettings,
        updatedAt: serverTimestamp()
      });
      alert('Configuración actualizada');
    } catch (e) {
      // If document doesn't exist, try setting it
      try {
        const { setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'settings', 'config'), {
          ...appSettings,
          updatedAt: serverTimestamp()
        });
        alert('Configuración creada');
      } catch (err) {
        console.error(err);
        alert('Error al guardar configuración');
      }
    }
  };

  const handleToggleAdmin = async (userId: string, currentRole: string) => {
    try {
      const newRole = currentRole === 'admin' ? 'user' : 'admin';
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        updatedAt: serverTimestamp()
      });
      loadUsers();
    } catch (e) {
      console.error(e);
      alert('Error al cambiar permisos');
    }
  };

  const loadAdminData = async () => {
      try {
          const rSnap = await getDocs(query(collection(db, 'raffles'), orderBy('createdAt', 'desc')));
          setRaffles(rSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          
          // Get pending tickets across all collections
          const tSnap = await getDocs(query(collection(db, 'tickets')));
          const tickets = tSnap.docs.map(d => {
              const data = d.data();
              return {
                  id: d.id,
                  ...data,
                  // Convert timestamp to milliseconds for comparison
                  createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || Date.now())
              };
          }).filter((t: any) => t.status === 'pending_payment');
          
          setPendingTickets(tickets);
      } catch (error) {
          console.error(error);
      }
  };

  const handleCreateRaffle = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
          const endDate = new Date(`${endDateInput}T${endTimeInput}:00`).getTime();
          await addDoc(collection(db, 'raffles'), {
              title,
              prize,
              ticketPrice: Number(price),
              totalTickets: Number(total),
              soldTickets: 0,
              status: 'active',
              endDate,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              description,
              imageUrl,
              bonusThreshold: Number(bonusThreshold) || 0,
              winnerTicketId: '',
              winnerUserId: '',
              winningTicketNumber: ''
          });
          setTitle(''); 
          setPrize(''); 
          setImageUrl(''); 
          setDescription('');
          setPrice('5');
          setTotal('100');
          setBonusThreshold('10');
          loadAdminData();
          alert('Sorteo creado');
      } catch (error) {
          console.error(error);
          alert('Error');
      }
  };

  const handleApproveTicket = async (ticket: any) => {
      try {
          await updateDoc(doc(db, 'tickets', ticket.id), {
              status: 'paid',
              updatedAt: serverTimestamp()
          });
          
          // Increment soldTickets on Raffle
          const raffle = raffles.find(r => r.id === ticket.raffleId);
          if (raffle) {
              await updateDoc(doc(db, 'raffles', raffle.id), {
                 soldTickets: (raffle.soldTickets || 0) + 1,
                 updatedAt: serverTimestamp()
              });
          }
          // Do not call loadAdminData here as we have real-time listeners
      } catch (e) {
          console.error(e);
      }
  };

  const handleApproveAllInGroup = async (group: any) => {
    if (!group) return;
    setIsApprovingAll(true);
    try {
        for (const t of group.tickets) {
            await handleApproveTicket(t);
        }
        setSelectedGroupId(null);
        alert('Todos los tickets aprobados');
    } catch (e) {
        console.error(e);
        alert('Error al aprobar algunos tickets');
    } finally {
        setIsApprovingAll(false);
    }
  };

  const handleSearchTickets = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
        // We search in the flat tickets collection
        const tSnap = await getDocs(collection(db, 'tickets'));
        const queryLower = searchQuery.toLowerCase();
        
        const results = tSnap.docs.map(d => ({id: d.id, ...d.data() as any}))
            .filter(t => 
                t.ticketNumber?.includes(queryLower) || 
                t.userName?.toLowerCase().includes(queryLower) ||
                t.userPhone?.includes(queryLower)
            );
            
        setSearchResults(results.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
    } catch (e) {
        console.error(e);
    } finally {
        setIsSearching(false);
    }
  };

  const recoverTicket = async (ticket: any) => {
    try {
        await updateDoc(doc(db, 'tickets', ticket.id), {
            status: 'pending_payment',
            createdAt: serverTimestamp(), // Reset timer
            updatedAt: serverTimestamp()
        });
        alert('Ticket recuperado: Ahora está en pendientes con tiempo reiniciado.');
        handleSearchTickets(); // Refresh results
    } catch (e) {
        console.error(e);
        alert('Error al recuperar ticket');
    }
  };

  const deleteTicket = async (ticket: any) => {
    if (!confirm('¿Seguro que quieres eliminar este ticket?')) return;
    try {
        await deleteDoc(doc(db, 'tickets', ticket.id));
        alert('Ticket eliminado');
        handleSearchTickets();
    } catch (e) {
        console.error(e);
    }
  };

  const pendingGroups = useMemo(() => {
    const groups: Record<string, any> = {};
    pendingTickets.forEach(t => {
      const key = `${t.userId}_${t.raffleId}`;
      if (!groups[key]) {
        groups[key] = {
          id: key,
          userId: t.userId,
          userName: t.userName,
          userPhone: t.userPhone,
          raffleId: t.raffleId,
          raffleTitle: raffles.find(r => r.id === t.raffleId)?.title || 'Sorteo',
          tickets: [],
          createdAt: t.createdAt,
        };
      }
      groups[key].tickets.push(t);
      if (t.createdAt < groups[key].createdAt) {
        groups[key].createdAt = t.createdAt;
      }
    });
    return Object.values(groups).sort((a, b) => b.createdAt - a.createdAt);
  }, [pendingTickets, raffles]);

  const selectedGroup = useMemo(() => {
    if (!selectedGroupId) return null;
    return pendingGroups.find(g => g.id === selectedGroupId) || null;
  }, [selectedGroupId, pendingGroups]);

  // Drawer State
  const [winnerModalOpen, setWinnerModalOpen] = useState(false);
  const [activeRaffleForDraw, setActiveRaffleForDraw] = useState<any>(null);
  const [drawState, setDrawState] = useState<'setup' | 'idle' | 'shuffling' | 'eliminated' | 'winner'>('setup');
  const [attemptTarget, setAttemptTarget] = useState(1);
  const [currentAttempt, setCurrentAttempt] = useState(1);
  const [autoMode, setAutoMode] = useState(false);
  const [drawTickets, setDrawTickets] = useState<any[]>([]);
  const [availableTicketsPool, setAvailableTicketsPool] = useState<any[]>([]);
  const [currentDisplayTicket, setCurrentDisplayTicket] = useState<any>(null);

  const handleOpenDrawModal = async (raffle: any) => {
      setActiveRaffleForDraw(raffle);
      setDrawState('setup');
      setAttemptTarget(1);
      setCurrentAttempt(1);
      setAutoMode(false);
      setCurrentDisplayTicket(null);
      setWinnerModalOpen(true);
      
      try {
          const tSnap = await getDocs(query(collection(db, 'tickets')));
          const tickets = tSnap.docs.map(d => ({id: d.id, ...d.data() as any}))
              .filter((t: any) => t.raffleId === raffle.id && t.status === 'paid');
              
          setDrawTickets(tickets);
          setAvailableTicketsPool(tickets);
      } catch(e) {
          console.error(e);
          alert('Error al cargar tickets');
      }
  };

  const handleStartDraw = () => {
    if (availableTicketsPool.length === 0) return;
    setDrawState('shuffling');
    
    let shuffles = 0;
    const maxShuffles = 40; 
    const ticketsCopy = [...availableTicketsPool];
    
    let interval: any;
    interval = setInterval(() => {
        const randomIndex = Math.floor(Math.random() * ticketsCopy.length);
        setCurrentDisplayTicket(ticketsCopy[randomIndex]);
        shuffles++;
        
        if (shuffles >= maxShuffles) {
            clearInterval(interval);
            finishShuffle(ticketsCopy);
        }
    }, 100);
  };

  const finishShuffle = async (ticketsPool: any[]) => {
      const selectedIndex = Math.floor(Math.random() * ticketsPool.length);
      const selectedTicket = ticketsPool[selectedIndex];
      setCurrentDisplayTicket(selectedTicket);
      
      if (currentAttempt >= attemptTarget || ticketsPool.length === 1) {
          setDrawState('winner');
          await saveWinner(selectedTicket);
      } else {
          setDrawState('eliminated');
          setAvailableTicketsPool(ticketsPool.filter((_, i) => i !== selectedIndex));
      }
  };

  const saveWinner = async (winnerSelected: any) => {
      if (!activeRaffleForDraw) return;
      try {
          await updateDoc(doc(db, 'raffles', activeRaffleForDraw.id), {
              status: 'ended',
              winnerTicketId: winnerSelected.id,
              winnerUserId: winnerSelected.userId,
              winningTicketNumber: winnerSelected.ticketNumber,
              updatedAt: serverTimestamp()
          });
          
          for (const t of drawTickets) {
              await updateDoc(doc(db, 'tickets', t.id), {
                  status: t.id === winnerSelected.id ? 'won' : 'lost',
                  updatedAt: serverTimestamp()
              });
          }
          loadAdminData();
      } catch(e) {
          console.error(e);
          alert("Error guardando el ganador en la base de datos.");
      }
  };

  const handleNextAttempt = () => {
      setCurrentAttempt(prev => prev + 1);
      handleStartDraw();
  };

  useEffect(() => {
     let t: ReturnType<typeof setTimeout>;
     if (drawState === 'eliminated' && autoMode && currentAttempt < attemptTarget) {
         t = setTimeout(() => {
             handleNextAttempt();
         }, 1000);
     }
     return () => clearTimeout(t);
  }, [drawState, autoMode, currentAttempt, attemptTarget]);

  if (!dbUser || dbUser.role !== 'admin') {
      return <div className="p-20 text-center font-comic text-3xl text-red-500 bg-white border-4 border-black m-10 shadow-[8px_8px_0px_0px_#000] rotate-1">ACCESO DENEGADO</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-5xl font-comic text-black mb-12 inline-block bg-cyan-400 border-4 border-black px-6 py-2 shadow-[8px_8px_0px_0px_#000] transform -rotate-1 text-center sm:text-left">PANEL DE ADMINISTRACIÓN</h1>
      
      {/* Tabs */}
      <div className="flex flex-wrap gap-4 mb-10">
          <button 
              onClick={() => setActiveTab('raffles')}
              className={`px-6 py-2 font-comic text-xl border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_#000] transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none ${activeTab === 'raffles' ? 'bg-yellow-400' : 'bg-white'}`}
          >
              SORTEOS Y TICKETS
          </button>
          <button 
              onClick={() => setActiveTab('users')}
              className={`px-6 py-2 font-comic text-xl border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_#000] transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none ${activeTab === 'users' ? 'bg-cyan-400' : 'bg-white'}`}
          >
              USUARIOS
          </button>
          <button 
              onClick={() => setActiveTab('settings')}
              className={`px-6 py-2 font-comic text-xl border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_#000] transition-all hover:translate-x-1 hover:translate-y-1 hover:shadow-none ${activeTab === 'settings' ? 'bg-red-400 text-white' : 'bg-white'}`}
          >
              CONFIGURACIÓN YAPE
          </button>
      </div>

      {activeTab === 'raffles' && (
        <div className="space-y-10">
          {/* SECCIÓN SUPERIOR: TICKETS Y CREACIÓN */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
              
              {/* COLUMNA IZQUIERDA: PENDIENTES */}
              <div className="bg-white border-8 border-black rounded-[3rem] p-8 shadow-[12px_12px_0px_0px_#000] min-h-[500px] flex flex-col">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <Clock className="w-8 h-8 text-yellow-500" />
                      <h2 className="text-3xl font-comic text-black uppercase leading-none">Gestión de Tickets</h2>
                    </div>
                  </div>
                  
                  <div className="space-y-10 overflow-y-auto pr-2 flex-grow max-h-[700px] custom-scrollbar">
                      {/* SUBSECCIÓN: VIGENTES */}
                      <div>
                          <div className="flex items-center gap-3 mb-6">
                              <div className="bg-yellow-300 border-4 border-black px-4 py-1 rounded-2xl shadow-[4px_4px_0px_0px_#000]">
                                  <p className="font-comic text-xl">ÓRDENES PENDIENTES ({pendingGroups.length})</p>
                              </div>
                              <div className="h-1 flex-grow bg-black rounded-full opacity-10"></div>
                          </div>

                          <div className="space-y-4">
                              {pendingGroups.length === 0 ? (
                                  <div className="bg-gray-50 border-4 border-dashed border-gray-200 rounded-3xl p-10 text-center">
                                      <p className="text-gray-400 font-bold italic">No hay órdenes pendientes por el momento.</p>
                                  </div>
                              ) : (
                                  pendingGroups.map(group => {
                                      const earliestTicketTime = group.createdAt;
                                      const timeLeft = 3600000 - (now - earliestTicketTime);
                                      const isExpiring = timeLeft < 900000; // less than 15 mins
                                      const isExpired = timeLeft <= 0;
                                      
                                      const minutesLeft = Math.max(0, Math.floor(timeLeft / 60000));
                                      const secondsLeft = Math.max(0, Math.floor((timeLeft % 60000) / 1000));

                                      const normalCount = group.tickets.filter((t: any) => !t.isBonus).length;
                                      const bonusCount = group.tickets.filter((t: any) => t.isBonus).length;

                                      return (
                                          <div key={`${group.userId}_${group.raffleId}`} className={`p-5 border-4 border-black rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-[6px_6px_0px_0px_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all ${isExpired ? 'bg-red-100 border-red-600' : 'bg-yellow-50'}`}>
                                              <div className="space-y-2 flex-grow">
                                                  <div className="flex items-center gap-2">
                                                    <span className={`font-comic text-xl ${isExpired ? 'text-red-700' : ''}`}>{group.userName}</span>
                                                    <a href={`https://wa.me/${group.userPhone}`} target="_blank" rel="noreferrer" className="bg-green-400 border-2 border-black p-1 rounded-lg hover:scale-110 transition-transform">
                                                       <MessageCircle className="w-4 h-4" />
                                                    </a>
                                                  </div>
                                                  <div className="font-bold text-sm text-gray-700">
                                                      {group.raffleTitle}
                                                  </div>
                                                  <div className="flex flex-wrap gap-2 text-xs font-bold">
                                                      <span className="bg-black text-white px-3 py-1 rounded-full border-2 border-cyan-400">
                                                          {normalCount} {bonusCount > 0 ? `+ ${bonusCount} REGALO` : ''} TICKETS
                                                      </span>
                                                      <span className={`px-3 py-1 rounded-full border-2 border-black flex items-center gap-1 ${isExpired ? 'bg-red-600 text-white shadow-[2px_2px_0px_0px_#000]' : isExpiring ? 'bg-orange-400 text-black' : 'bg-white text-black'}`}>
                                                        <Clock className="w-3 h-3" />
                                                        {isExpired ? 'EXPIRADO' : `${minutesLeft}:${secondsLeft < 10 ? `0${secondsLeft}` : secondsLeft}`}
                                                      </span>
                                                  </div>
                                              </div>
                                              
                                              <button 
                                                  onClick={() => setSelectedGroupId(group.id)}
                                                  className={`w-full sm:w-auto font-bold px-6 py-3 rounded-2xl border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all flex items-center gap-2 ${isExpired ? 'bg-red-400 text-white' : 'bg-cyan-400 text-black hover:bg-cyan-300'}`}
                                              >
                                                  <Eye className="w-5 h-5" />
                                                  GESTIONAR
                                              </button>
                                          </div>
                                      );
                                  })
                              )}
                          </div>
                      </div>

                      {/* SUBSECCIÓN: RECUPERAR TICKETS */}
                      <div className="pt-10 border-t-8 border-black">
                          <div className="flex items-center gap-3 mb-6">
                              <div className="bg-red-400 border-4 border-black px-4 py-1 rounded-2xl shadow-[4px_4px_0px_0px_#000] text-white">
                                  <p className="font-comic text-xl">RECUPERAR TICKETS</p>
                              </div>
                              <div className="h-1 flex-grow bg-black rounded-full opacity-10"></div>
                          </div>

                          <div className="space-y-6">
                              <div className="flex gap-2">
                                  <input 
                                      type="text" 
                                      value={searchQuery}
                                      onChange={e => setSearchQuery(e.target.value)}
                                      onKeyDown={e => e.key === 'Enter' && handleSearchTickets()}
                                      placeholder="Buscar por Nombre, DNI o Ticket..."
                                      className="flex-grow border-4 border-black p-3 rounded-xl shadow-[4px_4px_0px_0px_#000] outline-none font-bold"
                                  />
                                  <button 
                                      onClick={handleSearchTickets}
                                      disabled={isSearching}
                                      className="bg-black text-white p-3 rounded-xl border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
                                  >
                                      {isSearching ? '...' : <Search className="w-6 h-6" />}
                                  </button>
                              </div>

                              {searchResults.length > 0 && (
                                  <div className="space-y-3 bg-gray-100 p-4 rounded-3xl border-4 border-black shadow-inner max-h-[400px] overflow-y-auto">
                                      {searchResults.map(t => (
                                          <div key={t.id} className="bg-white border-2 border-black p-3 rounded-xl flex justify-between items-center gap-4">
                                              <div className="text-xs">
                                                  <p className="font-black">#{t.ticketNumber} - {t.userName}</p>
                                                  <p className="text-gray-500">{t.status} | {new Date(t.createdAt?.toMillis?.() || t.createdAt).toLocaleDateString()}</p>
                                              </div>
                                              <div className="flex gap-2">
                                                  {t.status !== 'pending_payment' && (
                                                      <button 
                                                          onClick={() => recoverTicket(t)}
                                                          title="Poner en pendiente y reiniciar tiempo"
                                                          className="p-2 bg-yellow-300 border-2 border-black rounded-lg hover:scale-110 transition-transform"
                                                      >
                                                          <RotateCcw className="w-4 h-4" />
                                                      </button>
                                                  )}
                                                  <button 
                                                      onClick={() => deleteTicket(t)}
                                                      className="p-2 bg-red-100 text-red-500 border-2 border-black rounded-lg hover:bg-red-500 hover:text-white transition-all"
                                                  >
                                                      <XCircle className="w-4 h-4" />
                                                  </button>
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
              </div>
              
              {/* COLUMNA DERECHA: CREAR SORTEO */}
              <div className="bg-white border-8 border-black rounded-[3rem] p-8 shadow-[12px_12px_0px_0px_#ff4d4d] transform lg:rotate-1">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="bg-red-500 p-2 border-4 border-black rounded-xl">
                        <Ticket className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-3xl font-comic text-black uppercase leading-none">Crear Sorteo</h2>
                  </div>

                  <form onSubmit={handleCreateRaffle} className="space-y-6">
                      <div className="space-y-1">
                          <label className="block text-sm font-black ml-2 uppercase">Título del Sorteo</label>
                          <input 
                            type="text" 
                            value={title} 
                            onChange={e=>setTitle(e.target.value)} 
                            required 
                            placeholder="Ej: Sorteo de una Laptop"
                            className="w-full border-4 border-black p-4 rounded-3xl shadow-[6px_6px_0px_0px_#000] focus:shadow-none focus:translate-x-1 focus:translate-y-1 transition-all outline-none font-bold" 
                          />
                      </div>

                      <div className="space-y-1">
                          <label className="block text-sm font-black ml-2 uppercase">Descripción / Detalles</label>
                          <textarea 
                            value={description} 
                            onChange={e=>setDescription(e.target.value)} 
                            required 
                            placeholder="Detalla los premios y condiciones..."
                            className="w-full border-4 border-black p-4 rounded-3xl shadow-[6px_6px_0px_0px_#000] focus:shadow-none focus:translate-x-1 focus:translate-y-1 transition-all outline-none font-bold min-h-[120px]" 
                          />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div className="space-y-1">
                              <label className="block text-sm font-black ml-2 uppercase">Premio Principal</label>
                              <input 
                                type="text" 
                                value={prize} 
                                onChange={e=>setPrize(e.target.value)} 
                                required 
                                className="w-full border-4 border-black p-4 rounded-3xl shadow-[6px_6px_0px_0px_#000] outline-none font-bold" 
                              />
                          </div>
                          <div className="space-y-1">
                              <label className="block text-sm font-black ml-2 uppercase">Precio Ticket (S/)</label>
                              <input 
                                type="number" 
                                value={price} 
                                onChange={e=>setPrice(e.target.value)} 
                                required 
                                className="w-full sm:w-40 border-4 border-black p-4 rounded-3xl shadow-[6px_6px_0px_0px_#000] outline-none font-bold" 
                              />
                          </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div className="space-y-1">
                              <label className="block text-sm font-black ml-2 uppercase">Total de Tickets</label>
                              <input 
                                type="number" 
                                value={total} 
                                onChange={e=>setTotal(e.target.value)} 
                                required 
                                className="w-full border-4 border-black p-4 rounded-3xl shadow-[6px_6px_0px_0px_#000] outline-none font-bold" 
                              />
                          </div>
                          <div className="space-y-1">
                              <label className="block text-sm font-black ml-2 uppercase">Fecha de Finalización</label>
                              <div className="flex flex-col sm:flex-row gap-4">
                                <input 
                                  type="date" 
                                  value={endDateInput} 
                                  onChange={e=>setEndDateInput(e.target.value)} 
                                  required 
                                  className="flex-grow border-4 border-black p-4 rounded-3xl shadow-[6px_6px_0px_0px_#000] outline-none font-bold w-full" 
                                />
                                <input 
                                  type="time" 
                                  value={endTimeInput} 
                                  onChange={e=>setEndTimeInput(e.target.value)} 
                                  required 
                                  className="w-full sm:w-40 border-4 border-black p-4 rounded-3xl shadow-[6px_6px_0px_0px_#000] outline-none font-bold" 
                                />
                              </div>
                          </div>
                          <div className="space-y-1">
                              <label className="block text-sm font-black ml-2 uppercase">Meta para Regalo (Ej: 10)</label>
                              <div className="flex items-center gap-3">
                                  <input 
                                    type="number" 
                                    value={bonusThreshold} 
                                    onChange={e=>setBonusThreshold(e.target.value)} 
                                    placeholder="Cada X tickets dar 1 gratis"
                                    className="w-full border-4 border-black p-4 rounded-3xl shadow-[6px_6px_0px_0px_#000] outline-none font-bold" 
                                  />
                              </div>
                              <p className="text-[10px] font-bold ml-2 text-gray-500">Cada {bonusThreshold || 'X'} tickets comprados se regalará 1 automáticamente.</p>
                          </div>
                      </div>

                      <div className="space-y-1">
                          <label className="block text-sm font-black ml-2 uppercase">URL de la Imagen (Opcional)</label>
                          <input 
                            type="text" 
                            value={imageUrl} 
                            onChange={e=>setImageUrl(e.target.value)} 
                            placeholder="https://ejemplo.com/imagen.jpg"
                            className="w-full border-4 border-black p-4 rounded-3xl shadow-[6px_6px_0px_0px_#000] outline-none font-bold" 
                          />
                          {imageUrl && (
                            <div className="mt-2 border-4 border-black rounded-2xl overflow-hidden shadow-[4px_4px_0px_0px_#000] bg-gray-50 max-w-[200px] aspect-square">
                              <img src={imageUrl} alt="Vista previa del sorteo" className="w-full h-full object-cover" />
                            </div>
                          )}
                      </div>

                      <button 
                        type="submit" 
                        className="w-full bg-red-500 text-white font-comic text-2xl py-5 rounded-4xl border-4 border-black shadow-[8px_8px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all mt-4"
                      >
                        ¡PUBLICAR SORTEO!
                      </button>
                  </form>
              </div>
          </div>
          
          <div className="mt-12 bg-white border-4 border-black rounded-3xl p-8 shadow-[8px_8px_0px_0px_#000]">
              <h2 className="text-3xl font-comic text-black mb-6">SORTEOS ACTIVOS ({raffles.length})</h2>
              <div className="overflow-x-auto">
                  <table className="w-full border-4 border-black text-left rounded-xl overflow-hidden">
                      <thead className="bg-cyan-300 font-comic text-xl border-b-4 border-black">
                          <tr>
                              <th className="p-4 border-r-4 border-black">Título</th>
                              <th className="p-4 border-r-4 border-black">Estado</th>
                              <th className="p-4 border-r-4 border-black">Progreso</th>
                              <th className="p-4 border-r-4 border-black">Recaudado</th>
                              <th className="p-4">Acción</th>
                          </tr>
                      </thead>
                      <tbody>
                          {raffles.map((r, index) => {
                              const percentage = Math.floor(((r.soldTickets || 0) / (r.totalTickets || 1)) * 100);
                              return (
                                  <tr key={r.id} className={`border-b-4 border-black font-bold ${index % 2 === 0 ? 'bg-white' : 'bg-yellow-50'}`}>
                                      <td className="p-4 border-r-4 border-black">{r.title}</td>
                                      <td className="p-4 border-r-4 border-black">
                                          {r.status === 'active' ? (
                                              <span className="bg-green-300 px-2 py-1 border-2 border-black rounded shadow-[2px_2px_0px_0px_#000]">Activo</span>
                                          ) : (
                                              <span className="bg-gray-300 px-2 py-1 border-2 border-black rounded shadow-[2px_2px_0px_0px_#000]">Finalizado</span>
                                          )}
                                      </td>
                                      <td className="p-4 border-r-4 border-black">
                                          <div className="flex flex-col gap-1 min-w-[120px]">
                                              <div className="flex justify-between text-xs">
                                                  <span>{percentage}% vendido</span>
                                              </div>
                                              <div className="w-full bg-white border-2 border-black h-4 rounded-full overflow-hidden shadow-[2px_2px_0px_0px_#000]">
                                                  <div 
                                                      className="bg-cyan-400 h-full border-r-2 border-black" 
                                                      style={{ width: `${Math.min(percentage, 100)}%` }}
                                                  ></div>
                                              </div>
                                          </div>
                                      </td>
                                      <td className="p-4 border-r-4 border-black">S/ {((r.soldTickets || 0) * r.ticketPrice).toFixed(2)}</td>
                                  <td className="p-4">
                                      {r.status === 'active' && (
                                          <button onClick={() => handleOpenDrawModal(r)} className="bg-yellow-400 border-2 border-black px-3 py-1 rounded-xl shadow-[2px_2px_0px_0px_#000] hover:translate-y-0.5 hover:shadow-none hover:bg-yellow-500 transition-all">Sortear</button>
                                      )}
                                  </td>
                              </tr>
                          );
                      })}
                  </tbody>
                  </table>
              </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
          <div className="bg-white border-4 border-black rounded-3xl p-8 shadow-[8px_8px_0px_0px_#000]">
              <h2 className="text-3xl font-comic text-black mb-6">USUARIOS REGISTRADOS ({allUsers.length})</h2>
              <div className="overflow-x-auto">
                  <table className="w-full border-4 border-black text-left rounded-xl overflow-hidden">
                      <thead className="bg-cyan-300 font-comic text-xl border-b-4 border-black">
                          <tr>
                              <th className="p-4 border-r-4 border-black">Nombre Completo</th>
                              <th className="p-4 border-r-4 border-black">DNI</th>
                              <th className="p-4 border-r-4 border-black">WhatsApp / Email</th>
                              <th className="p-4 border-r-4 border-black">Dirección</th>
                              <th className="p-4 border-r-4 border-black">Rol</th>
                              <th className="p-4">Acción</th>
                          </tr>
                      </thead>
                      <tbody>
                          {allUsers.map((u, index) => (
                              <tr key={u.id} className={`border-b-4 border-black font-bold ${index % 2 === 0 ? 'bg-white' : 'bg-yellow-50'}`}>
                                  <td className="p-4 border-r-4 border-black">
                                      {u.name} {u.lastName}
                                  </td>
                                  <td className="p-4 border-r-4 border-black">{u.dni || '-'}</td>
                                  <td className="p-4 border-r-4 border-black">
                                      <p>{u.whatsapp || '-'}</p>
                                      <p className="text-xs text-gray-500 font-normal">{u.email}</p>
                                  </td>
                                  <td className="p-4 border-r-4 border-black text-sm">{u.address || '-'}</td>
                                  <td className="p-4 border-r-4 border-black uppercase text-sm">
                                      <span className={`px-2 py-1 border-2 border-black rounded shadow-[2px_2px_0px_0px_#000] ${u.role === 'admin' ? 'bg-red-400 text-white' : 'bg-gray-100'}`}>
                                        {u.role}
                                      </span>
                                  </td>
                                  <td className="p-4">
                                      {u.id !== user?.uid && (
                                          <button 
                                            onClick={() => handleToggleAdmin(u.id, u.role)} 
                                            className={`border-2 border-black px-3 py-1 rounded-xl shadow-[2px_2px_0px_0px_#000] hover:translate-y-0.5 hover:shadow-none transition-all ${u.role === 'admin' ? 'bg-gray-300' : 'bg-red-400 text-white'}`}
                                          >
                                              {u.role === 'admin' ? 'Quitar Admin' : 'Hacer Admin'}
                                          </button>
                                      )}
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {activeTab === 'settings' && (
          <div className="bg-white border-4 border-black rounded-3xl p-8 shadow-[8px_8px_0px_0px_#000] max-w-2xl mx-auto">
              <h2 className="text-3xl font-comic text-black mb-6">CONFIGURACIÓN DE PAGOS</h2>
              <form onSubmit={handleUpdateSettings} className="space-y-6">
                  <div>
                      <label className="block text-lg font-bold mb-1">Número de Yape / Plin</label>
                      <input 
                        type="text" 
                        value={appSettings.yapeNumber} 
                        onChange={e => setAppSettings({...appSettings, yapeNumber: e.target.value})} 
                        required 
                        placeholder="Ej: 987654321"
                        className="w-full border-4 border-black p-3 rounded-xl shadow-[4px_4px_0px_0px_#000] focus:shadow-[2px_2px_0px_0px_#000] focus:translate-x-0.5 focus:translate-y-0.5 transition-all outline-none" 
                      />
                  </div>
                  <div>
                      <label className="block text-lg font-bold mb-1">URL de Imagen Código QR</label>
                      <input 
                        type="text" 
                        value={appSettings.yapeQrUrl} 
                        onChange={e => setAppSettings({...appSettings, yapeQrUrl: e.target.value})} 
                        required 
                        placeholder="URL de la imagen del QR"
                        className="w-full border-4 border-black p-3 rounded-xl shadow-[4px_4px_0px_0px_#000] focus:shadow-[2px_2px_0px_0px_#000] focus:translate-x-0.5 focus:translate-y-0.5 transition-all outline-none" 
                      />
                  </div>
                  
                  <div>
                      <label className="block text-lg font-bold mb-1">WhatsApp de Soporte/Pagos</label>
                      <input 
                        type="text" 
                        value={appSettings.whatsappNumber || ''} 
                        onChange={e => setAppSettings({...appSettings, whatsappNumber: e.target.value})} 
                        required 
                        placeholder="Ej: 51987654321"
                        className="w-full border-4 border-black p-3 rounded-xl shadow-[4px_4px_0px_0px_#000] focus:shadow-[2px_2px_0px_0px_#000] focus:translate-x-0.5 focus:translate-y-0.5 transition-all outline-none" 
                      />
                      <p className="text-xs font-bold mt-1 text-gray-500">Incluir código de país (ej: 51 para Perú)</p>
                  </div>
                  
                  {appSettings.yapeQrUrl && (
                      <div className="border-4 border-black p-4 rounded-2xl bg-gray-50 flex flex-col items-center">
                          <p className="font-bold mb-2 uppercase text-sm">Vista Previa QR:</p>
                          <img src={appSettings.yapeQrUrl} alt="QR Preview" className="max-w-[200px] border-2 border-black" />
                      </div>
                  )}

                  <button type="submit" className="w-full bg-red-400 text-white font-comic text-2xl py-4 rounded-xl border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all mt-4">
                      GUARDAR CONFIGURACIÓN
                  </button>
              </form>
          </div>
      )}

      {winnerModalOpen && activeRaffleForDraw && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center p-4 py-12">
            <div className="bg-white border-8 border-black rounded-3xl p-8 max-w-lg w-full relative shadow-[16px_16px_0px_0px_#FFD700]">
                {drawState !== 'shuffling' && (
                    <button 
                        onClick={() => setWinnerModalOpen(false)}
                        className="absolute -top-6 -right-6 bg-red-500 text-white w-12 h-12 rounded-full border-4 border-black text-2xl font-bold hover:scale-110 transition-transform shadow-[4px_4px_0px_0px_#000]"
                    >
                        X
                    </button>
                )}
                
                <h2 className="text-4xl font-comic text-black text-center mb-6">SORTEO ACTIVO</h2>
                <h3 className="text-2xl font-bold text-center mb-8 bg-cyan-200 border-4 border-black inline-block px-4 py-2 transform -rotate-2">{activeRaffleForDraw.title}</h3>

                <div className="bg-gray-100 border-4 border-black rounded-2xl p-6 relative overflow-y-auto max-h-[70vh] shadow-inner mb-8 mt-4">
                    {drawState === 'setup' || drawState === 'idle' ? (
                        <div className="flex flex-col items-center justify-center min-h-[16rem]">
                            <Search className="w-16 h-16 mb-4 animate-pulse text-gray-400" />
                            <p className="font-comic text-xl text-center text-gray-500">¿QUIÉN SERÁ EL GANADOR?</p>
                            <p className="font-bold text-lg mt-2">Tickets válidos: {drawTickets.length}</p>
                        </div>
                    ) : (
                        <div className={`flex flex-col items-center justify-center transition-all ${drawState === 'winner' ? 'scale-110' : ''}`}>
                            <div className="relative w-48 h-48 sm:w-64 sm:h-64 mx-auto mb-6">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 sm:-translate-y-4 w-6 h-6 sm:w-8 sm:h-8 bg-red-600 rotate-45 border-r-4 border-b-4 border-black z-20 shadow-[2px_2px_0px_#000]"></div>
                                
                                <motion.div 
                                    className="w-full h-full rounded-full border-8 border-black shadow-[8px_8px_0px_0px_#000] relative overflow-hidden"
                                    style={{
                                        background: 'conic-gradient(#fcd34d 0deg 60deg, #ec4899 60deg 120deg, #3b82f6 120deg 180deg, #22c55e 180deg 240deg, #a855f7 240deg 300deg, #f97316 300deg 360deg)'
                                    }}
                                    initial={{ rotate: 0 }}
                                    animate={{ rotate: drawState === 'shuffling' ? 360 * 15 : 0 }}
                                    transition={{ duration: 4, ease: "circOut" }}
                                >
                                    <div className="absolute inset-0 flex items-center justify-center opacity-30 mix-blend-overlay">
                                         <div className="w-full h-1 bg-black absolute"></div>
                                         <div className="w-full h-1 bg-black absolute rotate-90"></div>
                                         <div className="w-full h-1 bg-black absolute rotate-45"></div>
                                         <div className="w-full h-1 bg-black absolute -rotate-45"></div>
                                    </div>
                                </motion.div>
                                
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full border-4 border-black z-10 flex items-center justify-center shadow-[inset_2px_2px_0px_#d1d5db]">
                                    <div className="w-4 h-4 rounded-full bg-black"></div>
                                </div>
                            </div>

                            <p className="font-bold text-lg mb-2 text-center max-w-[90%] break-words">
                                {drawState === 'winner' ? '¡TENEMOS GANADOR!' : drawState === 'eliminated' ? '¡SE FUE AL AGUA! 💦' : `INTENTO #${currentAttempt}`}
                            </p>
                            <div className={`font-comic text-4xl sm:text-6xl px-4 sm:px-6 py-2 border-4 border-black inline-block shadow-[4px_4px_0px_0px_#000] ${drawState === 'winner' ? 'bg-yellow-400 text-black rotate-3 animate-bounce' : drawState === 'eliminated' ? 'bg-red-500 text-white -rotate-2' : 'bg-white text-black'}`}>
                                #{currentDisplayTicket?.ticketNumber || '00000'}
                            </div>
                            
                            {(drawState === 'winner' || drawState === 'eliminated') && (
                                <div className="mt-6 text-center animate-pulse">
                                    <p className={`font-bold text-xl uppercase text-white border-2 border-black inline-block px-4 py-1 transform ${drawState === 'winner'? 'bg-green-500 -rotate-2' : 'bg-gray-500 rotate-2'}`}>
                                        {currentDisplayTicket?.userName}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {drawState === 'setup' && (
                    <div className="text-center">
                        <label className="font-bold mb-2 block text-lg">El ganador será el ticket sacado al intento nº:</label>
                        <div className="flex gap-4 justify-center items-center mb-4">
                            <input type="number" min="1" max={drawTickets.length} value={attemptTarget} onChange={e => setAttemptTarget(Number(e.target.value))} className="border-4 border-black p-2 font-comic text-2xl w-24 text-center rounded-xl shadow-[4px_4px_0px_#000]" />
                        </div>
                        <div className="flex justify-center flex-wrap gap-2 mb-6">
                            {[1, 2, 3].map(n => (
                                <button key={n} disabled={drawTickets.length < n} onClick={() => setAttemptTarget(n)} className={`px-4 py-2 border-4 border-black font-bold rounded-xl shadow-[2px_2px_0px_#000] hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 ${attemptTarget===n?'bg-yellow-400':'bg-white'}`}>A la {n}ª</button>
                            ))}
                            <button disabled={drawTickets.length === 0} onClick={() => setAttemptTarget(drawTickets.length)} className={`px-4 py-2 border-4 border-black font-bold rounded-xl shadow-[2px_2px_0px_#000] hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 ${attemptTarget===drawTickets.length?'bg-yellow-400':'bg-white'}`}>Último ({drawTickets.length})</button>
                        </div>
                        <button 
                            onClick={() => { setDrawState('idle'); }}
                            disabled={drawTickets.length === 0}
                            className={`w-full font-comic text-2xl py-4 rounded-xl border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all ${drawTickets.length === 0 ? 'bg-gray-400 text-gray-700 cursor-not-allowed' : 'bg-cyan-400 text-black hover:bg-cyan-500'}`}
                        >
                            {drawTickets.length === 0 ? 'NO HAY TICKETS VÁLIDOS' : 'CONFIGURAR'}
                        </button>
                    </div>
                )}

                {drawState === 'idle' && (
                    <button 
                        onClick={handleStartDraw}
                        className={`w-full font-comic text-2xl py-4 rounded-xl border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all bg-green-400 text-black hover:bg-green-500`}
                    >
                        ¡INICIAR RULETA! 🎰
                    </button>
                )}

                {drawState === 'eliminated' && (
                    <div className="flex gap-4">
                        <button 
                            onClick={handleNextAttempt}
                            className="flex-1 bg-yellow-400 text-black hover:bg-yellow-500 font-comic text-xl py-4 rounded-xl border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                        >
                            Intento {currentAttempt + 1}
                        </button>
                        <button 
                            onClick={() => {
                                setAutoMode(!autoMode);
                                if (!autoMode) handleNextAttempt();
                            }}
                            className={`px-6 font-bold py-4 rounded-xl border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all ${autoMode ? 'bg-purple-500 text-white' : 'bg-purple-300 text-black'}`}
                        >
                            Auto {autoMode ? 'ON' : 'OFF'}
                        </button>
                    </div>
                )}

                {drawState === 'shuffling' && (
                    <div className="w-full bg-yellow-400 text-black font-comic text-2xl py-4 rounded-xl border-4 border-black text-center animate-pulse">
                        GIRANDO...
                    </div>
                )}

                {drawState === 'winner' && (
                    <div className="flex flex-col gap-4">
                        <a 
                            href={`https://wa.me/${currentDisplayTicket?.userPhone?.replace(/\D/g,'')}?text=${encodeURIComponent(`¡Felicidades ${currentDisplayTicket?.userName}! Eres el ganador del sorteo "${activeRaffleForDraw?.title}" con tu ticket #${currentDisplayTicket?.ticketNumber}.`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full bg-green-500 text-white font-comic text-xl sm:text-2xl py-4 rounded-xl border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all text-center flex justify-center items-center gap-2"
                        >
                            <MessageCircle className="w-6 h-6 sm:w-8 sm:h-8" />
                            ENVIAR WHATSAPP
                        </a>
                        <button 
                            onClick={() => setWinnerModalOpen(false)}
                            className="w-full bg-cyan-400 text-black hover:bg-cyan-500 font-comic text-xl py-3 rounded-xl border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                        >
                            FINALIZAR
                        </button>
                    </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE APROBACIÓN DE ORDEN */}
      <AnimatePresence>
        {selectedGroup && (
            <div className="fixed inset-0 z-[110] overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className={`bg-white border-8 border-black rounded-[3rem] p-8 max-w-2xl w-full relative shadow-[16px_16px_0px_0px_#000] ${selectedGroup.createdAt && (now - selectedGroup.createdAt >= 3600000) ? 'border-red-600' : ''}`}
                >
                    <button 
                        onClick={() => setSelectedGroupId(null)}
                        className="absolute -top-4 -right-4 bg-red-500 text-white w-12 h-12 rounded-full border-4 border-black text-2xl font-bold flex items-center justify-center hover:scale-110 transition-transform shadow-[4px_4px_0px_0px_#000]"
                    >
                        X
                    </button>

                    <div className="mb-6">
                        <div className="flex justify-between items-start mb-2">
                            <h2 className="text-3xl font-comic text-black uppercase leading-none">Detalle de la Orden</h2>
                            {selectedGroup.createdAt && (now - selectedGroup.createdAt >= 3600000) && (
                                <span className="bg-red-600 text-white px-3 py-1 rounded-full font-black text-xs animate-pulse border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                                    TIEMPO AGOTADO
                                </span>
                            )}
                        </div>
                        <div className={`border-4 border-black p-4 rounded-2xl flex flex-col sm:flex-row justify-between gap-4 ${selectedGroup.createdAt && (now - selectedGroup.createdAt >= 3600000) ? 'bg-red-100' : 'bg-yellow-100'}`}>
                            <div>
                                <p className="font-black text-xl">{selectedGroup.userName}</p>
                                <p className="text-gray-600 font-bold">{selectedGroup.raffleTitle}</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <a href={`https://wa.me/${selectedGroup.userPhone}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-xl border-2 border-black font-bold hover:scale-105 transition-all">
                                    <MessageCircle className="w-5 h-5" />
                                    WhatsApp
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-100 border-4 border-black rounded-2xl p-6 mb-8 max-h-[300px] overflow-y-auto custom-scrollbar">
                        <p className="font-bold text-gray-500 mb-4 uppercase text-sm">Tickets en esta orden ({selectedGroup.tickets.length}):</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {selectedGroup.tickets.map((t: any) => (
                                <div key={t.id} className={`p-2 border-2 border-black rounded-lg text-center font-bold text-sm shadow-[2px_2px_0px_0px_#000] relative group ${t.isBonus ? 'bg-cyan-200' : (selectedGroup.createdAt && (now - selectedGroup.createdAt >= 3600000)) ? 'bg-red-50' : 'bg-white'}`}>
                                    <div>
                                        #{t.ticketNumber}
                                        {t.isBonus && <p className="text-[10px] text-cyan-700">REGALO</p>}
                                    </div>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleApproveTicket(t);
                                        }}
                                        title="Aprobar este ticket"
                                        className="mt-2 w-full bg-green-500 text-white rounded-md border-2 border-black py-1 flex items-center justify-center hover:scale-105 transition-transform"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button 
                            disabled={isApprovingAll}
                            onClick={() => handleApproveAllInGroup(selectedGroup)}
                            className="flex-grow bg-green-500 text-white font-comic text-2xl py-4 rounded-2xl border-4 border-black shadow-[6px_6px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                        >
                            {isApprovingAll ? 'APROBANDO...' : (
                                <>
                                    <CheckCircle className="w-8 h-8" />
                                    APROBAR TODO
                                </>
                            )}
                        </button>
                        {selectedGroup.createdAt && (now - selectedGroup.createdAt >= 3600000) && (
                            <button 
                                onClick={async () => {
                                    try {
                                        for (const t of selectedGroup.tickets) {
                                            await recoverTicket(t);
                                        }
                                        alert("Tiempo reiniciado para toda la orden");
                                    } catch (e) {
                                        console.error(e);
                                    }
                                }}
                                className="bg-yellow-400 text-black p-4 rounded-2xl border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center"
                                title="Reiniciar tiempo de toda la orden"
                            >
                                <RotateCcw className="w-8 h-8" />
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
}
