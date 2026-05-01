import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, addDoc, updateDoc, doc, serverTimestamp, orderBy, onSnapshot, where, deleteDoc, increment } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../components/AuthProvider';
import { Search, MessageCircle, Clock, Zap, XCircle, Ticket, CheckCircle, RotateCcw, Eye, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

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
  const [appSettings, setAppSettings] = useState<{yapeNumber: string, yapeQrUrl: string, whatsappNumber: string, yapeName: string}>({yapeNumber: '', yapeQrUrl: '', whatsappNumber: '', yapeName: ''});
  const [activeTab, setActiveTab] = useState<'tickets' | 'raffles_create' | 'raffles_list' | 'users' | 'settings'>('tickets');
  const [isUploading, setIsUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  useEffect(() => {
    if (saveStatus !== 'idle' && saveStatus !== 'saving') {
      const timer = setTimeout(() => setSaveStatus('idle'), 3000);
      return () => clearTimeout(timer);
    }
  }, [saveStatus]);
  
  // New Raffle state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [prize, setPrize] = useState('');
  const [prize2, setPrize2] = useState('');
  const [prize3, setPrize3] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageUrl2, setImageUrl2] = useState('');
  const [imageUrl3, setImageUrl3] = useState('');
  const [showExtraPrizes, setShowExtraPrizes] = useState(false);
  const [price, setPrice] = useState('5');
  const [total, setTotal] = useState('100');
  const [bonusThreshold, setBonusThreshold] = useState('10');
  const [endDateInput, setEndDateInput] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [endTimeInput, setEndTimeInput] = useState('20:00');

  useEffect(() => {
    if (dbUser?.role !== 'admin' && dbUser?.role !== 'support') return;

    loadAdminData();
    if (dbUser?.role === 'admin') {
      loadUsers();
      loadSettings();
    }

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

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (!confirm(`¿Cambiar rol a ${newRole}?`)) return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        updatedAt: serverTimestamp()
      });
      loadUsers();
      alert('Rol actualizado');
    } catch (e) {
      console.error(e);
      alert('Error actualizando rol');
    }
  };

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

  const saveSettings = async (settings: any) => {
    setSaveStatus('saving');
    try {
      await updateDoc(doc(db, 'settings', 'config'), {
        ...settings,
        updatedAt: serverTimestamp()
      });
      setSaveStatus('success');
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#3b82f6', '#facc15', '#f87171']
      });
      return true;
    } catch (e) {
      // If document doesn't exist, try setting it
      try {
        const { setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'settings', 'config'), {
          ...settings,
          updatedAt: serverTimestamp()
        });
        setSaveStatus('success');
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#22c55e', '#3b82f6', '#facc15', '#f87171']
        });
        return true;
      } catch (err) {
        console.error(err);
        setSaveStatus('error');
        return false;
      }
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const settingsToSave = {
      yapeNumber: appSettings.yapeNumber.trim(),
      yapeQrUrl: appSettings.yapeQrUrl.trim(),
      whatsappNumber: appSettings.whatsappNumber.trim(),
      yapeName: (appSettings.yapeName || '').trim()
    };
    setAppSettings(settingsToSave);
    await saveSettings(settingsToSave);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setSaveStatus('saving');
    const formData = new FormData();
    formData.append('qr', file);

    try {
      const response = await fetch('/api/upload-qr', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Error al subir la imagen');
      }

      const data = await response.json();
      const updatedSettings = { ...appSettings, yapeQrUrl: data.url };
      setAppSettings(updatedSettings);
      
      const saved = await saveSettings(updatedSettings);
      if (!saved) {
        setSaveStatus('error');
      }
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    } finally {
      setIsUploading(false);
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
          const rafflesData = rSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          
          const tSnap = await getDocs(query(collection(db, 'tickets')));
          const allTickets = tSnap.docs.map(d => {
              const data = d.data();
              return {
                  id: d.id,
                  ...data,
                  createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || Date.now())
              };
          });

          const rafflesWithRealData = rafflesData.map(r => {
            const paidTickets = allTickets.filter(t => t.raffleId === r.id && t.status === 'paid');
            // Ground truth revenue: sum price of all paid non-bonus tickets
            const revenue = paidTickets.reduce((acc, t) => acc + (t.isBonus ? 0 : (t.price || r.ticketPrice || 0)), 0);
            return { 
              ...r, 
              calculatedRevenue: revenue,
              soldTickets: paidTickets.length // Use actual paid count for progress
            };
          });

          setRaffles(rafflesWithRealData);
          setPendingTickets(allTickets.filter((t: any) => t.status === 'pending_payment'));
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
              prize2: showExtraPrizes ? prize2 : '',
              prize3: showExtraPrizes ? prize3 : '',
              ticketPrice: Number(price),
              totalTickets: Number(total),
              status: 'active',
              endDate,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              description,
              imageUrl,
              imageUrl2: showExtraPrizes ? imageUrl2 : '',
              imageUrl3: showExtraPrizes ? imageUrl3 : '',
              bonusThreshold: Number(bonusThreshold) || 0,
              soldTickets: 0,
              revenue: 0,
              winnerTicketId: '',
              winnerUserId: '',
              winningTicketNumber: '',
              winners: [] // To store multiple winners if applicable
          });
          setTitle(''); 
          setPrize(''); 
          setPrize2('');
          setPrize3('');
          setShowExtraPrizes(false);
          setImageUrl(''); 
          setImageUrl2('');
          setImageUrl3('');
          setDescription('');
          setPrice('5');
          setTotal('100');
          setBonusThreshold('10');
          loadAdminData();
          alert('Sorteo creado con éxito');
          setActiveTab('raffles_list');
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
          
          // Increment soldTickets and revenue on Raffle
          const raffle = raffles.find(r => r.id === ticket.raffleId);
          if (raffle) {
              const updates: any = {
                 soldTickets: increment(1),
                 updatedAt: serverTimestamp()
              };
              // Only add price to revenue if it's not a bonus ticket
              if (!ticket.isBonus) {
                  updates.revenue = increment(ticket.price || raffle.ticketPrice || 0);
              }
              await updateDoc(doc(db, 'raffles', raffle.id), updates);
          }
          // Refresh data to show updated totals
          loadAdminData();
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

  const handleMarkClaimed = async (raffleId: string, winnerTicketId: string, isClaimed: boolean) => {
    try {
      const raffle = raffles.find(r => r.id === raffleId);
      if (!raffle) return;
      
      const updatedWinners = (raffle.winners || []).map((w: any) => {
        if (w.ticketId === winnerTicketId) {
          return { ...w, claimed: isClaimed };
        }
        return w;
      });
      
      await updateDoc(doc(db, 'raffles', raffleId), {
        winners: updatedWinners,
        updatedAt: serverTimestamp()
      });
      
      loadAdminData();
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
  const [drawingPosition, setDrawingPosition] = useState<1 | 2 | 3>(1);
  const [participantsModalOpen, setParticipantsModalOpen] = useState(false);
  const [selectedRaffleForParticipants, setSelectedRaffleForParticipants] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);

  const handleOpenParticipantsModal = async (raffle: any) => {
    setSelectedRaffleForParticipants(raffle);
    setParticipantsModalOpen(true);
    setIsLoadingParticipants(true);
    try {
      const q = query(collection(db, 'tickets'), where('raffleId', '==', raffle.id), where('status', '==', 'paid'));
      const snap = await getDocs(q);
      const tickets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      const groups: Record<string, any> = {};
      tickets.forEach((t: any) => {
        if (!groups[t.userId]) {
          groups[t.userId] = {
            userName: t.userName,
            userPhone: t.userPhone,
            tickets: []
          };
        }
        groups[t.userId].tickets.push(t.ticketNumber);
      });
      setParticipants(Object.values(groups));
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingParticipants(false);
    }
  };

  const handleOpenDrawModal = async (raffle: any) => {
      setActiveRaffleForDraw(raffle);
      setDrawState('setup');
      setAttemptTarget(1);
      setCurrentAttempt(1);
      setAutoMode(false);
      setCurrentDisplayTicket(null);
      // Logic: Start from 3rd if exists, else 2nd, else 1st
      const startPos = raffle.prize3 ? 3 : (raffle.prize2 ? 2 : 1);
      setDrawingPosition(startPos as 1 | 2 | 3);
      setWinnerModalOpen(true);
      
      try {
          const tSnap = await getDocs(query(collection(db, 'tickets')));
          // Only show tickets that haven't won a previous position in this raffle
          const winnersTicketIds = raffle.winners?.map((w: any) => w.ticketId) || [];
          
          const tickets = tSnap.docs.map(d => ({id: d.id, ...d.data() as any}))
              .filter((t: any) => t.raffleId === raffle.id && t.status === 'paid' && !winnersTicketIds.includes(t.id));
              
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
          const winnerData = {
              ticketId: winnerSelected.id,
              userId: winnerSelected.userId,
              userName: winnerSelected.userName,
              ticketNumber: winnerSelected.ticketNumber,
              position: drawingPosition,
              prize: (drawingPosition === 1 ? activeRaffleForDraw.prize : (drawingPosition === 2 ? activeRaffleForDraw.prize2 : activeRaffleForDraw.prize3)) || activeRaffleForDraw.prize,
              drawnAt: new Date().getTime()
          };

          // Filter out any existing winner for THIS position to allow redrawing/correction
          const otherPositionWinners = (activeRaffleForDraw.winners || []).filter((w: any) => w.position !== drawingPosition);
          const updatedWinners = [...otherPositionWinners, winnerData];

          // Update raffle with the new winner list
          const updateObj: any = {
              winners: updatedWinners,
              updatedAt: serverTimestamp()
          };

          // Update local state to prevent overwriting in consecutive draws
          setActiveRaffleForDraw({ ...activeRaffleForDraw, winners: updatedWinners });

          // If we are drawing the 1st prize (primary winner), we can optionally end the raffle
          if (drawingPosition === 1) {
              updateObj.status = 'ended';
              updateObj.winnerTicketId = winnerSelected.id;
              updateObj.winnerUserId = winnerSelected.userId;
              updateObj.winningTicketNumber = winnerSelected.ticketNumber;

              await updateDoc(doc(db, 'raffles', activeRaffleForDraw.id), updateObj);
              
              // Mark ALL tickets except other winners as lost, current as won
              // This is a big operation, we should be careful. 
              // But for smaller raffles it works.
              for (const t of drawTickets) {
                  const isCurrentWinner = t.id === winnerSelected.id;
                  const wasPreviousWinner = updatedWinners.some((w: any) => w.ticketId === t.id && w.position !== 1);
                  
                  if (isCurrentWinner || wasPreviousWinner) {
                      await updateDoc(doc(db, 'tickets', t.id), { status: 'won', updatedAt: serverTimestamp() });
                  } else {
                      await updateDoc(doc(db, 'tickets', t.id), { status: 'lost', updatedAt: serverTimestamp() });
                  }
              }
          } else {
              // Just update winners array for 2nd and 3rd place
              await updateDoc(doc(db, 'raffles', activeRaffleForDraw.id), updateObj);
              
              // Mark this specific ticket as won
              await updateDoc(doc(db, 'tickets', winnerSelected.id), {
                status: 'won',
                updatedAt: serverTimestamp()
              });

              // Remove the winner from the local pool for NEXT draw in this session
              setAvailableTicketsPool(prev => prev.filter(t => t.id !== winnerSelected.id));
              setDrawTickets(prev => prev.filter(t => t.id !== winnerSelected.id));
          }
          
          // Reset for next position or close
          if (drawingPosition === 1) {
            setWinnerModalOpen(false);
          } else {
            // Suggest next position (descending sequence if possible)
            setDrawState('setup');
            setCurrentAttempt(1);
            // If we just did 3rd, do 2nd. If 2nd, do 1st.
            setDrawingPosition(drawingPosition === 3 ? 2 : 1);
            // Current winner stays in UI for a moment or until next setup?
            // Actually setup resets currentDisplayTicket potentially? Let's check below.
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

  if (!dbUser || (dbUser.role !== 'admin' && dbUser.role !== 'support')) {
      return <div className="p-20 text-center font-comic text-3xl text-red-500 bg-white border-4 border-black m-10 shadow-[8px_8px_0px_0px_#000] rotate-1">ACCESO DENEGADO</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
      <h1 className="text-3xl sm:text-5xl font-comic text-black mb-8 sm:mb-12 inline-block bg-cyan-400 border-4 border-black px-4 sm:px-6 py-2 shadow-[6px_6px_0px_0px_#000] sm:shadow-[8px_8px_0px_0px_#000] transform sm:-rotate-1 text-center sm:text-left w-full sm:w-auto uppercase">{dbUser?.role === 'admin' ? 'PANEL ADMIN' : 'PANEL SOPORTE'}</h1>
      
      {/* Tabs */}
      <div className="flex flex-row overflow-x-auto pb-4 sm:pb-0 sm:flex-wrap gap-3 sm:gap-4 mb-8 sm:mb-10 no-scrollbar">
          {(dbUser?.role === 'admin' || dbUser?.role === 'support') && (
            <>
              <button 
                  onClick={() => setActiveTab('tickets')}
                  className={`whitespace-nowrap px-4 py-2 sm:px-6 sm:py-2 font-comic text-lg sm:text-xl border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_#000] transition-all ${activeTab === 'tickets' ? 'bg-yellow-400' : 'bg-white'}`}
              >
                  GESTIÓN TICKETS
              </button>
              <button 
                  onClick={() => setActiveTab('raffles_create')}
                  className={`whitespace-nowrap px-4 py-2 sm:px-6 sm:py-2 font-comic text-lg sm:text-xl border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_#000] transition-all ${activeTab === 'raffles_create' ? 'bg-orange-400' : 'bg-white'}`}
              >
                  NUEVO SORTEO
              </button>
              <button 
                  onClick={() => setActiveTab('raffles_list')}
                  className={`whitespace-nowrap px-4 py-2 sm:px-6 sm:py-2 font-comic text-lg sm:text-xl border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_#000] transition-all ${activeTab === 'raffles_list' ? 'bg-cyan-400' : 'bg-white'}`}
              >
                  LISTA SORTEOS
              </button>
            </>
          )}
          {dbUser?.role === 'admin' && (
            <>
              <button 
                  onClick={() => setActiveTab('users')}
                  className={`whitespace-nowrap px-4 py-2 sm:px-6 sm:py-2 font-comic text-lg sm:text-xl border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_#000] transition-all ${activeTab === 'users' ? 'bg-purple-400' : 'bg-white'}`}
              >
                  USUARIOS
              </button>
              <button 
                  onClick={() => setActiveTab('settings')}
                  className={`whitespace-nowrap px-4 py-2 sm:px-6 sm:py-2 font-comic text-lg sm:text-xl border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_#000] transition-all ${activeTab === 'settings' ? 'bg-red-400 text-white' : 'bg-white'}`}
              >
                  PAGOS
              </button>
            </>
          )}
      </div>

      {activeTab === 'tickets' && (
          <div className="space-y-8">
            <div className="bg-white border-4 sm:border-8 border-black rounded-3xl sm:rounded-[3rem] p-4 sm:p-8 shadow-[12px_12px_0px_0px_#000] sm:shadow-[12px_12px_0px_0px_#000] min-h-[400px] flex flex-col">
                <div className="flex items-center justify-between mb-6 sm:mb-8">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
                    <h2 className="text-2xl sm:text-3xl font-comic text-black uppercase leading-none">Validación de Tickets</h2>
                  </div>
                </div>
                
                <div className="space-y-10 overflow-y-auto pr-2 flex-grow max-h-[1000px] custom-scrollbar">
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="bg-yellow-300 border-4 border-black px-4 py-1 rounded-2xl shadow-[4px_4px_0px_0px_#000]">
                                <p className="font-comic text-xl">ÓRDENES PENDIENTES ({pendingGroups.length})</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {pendingGroups.length === 0 ? (
                                <div className="bg-gray-50 border-4 border-dashed border-gray-200 rounded-3xl p-10 text-center text-gray-400 font-bold italic">No hay órdenes pendientes.</div>
                            ) : (
                                pendingGroups.map(group => {
                                    const earliestTicketTime = group.createdAt;
                                    const timeLeft = 3600000 - (now - earliestTicketTime);
                                    const isExpired = timeLeft <= 0;
                                    const isExpiring = timeLeft < 900000; // 15 mins

                                    return (
                                        <div 
                                          key={group.id} 
                                          onClick={() => setSelectedGroupId(group.id)} 
                                          className={`p-5 border-4 border-black rounded-3xl flex justify-between items-center shadow-[6px_6px_0px_0px_#000] cursor-pointer hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all ${isExpired ? 'bg-red-50 border-red-500' : 'bg-yellow-50'}`}
                                        >
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <p className={`font-comic text-xl ${isExpired ? 'text-red-600' : ''}`}>{group.userName}</p>
                                                    {isExpired && <span className="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black">EXPIRADO</span>}
                                                </div>
                                                <p className="font-bold text-sm text-gray-700">{group.raffleTitle}</p>
                                                <div className="flex gap-2">
                                                    <p className="text-xs font-black bg-black text-white px-2 py-1 inline-block rounded-lg">{group.tickets.length} TICKETS</p>
                                                    {group.userPhone && (
                                                        <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                                                            <MessageCircle className="w-3 h-3" /> {group.userPhone}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <button className="bg-cyan-400 border-4 border-black px-4 py-2 rounded-xl font-bold shadow-[3px_3px_0px_0px_#000]">GESTIONAR</button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* RECUPERAR TICKETS (BUSQUEDA) */}
            <div className="bg-white border-4 border-black rounded-3xl p-6 sm:p-8 shadow-[12px_12px_0px_0px_#000]">
                <div className="flex items-center gap-3 mb-6">
                    <div className="bg-red-400 border-4 border-black px-4 py-1 rounded-2xl shadow-[4px_4px_0px_0px_#000] text-white">
                        <p className="font-comic text-xl uppercase">Buscador y Recuperación</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearchTickets()}
                            placeholder="Buscar por Nombre o Nro de Ticket..."
                            className="flex-grow border-4 border-black p-4 rounded-2xl shadow-[4px_4px_0px_0px_#000] outline-none font-bold"
                        />
                        <button 
                            onClick={handleSearchTickets}
                            disabled={isSearching}
                            className="bg-black text-white px-6 rounded-2xl border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
                        >
                            {isSearching ? '...' : <Search className="w-6 h-6" />}
                        </button>
                    </div>

                    {searchResults.length > 0 && (
                        <div className="space-y-3 bg-gray-100 p-4 rounded-3xl border-4 border-black shadow-inner max-h-[500px] overflow-y-auto">
                            {searchResults.map(t => (
                                <div key={t.id} className="bg-white border-2 border-black p-4 rounded-xl flex justify-between items-center gap-4 shadow-[3px_3px_0px_0px_#000]">
                                    <div>
                                        <p className="font-black text-lg">#{t.ticketNumber} - {t.userName}</p>
                                        <p className="text-xs font-bold text-gray-500 uppercase">{t.status} | {new Date(t.createdAt?.toMillis?.() || t.createdAt).toLocaleString()}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        {t.status !== 'pending_payment' && (
                                            <button 
                                                onClick={() => recoverTicket(t)}
                                                className="p-3 bg-yellow-300 border-2 border-black rounded-xl hover:scale-105 transition-transform shadow-[2px_2px_0px_0px_#000]"
                                                title="Revertir a pendiente"
                                            >
                                                <RotateCcw className="w-5 h-5" />
                                            </button>
                                        )}
                                        {(dbUser?.role === 'admin' || dbUser?.role === 'support') && (
                                            <button 
                                                onClick={() => deleteTicket(t)}
                                                className="p-3 bg-red-100 text-red-500 border-2 border-black rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-[2px_2px_0px_0px_#000]"
                                            >
                                                <XCircle className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
          </div>
      )}

      {activeTab === 'raffles_create' && (
        <div className="bg-white border-4 sm:border-8 border-black rounded-3xl sm:rounded-[3rem] p-4 sm:p-8 shadow-[12px_12px_0px_0px_#ff4d4d] sm:shadow-[12px_12px_0px_0px_#ff4d4d] max-w-4xl w-full mx-auto">
              <div className="flex items-center gap-2 sm:gap-3 mb-6 sm:mb-8">
                <div className="bg-red-500 p-2 border-2 sm:border-4 border-black rounded-xl">
                    <Ticket className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-comic text-black uppercase leading-none">Crear Sorteo</h2>
              </div>

              <form onSubmit={handleCreateRaffle} className="space-y-4 sm:space-y-6">
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
                          <label className="block text-sm font-black ml-2 uppercase">Premio Principal (1° Puesto)</label>
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

                  <div className="space-y-4">
                    <button 
                      type="button"
                      onClick={() => setShowExtraPrizes(!showExtraPrizes)}
                      className={`text-sm font-bold flex items-center gap-2 px-4 py-2 border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000] transition-all hover:bg-gray-100 ${showExtraPrizes ? 'bg-yellow-100' : 'bg-white'}`}
                    >
                      {showExtraPrizes ? '⊖ Quitar Premios Extra' : '⊕ Agregar 2° y 3° Puesto'}
                    </button>

                    {showExtraPrizes && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 border-4 border-dashed border-black rounded-3xl bg-gray-50 animate-in fade-in slide-in-from-top-2">
                         <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="block text-sm font-black ml-2 uppercase">2° Puesto - Premio</label>
                                <input 
                                  type="text" 
                                  value={prize2} 
                                  onChange={e=>setPrize2(e.target.value)} 
                                  placeholder="Segundo premio (Opcional)"
                                  className="w-full border-4 border-black p-4 rounded-2xl shadow-[4px_4px_0px_0px_#000] outline-none font-bold" 
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-sm font-black ml-2 uppercase">2° Puesto - URL Imagen</label>
                                <input 
                                  type="text" 
                                  value={imageUrl2} 
                                  onChange={e=>setImageUrl2(e.target.value)} 
                                  placeholder="https://ejemplo.com/premio2.jpg"
                                  className="w-full border-4 border-black p-4 rounded-2xl shadow-[4px_4px_0px_0px_#000] outline-none font-bold" 
                                />
                                {imageUrl2 && (
                                    <div className="mt-2 border-2 border-black rounded-xl overflow-hidden shadow-[2px_2px_0px_0px_#000] h-16 w-16">
                                        <img src={imageUrl2} className="w-full h-full object-cover" />
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="block text-sm font-black ml-2 uppercase">3° Puesto - Premio</label>
                                <input 
                                  type="text" 
                                  value={prize3} 
                                  onChange={e=>setPrize3(e.target.value)} 
                                  placeholder="Tercer premio (Opcional)"
                                  className="w-full border-4 border-black p-4 rounded-2xl shadow-[4px_4px_0px_0px_#000] outline-none font-bold" 
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-sm font-black ml-2 uppercase">3° Puesto - URL Imagen</label>
                                <input 
                                  type="text" 
                                  value={imageUrl3} 
                                  onChange={e=>setImageUrl3(e.target.value)} 
                                  placeholder="https://ejemplo.com/premio3.jpg"
                                  className="w-full border-4 border-black p-4 rounded-2xl shadow-[4px_4px_0px_0px_#000] outline-none font-bold" 
                                />
                                {imageUrl3 && (
                                    <div className="mt-2 border-2 border-black rounded-xl overflow-hidden shadow-[2px_2px_0px_0px_#000] h-16 w-16">
                                        <img src={imageUrl3} className="w-full h-full object-cover" />
                                    </div>
                                )}
                            </div>
                        </div>
                      </div>
                    )}
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
      )}

      {activeTab === 'raffles_list' && (
          <div className="bg-white border-4 border-black rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-[12px_12px_0px_0px_#000] sm:shadow-[8px_8px_0px_0px_#000]">
              <h2 className="text-2xl sm:text-3xl font-comic text-black mb-6 uppercase">Sorteos Activos ({raffles.length})</h2>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full border-2 sm:border-4 border-black text-left rounded-xl overflow-hidden min-w-[700px]">
                      <thead className="bg-cyan-300 font-comic text-xl border-b-4 border-black">
                          <tr>
                              <th className="p-4 border-r-4 border-black">Título</th>
                              <th className="p-4 border-r-4 border-black">Estado</th>
                              <th className="p-4 border-r-4 border-black">Progreso</th>
                              <th className="p-4 border-r-4 border-black">Recaudado</th>
                              <th className="p-4 border-r-4 border-black">Ganadores</th>
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
                                      <td className="p-4 border-r-4 border-black">S/ {(r.calculatedRevenue || 0).toFixed(2)}</td>
                                      <td className="p-4 border-r-4 border-black font-bold">
                                          <div className="flex flex-col gap-1">
                                              {r.winners && r.winners.length > 0 ? (
                                                  r.winners.sort((a:any, b:any) => a.position - b.position).map((w: any) => (
                                                      <div key={w.position} className={`text-xs p-1 rounded border border-black shadow-[1px_1px_0px_#000] relative group ${w.claimed ? 'bg-green-100 opacity-75' : 'bg-white'}`}>
                                                          <div className="flex justify-between items-start">
                                                              <div>
                                                                  <span className="font-black">{w.position}°:</span> {w.ticketNumber} - {w.userName}
                                                                  <div className="text-[10px] text-red-500 truncate mt-0.5">
                                                                    {w.prize || (w.position === 1 ? r.prize : w.position === 2 ? r.prize2 : w.position === 3 ? r.prize3 : '')}
                                                                  </div>
                                                                  {w.claimed && <div className="text-[9px] text-green-600 font-bold uppercase mt-0.5">✓ Entregado</div>}
                                                              </div>
                                                              <button 
                                                                onClick={() => handleMarkClaimed(r.id, w.ticketId, !w.claimed)}
                                                                className={`p-1 rounded border border-black shadow-[1px_1px_0px_#000] hover:translate-y-0.5 hover:shadow-none transition-all ${w.claimed ? 'bg-yellow-200' : 'bg-green-400'}`}
                                                                title={w.claimed ? 'Marcar como pendiente' : 'Marcar como entregado'}
                                                              >
                                                                {w.claimed ? <RotateCcw className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                                                              </button>
                                                          </div>
                                                      </div>
                                                  ))
                                              ) : (
                                                  <span className="text-gray-400 font-normal italic">Sin ganadores</span>
                                              )}
                                          </div>
                                      </td>
                                      <td className="p-4">
                                          <div className="flex flex-wrap gap-2">
                                              {r.status === 'active' && (dbUser?.role === 'admin' || dbUser?.role === 'support') && (
                                                  <button onClick={() => handleOpenDrawModal(r)} className="bg-yellow-400 border-2 border-black px-3 py-1 rounded-xl shadow-[2px_2px_0px_0px_#000] hover:translate-y-0.5 hover:shadow-none hover:bg-yellow-500 transition-all font-bold text-xs">Sortear</button>
                                              )}
                                              <button 
                                                  onClick={() => handleOpenParticipantsModal(r)}
                                                  className="bg-cyan-400 border-2 border-black px-3 py-1 rounded-xl shadow-[2px_2px_0px_0px_#000] hover:translate-y-0.5 hover:shadow-none hover:bg-cyan-500 transition-all font-bold text-xs flex items-center gap-1"
                                              >
                                                  <Eye className="w-3 h-3" /> Partic.
                                          </button>
                                          {r.status === 'ended' && dbUser?.role === 'admin' && (
                                              <button 
                                                  onClick={async () => {
                                                      if(confirm('¿Reactivar sorteo para corregir ganadores?')) {
                                                          await updateDoc(doc(db, 'raffles', r.id), { status: 'active' });
                                                          loadAdminData();
                                                      }
                                                  }}
                                                  className="bg-gray-200 border-2 border-black px-3 py-1 rounded-xl shadow-[2px_2px_0px_0px_#000] hover:translate-y-0.5 hover:shadow-none transition-all font-bold text-xs"
                                              >
                                                  Reactivar
                                              </button>
                                          )}
                                      </div>
                                  </td>
                              </tr>
                          );
                      })}
                  </tbody>
                  </table>
              </div>
          </div>
      )}

      {activeTab === 'users' && (
          <div className="bg-white border-4 border-black rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-[6px_6px_0px_0px_#000] sm:shadow-[8px_8px_0px_0px_#000]">
              <h2 className="text-2xl sm:text-3xl font-comic text-black mb-6">USUARIOS REGISTRADOS ({allUsers.length})</h2>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <table className="w-full border-2 sm:border-4 border-black text-left rounded-xl overflow-hidden min-w-[800px]">
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
                                      <select 
                                        value={u.role || 'user'} 
                                        disabled={u.id === user?.uid}
                                        onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                                        className={`px-2 py-1 border-2 border-black rounded shadow-[2px_2px_0px_0px_#000] font-black outline-none cursor-pointer disabled:cursor-not-allowed ${u.role === 'admin' ? 'bg-red-400 text-white' : u.role === 'support' ? 'bg-orange-400 text-white' : 'bg-gray-100'}`}
                                      >
                                          <option value="user" className="text-black bg-white">USUARIO</option>
                                          <option value="support" className="text-black bg-white">SOPORTE</option>
                                          <option value="admin" className="text-black bg-white">ADMIN</option>
                                      </select>
                                  </td>
                                  <td className="p-4">
                                      {u.id !== user?.uid && (
                                          <button 
                                            onClick={() => {
                                                if (confirm('¿Eliminar este usuario PERMANENTEMENTE?')) {
                                                    deleteDoc(doc(db, 'users', u.id)).then(() => loadUsers());
                                                }
                                            }} 
                                            className="border-2 border-black px-3 py-1 rounded-xl shadow-[2px_2px_0px_0px_#000] hover:translate-y-0.5 hover:shadow-none transition-all bg-red-100 text-red-600 hover:bg-red-600 hover:text-white"
                                          >
                                              Eliminar
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
          <div className="bg-white border-4 border-black rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-[6px_6px_0px_0px_#000] sm:shadow-[8px_8px_0px_0px_#000] max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-comic text-black mb-6">CONFIGURACIÓN DE PAGOS</h2>
              
              <AnimatePresence>
                {saveStatus !== 'idle' && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 20 }}
                    className={`mb-6 p-6 border-4 border-black rounded-2xl flex items-center justify-center gap-4 shadow-[8px_8px_0px_0px_#000] font-black text-xl sm:text-2xl ${
                      saveStatus === 'saving' ? 'bg-blue-300' :
                      saveStatus === 'success' ? 'bg-green-400' : 'bg-red-400'
                    }`}
                  >
                    {saveStatus === 'saving' && <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />}
                    {saveStatus === 'success' && <CheckCircle className="w-10 h-10 text-black" />}
                    {saveStatus === 'error' && <XCircle className="w-10 h-10 text-black" />}
                    <span className="uppercase tracking-tight">
                      {saveStatus === 'saving' ? 'Guardando...' :
                       saveStatus === 'success' ? '¡CAMBIOS GUARDADOS!' :
                       'ERROR AL GUARDAR'}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleUpdateSettings} className="space-y-6">
                  <div>
                      <label className="block text-lg font-bold mb-1">Nombre del Titular (Yape / Plin)</label>
                      <input 
                        type="text" 
                        value={appSettings.yapeName || ''} 
                        onChange={e => setAppSettings({...appSettings, yapeName: e.target.value})} 
                        required 
                        placeholder="Ej: Juan Pérez"
                        className="w-full border-4 border-black p-3 rounded-xl shadow-[4px_4px_0px_0px_#000] focus:shadow-[2px_2px_0px_0px_#000] focus:translate-x-0.5 focus:translate-y-0.5 transition-all outline-none" 
                      />
                  </div>
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
                      <label className="block text-lg font-bold mb-1">Código QR (Subir archivo)</label>
                      <div className="flex flex-col gap-2">
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={handleFileUpload}
                          disabled={isUploading}
                          className="w-full border-4 border-dashed border-black p-3 rounded-xl bg-gray-50 font-bold cursor-pointer hover:bg-gray-100 transition-colors"
                        />
                        <p className="text-xs text-gray-500 font-bold uppercase">Esto guardará la imagen en /public/qrs/ y actualizará la URL automáticamente.</p>
                      </div>
                  </div>

                  <div>
                      <label className="block text-lg font-bold mb-1">URL de Imagen Código QR (o manual)</label>
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

                  <button 
                    type="submit" 
                    disabled={saveStatus === 'saving'}
                    className={`w-full text-white font-comic text-2xl py-4 rounded-xl border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all mt-4 flex items-center justify-center gap-3 ${
                      saveStatus === 'saving' ? 'bg-blue-400' :
                      saveStatus === 'success' ? 'bg-green-500' :
                      saveStatus === 'error' ? 'bg-red-600' : 'bg-red-400'
                    }`}
                  >
                      {saveStatus === 'saving' ? (
                        <>
                          <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                          <span>GUARDANDO...</span>
                        </>
                      ) : saveStatus === 'success' ? (
                        <>
                          <CheckCircle className="w-6 h-6" />
                          <span>¡GUARDADO!</span>
                        </>
                      ) : saveStatus === 'error' ? (
                        <>
                          <XCircle className="w-6 h-6" />
                          <span>ERROR</span>
                        </>
                      ) : (
                        "GUARDAR CONFIGURACIÓN"
                      )}
                  </button>
              </form>
          </div>
      )}

      {winnerModalOpen && activeRaffleForDraw && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 backdrop-blur-sm sm:p-4">
          <div className="flex min-h-full items-center justify-center p-2 sm:p-4 py-8 sm:py-12">
            <div className="bg-white border-4 sm:border-8 border-black rounded-2xl sm:rounded-3xl p-4 sm:p-8 max-w-lg w-full relative shadow-[8px_8px_0px_0px_#FFD700] sm:shadow-[16px_16px_0px_0px_#FFD700]">
                {drawState !== 'shuffling' && (
                    <button 
                        onClick={() => setWinnerModalOpen(false)}
                        className="absolute -top-3 -right-3 sm:-top-6 sm:-right-6 bg-red-500 text-white w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 sm:border-4 border-black text-xl sm:text-2xl font-bold hover:scale-110 transition-transform shadow-[2px_2px_0px_0px_#000] sm:shadow-[4px_4px_0px_0px_#000]"
                    >
                        X
                    </button>
                )}
                
                <h2 className="text-3xl sm:text-4xl font-comic text-black text-center mb-2">SORTEO</h2>
                <div className="flex justify-center mb-4">
                    <div className={`px-4 py-1 border-4 border-black font-black uppercase text-sm shadow-[4px_4px_0px_0px_#000] rotate-1 ${drawingPosition === 1 ? 'bg-yellow-400' : drawingPosition === 2 ? 'bg-cyan-200' : 'bg-purple-300'}`}>
                        Dibujando para: {drawingPosition}° PUESTO
                    </div>
                </div>
                <h3 className="text-2xl font-bold text-center mb-8 bg-cyan-200 border-4 border-black inline-block px-4 py-2 transform -rotate-2 w-full">{activeRaffleForDraw.title}</h3>

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
                        <div className="mb-6">
                            <label className="font-black mb-2 block text-sm uppercase">Puesto a Sortear:</label>
                            <div className="flex justify-center gap-2">
                                <button 
                                    onClick={() => setDrawingPosition(1)}
                                    className={`flex-1 py-3 border-4 border-black rounded-xl font-bold transition-all shadow-[4px_4px_0px_0px_#000] ${drawingPosition === 1 ? 'bg-yellow-400' : 'bg-white'}`}
                                >
                                    1° Lugar
                                </button>
                                {activeRaffleForDraw.prize2 && (
                                    <button 
                                        onClick={() => setDrawingPosition(2)}
                                        className={`flex-1 py-3 border-4 border-black rounded-xl font-bold transition-all shadow-[4px_4px_0px_0px_#000] ${drawingPosition === 2 ? 'bg-cyan-200' : 'bg-white'}`}
                                    >
                                        2° Lugar
                                    </button>
                                )}
                                {activeRaffleForDraw.prize3 && (
                                    <button 
                                        onClick={() => setDrawingPosition(3)}
                                        className={`flex-1 py-3 border-4 border-black rounded-xl font-bold transition-all shadow-[4px_4px_0px_0px_#000] ${drawingPosition === 3 ? 'bg-purple-300' : 'bg-white'}`}
                                    >
                                        3° Lugar
                                    </button>
                                )}
                            </div>
                            <p className="text-xs font-bold mt-3 text-gray-500 italic">
                                Sorteando por: {drawingPosition === 1 ? activeRaffleForDraw.prize : (drawingPosition === 2 ? activeRaffleForDraw.prize2 : activeRaffleForDraw.prize3)}
                            </p>
                        </div>

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
                            href={`https://wa.me/${currentDisplayTicket?.userPhone?.replace(/\D/g,'')}?text=${encodeURIComponent(`¡Felicidades ${currentDisplayTicket?.userName}! Eres el ganador del ${drawingPosition}° PUESTO en el sorteo "${activeRaffleForDraw?.title}" con tu ticket #${currentDisplayTicket?.ticketNumber}.`)}`}
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
                    <div className="fixed inset-0 z-[110] overflow-y-auto flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm">
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className={`bg-white border-4 sm:border-8 border-black rounded-2xl sm:rounded-[3rem] p-4 sm:p-8 max-w-2xl w-full relative shadow-[8px_8px_0px_0px_#000] sm:shadow-[16px_16px_0px_0px_#000] ${selectedGroup.createdAt && (now - selectedGroup.createdAt >= 3600000) ? 'border-red-600' : ''}`}
                >
                    <button 
                        onClick={() => setSelectedGroupId(null)}
                        className="absolute -top-3 -right-3 sm:-top-4 sm:-right-4 bg-red-500 text-white w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 sm:border-4 border-black text-xl sm:text-2xl font-bold flex items-center justify-center hover:scale-110 transition-transform shadow-[2px_2px_0px_0px_#000] sm:shadow-[4px_4px_0px_0px_#000]"
                    >
                        X
                    </button>

                    <div className="mb-4 sm:mb-6">
                        <div className="flex justify-between items-start mb-2">
                            <h2 className="text-2xl sm:text-3xl font-comic text-black uppercase leading-none">Orden</h2>
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

      {/* MODAL DE PARTICIPANTES */}
      <AnimatePresence>
        {participantsModalOpen && selectedRaffleForParticipants && (
          <div className="fixed inset-0 z-[120] overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white border-4 sm:border-8 border-black rounded-3xl p-4 sm:p-8 max-w-3xl w-full relative shadow-[12px_12px_0px_0px_#000] max-h-[90vh] flex flex-col"
            >
              <button 
                onClick={() => setParticipantsModalOpen(false)}
                className="absolute -top-3 -right-3 bg-red-500 text-white w-10 h-10 rounded-full border-4 border-black font-bold flex items-center justify-center hover:scale-110 transition-transform shadow-[4px_4px_0px_0px_#000]"
              >
                X
              </button>

              <div className="mb-6">
                <h2 className="text-2xl sm:text-3xl font-comic text-black uppercase leading-none mb-2">Participantes</h2>
                <p className="font-bold text-cyan-600 bg-cyan-50 border-2 border-black px-3 py-1 rounded-xl inline-block">{selectedRaffleForParticipants.title}</p>
              </div>

              {isLoadingParticipants ? (
                <div className="flex-grow flex items-center justify-center py-20">
                  <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar space-y-4">
                  {participants.length === 0 ? (
                    <div className="text-center py-20 text-gray-400 font-bold italic">No hay participantes confirmados aún.</div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {participants.map((p, idx) => (
                        <div key={idx} className="bg-gray-50 border-2 border-black p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-[4px_4px_0px_0px_#000]">
                          <div>
                            <p className="font-black text-lg text-black uppercase">{p.userName}</p>
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                              <MessageCircle className="w-3 h-3" /> {p.userPhone}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1 max-w-sm justify-end">
                            {p.tickets.map((num: string) => (
                              <span key={num} className="bg-white border border-black px-2 py-0.5 rounded text-[10px] font-black shadow-[1px_1px_0px_0px_#000]">#{num}</span>
                            ))}
                            <span className="bg-black text-white px-2 py-0.5 rounded text-[10px] font-black">{p.tickets.length} TX</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 pt-4 border-t-4 border-black flex justify-between items-center">
                  <p className="font-black text-lg uppercase">Total: {participants.length} Usuarios</p>
                  <button 
                    onClick={() => setParticipantsModalOpen(false)}
                    className="bg-black text-white px-6 py-2 rounded-xl border-2 border-black font-bold shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all uppercase"
                  >
                    Cerrar
                  </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Saving Notification */}
      <AnimatePresence>
        {(saveStatus === 'success' || saveStatus === 'error') && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: -100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -100 }}
            className={`fixed top-10 left-1/2 -translate-x-1/2 z-[999] px-10 py-6 border-8 border-black rounded-[2rem] shadow-[12px_12px_0px_0px_#000] flex flex-col items-center gap-4 text-center ${
              saveStatus === 'success' ? 'bg-green-400' : 'bg-red-400'
            }`}
          >
            {saveStatus === 'success' ? (
              <div className="bg-white p-4 rounded-full border-4 border-black">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
            ) : (
              <div className="bg-white p-4 rounded-full border-4 border-black">
                <XCircle className="w-12 h-12 text-red-600" />
              </div>
            )}
            <div>
              <h3 className="text-3xl font-black uppercase text-black">
                {saveStatus === 'success' ? '¡ÉXITO!' : '¡ERROR!'}
              </h3>
              <p className="text-xl font-bold text-black/80">
                {saveStatus === 'success' ? 'Configuración guardada correctamente.' : 'No se pudo guardar la configuración.'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
