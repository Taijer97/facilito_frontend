import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, getDoc, doc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../components/AuthProvider';
import { Ticket as TicketIcon, Clock, CheckCircle2, XCircle, Search, MessageCircle, User as UserIcon, X, Save } from 'lucide-react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';

export default function UserDashboard() {
  const { user, loading, dbUser } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [raffles, setRaffles] = useState<Record<string, any>>({});
  const [settings, setSettings] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'participating' | 'winner' | 'referrals'>('participating');
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const generateReferralCode = async () => {
      if (!user || dbUser?.referralCode) return;
      setIsGeneratingCode(true);
      try {
          const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
          await updateDoc(doc(db, 'users', user.uid), {
             referralCode: newCode
          });
      } catch (err) {
          console.error("Error generating referral code:", err);
          alert("Hubo un error al generar el código.");
      } finally {
          setIsGeneratingCode(false);
      }
  };

  const hasParticipatingTickets = tickets.some(t => t.status === 'paid' || t.status === 'won');

  useEffect(() => {
    if (!user) {
        if(!loading) setFetching(false);
        return;
    }

    const loadSettings = async () => {
        const settSnap = await getDoc(doc(db, 'settings', 'config'));
        if (settSnap.exists()) {
            setSettings(settSnap.data());
        }
    };
    loadSettings();

    const q = query(
        collection(db, 'tickets'),
        where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
        const loadedTickets = snap.docs.map(d => {
            const data = d.data() as any;
            return { 
                id: d.id, 
                ...data,
                createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || Date.now())
            };
        });
        
        const raffleIds = Array.from(new Set(loadedTickets.map(t => t.raffleId)));
        const raffleData: Record<string, any> = { ...raffles };
        
        for (const rId of raffleIds) {
            if (!raffleData[rId as string]) {
                const rSnap = await getDoc(doc(db, 'raffles', rId as string));
                if (rSnap.exists()) {
                    raffleData[rId as string] = rSnap.data();
                }
            }
        }
        
        setTickets(loadedTickets);
        setRaffles(raffleData);
        setFetching(false);
    });

    return () => unsubscribe();
  }, [user, loading]);

  const filteredTickets = tickets.filter(ticket => {
    if (activeTab === 'pending') return ticket.status === 'pending_payment' || ticket.status === 'rejected';
    if (activeTab === 'participating') {
        const isPending = ticket.status === 'pending_payment';
        const isExpired = isPending && (Date.now() - ticket.createdAt > 3600000);
        if (isExpired) return false;
        // Hide "lost" tickets from the Participating tab.
        return ticket.status === 'paid';
    }
    if (activeTab === 'winner') return ticket.status === 'won';
    return true;
  });

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const groupedTickets = filteredTickets.reduce((groups: Record<string, any[]>, ticket) => {
    const rId = ticket.raffleId;
    if (!groups[rId]) groups[rId] = [];
    groups[rId].push(ticket);
    return groups;
  }, {} as Record<string, any[]>);

  const handleClaimPrize = (ticket: any, raffle: any) => {
    if (!settings?.whatsappNumber) return;
    
    const winner = raffle.winners?.find((w: any) => w.ticketId === ticket.id);
    const prizeName = winner?.prize || (winner?.position === 1 ? raffle.prize : winner?.position === 2 ? raffle.prize2 : winner?.position === 3 ? raffle.prize3 : raffle.prize);
    const positionText = winner?.position ? `${winner.position}° puesto` : 'un premio';
    
    const message = `¡Hola! Soy ${dbUser?.name || user?.displayName || 'un ganador'}, gané ${positionText} en el sorteo "${raffle.title}" con el ticket #${ticket.ticketNumber} y me gustaría reclamar mi premio: ${prizeName}.`;
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${settings.whatsappNumber}?text=${encodedMessage}`, '_blank');
  };

  if (loading || fetching) return <div className="p-20 text-center font-comic text-2xl">CARGANDO TU PANEL...</div>;
  if (!user) return <div className="p-20 text-center font-comic text-2xl text-red-500">DEBES INICIAR SESIÓN PARA VER TU PANEL.</div>;

  const referralBaseUrl = import.meta.env.VITE_REFERRAL_BASE_URL || window.location.origin;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <button 
            onClick={() => setShowEditProfile(true)}
            className="w-full text-left group transition-transform hover:scale-[1.01] active:scale-100"
        >
            <div className="bg-white border-4 border-black rounded-3xl p-8 flex items-center space-x-6 mb-12 shadow-[8px_8px_0px_0px_#000] transform -rotate-1 group-hover:bg-yellow-50">
                <div className="relative">
                    <img 
                    src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} 
                    alt="Perfil" 
                    className="w-24 h-24 rounded-full border-4 border-black shadow-[4px_4px_0px_0px_#000]"
                    />
                    <div className="absolute -bottom-1 -right-1 bg-black text-white p-2 rounded-full border-2 border-white shadow-sm">
                        <UserIcon className="w-4 h-4" />
                    </div>
                </div>
                <div>
                    <h1 className="text-4xl font-comic text-black drop-shadow-[2px_2px_0px_#fff] flex items-center gap-3">
                        ¡HOLA, {dbUser?.name?.split(' ')[0] || user.displayName?.split(' ')[0] || 'USUARIO'}!
                        <span className="text-sm bg-black text-white px-2 py-0.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity font-bold uppercase">Editar Perfil</span>
                    </h1>
                    <p className="font-bold text-gray-600 bg-yellow-200 inline-block px-3 py-1 border-2 border-black rounded-xl mt-2 shadow-[2px_2px_0px_0px_#000] transform rotate-1 mr-4">{user.email}</p>
                </div>
            </div>
        </button>

        <AnimatePresence>
            {showEditProfile && (
                <EditProfileModal user={user} dbUser={dbUser} onClose={() => setShowEditProfile(false)} />
            )}
        </AnimatePresence>

        <div className="mb-8">
            <h2 className="text-4xl font-comic text-black inline-block bg-cyan-400 border-4 border-black px-6 py-2 shadow-[8px_8px_0px_0px_#000] rotate-1 mb-8">MIS TICKETS</h2>
            
            <div className="flex flex-wrap gap-4">
                <button 
                  onClick={() => setActiveTab('pending')}
                  className={`px-6 py-3 font-comic text-lg border-4 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none ${activeTab === 'pending' ? 'bg-yellow-300' : 'bg-white'}`}
                >
                  <span className="flex items-center gap-2">
                    <Clock className="w-5 h-5" /> 
                    PENDIENTES ({tickets.filter(t => t.status === 'pending_payment' || t.status === 'rejected').length})
                  </span>
                </button>
                <button 
                  onClick={() => setActiveTab('participating')}
                  className={`px-6 py-3 font-comic text-lg border-4 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none ${activeTab === 'participating' ? 'bg-green-400' : 'bg-white'}`}
                >
                  <span className="flex items-center gap-2">
                    <TicketIcon className="w-5 h-5" /> 
                    ¡PARTICIPANDO! ({tickets.filter(t => t.status === 'paid').length})
                  </span>
                </button>
                <button 
                  onClick={() => setActiveTab('winner')}
                  className={`px-6 py-3 font-comic text-lg border-4 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none ${activeTab === 'winner' ? 'bg-cyan-400 animate-pulse' : 'bg-white'}`}
                >
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" /> 
                    ¡GANADOR! ({tickets.filter(t => t.status === 'won').length})
                  </span>
                </button>
                <button 
                  onClick={() => setActiveTab('referrals')}
                  className={`px-6 py-3 font-comic text-lg border-4 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none ${activeTab === 'referrals' ? 'bg-purple-300' : 'bg-white'}`}
                >
                  <span className="flex items-center gap-2">
                    🎯 REFERIDOS
                  </span>
                </button>
            </div>
        </div>
        
        {activeTab === 'referrals' ? (
            <div className="bg-white rounded-3xl shadow-[8px_8px_0px_0px_#000] border-4 border-black p-8 max-w-3xl transform -rotate-1 mt-10">
                <h3 className="text-3xl font-comic text-black mb-6">Programa de Referidos</h3>
                <p className="text-gray-700 font-bold mb-6 text-lg">
                    ¡Por cada amigo que se registre con tu enlace y compre un ticket, ganarás <strong className="inline-flex items-center whitespace-nowrap text-purple-600 bg-purple-100 px-2 border-2 border-black rounded mx-1">S/ 1.00</strong> en saldo para tus próximos tickets!
                </p>
                <div className="bg-gray-50 border-4 border-black p-6 rounded-2xl mb-8">
                    <p className="text-sm font-black uppercase text-gray-500 mb-2">Tu Enlace de Referido</p>
                    {!dbUser?.referralCode ? (
                        <div className="flex flex-col sm:flex-row gap-3 items-center bg-white p-4 rounded-xl border-2 border-dashed border-gray-300">
                            <p className="flex-grow text-gray-500 font-bold text-sm text-center sm:text-left">Aún no tienes un código de referido.</p>
                            <button
                                onClick={generateReferralCode}
                                disabled={isGeneratingCode}
                                className="w-full sm:w-auto bg-purple-500 text-white px-6 py-3 rounded-xl font-bold border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-[0px_0px_0px_0px_#000] transition-all disabled:opacity-50 uppercase"
                            >
                                {isGeneratingCode ? 'Generando...' : 'Generar Código'}
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input 
                                readOnly 
                                value={`${referralBaseUrl}/?ref=${dbUser.referralCode}`} 
                                className="bg-white border-4 border-black rounded-xl p-3 flex-grow font-mono text-sm sm:text-base outline-none shadow-[2px_2px_0px_0px_#000]"
                            />
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(`${referralBaseUrl}/?ref=${dbUser.referralCode}`);
                                    setIsCopied(true);
                                    setTimeout(() => setIsCopied(false), 2000);
                                }}
                                className={`px-6 py-3 rounded-xl font-bold border-4 border-black transition-all flex items-center justify-center gap-2 ${isCopied ? 'bg-green-400 text-black translate-x-1 translate-y-1 shadow-[0px_0px_0px_0px_#000]' : 'bg-black text-white shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-[0px_0px_0px_0px_#000]'}`}
                            >
                                {isCopied ? (
                                    <>
                                        <CheckCircle2 className="w-5 h-5" /> Copiado
                                    </>
                                ) : (
                                    'Copiar Enlace'
                                )}
                            </button>
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="bg-purple-100 border-4 border-black rounded-2xl p-6 shadow-[4px_4px_0px_0px_#000] rotate-1">
                        <p className="text-sm font-black uppercase text-gray-600 mb-1">Amigos Referidos</p>
                        <p className="text-4xl font-comic text-black">{dbUser?.referralCount || 0}</p>
                    </div>
                    <div className="bg-green-100 border-4 border-black rounded-2xl p-6 shadow-[4px_4px_0px_0px_#000] -rotate-1">
                        <p className="text-sm font-black uppercase text-gray-600 mb-1">Saldo Ganado</p>
                        <p className="text-4xl font-comic text-black gap-1 flex items-center">
                            <span className="text-xl">S/</span>{(dbUser?.referralBalance || 0).toFixed(2)}
                        </p>
                    </div>
                </div>

                {/* List of referred friends */}
                <ReferralList referralCode={dbUser?.referralCode} />
            </div>
        ) : filteredTickets.length === 0 ? (
            <div className="bg-white rounded-3xl shadow-[8px_8px_0px_0px_#000] border-4 border-black p-12 text-center max-w-2xl mx-auto transform -rotate-1 mt-10">
                <div className="w-24 h-24 bg-gray-100 border-4 border-black rounded-full flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0px_0px_#000]">
                    <Search className="w-12 h-12 text-black opacity-20" />
                </div>
                <h2 className="text-3xl font-comic text-black mb-3">No hay tickets aquí</h2>
                <p className="text-black font-bold mb-8 text-lg">Parece que no tienes tickets en esta categoría.</p>
                {activeTab !== 'participating' && (
                    <button onClick={() => setActiveTab('participating')} className="text-red-500 font-bold underline">Ver mis otros tickets</button>
                )}
            </div>
        ) : (
            <div className="space-y-12">
                {(Object.entries(groupedTickets) as [string, any[]][]).map(([raffleId, raffleTickets]) => {
                    const raffle = raffles[raffleId];
                    return (
                        <div key={raffleId} className="space-y-6">
                            <div className="flex items-center space-x-4 border-b-4 border-black pb-4">
                                <div className="bg-white border-4 border-black px-4 py-1 rounded-xl shadow-[4px_4px_0px_0px_#000] transform -rotate-1">
                                    <h3 className="font-comic text-2xl text-black uppercase">{raffle?.title || 'SORTEO...'}</h3>
                                </div>
                                <span className="bg-yellow-200 border-2 border-black px-3 py-0.5 rounded-lg font-bold text-sm">
                                    {raffleTickets.length} {raffleTickets.length === 1 ? 'TICKET' : 'TICKETS'}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                {raffleTickets.map((ticket: any) => {
                                    const isPending = ticket.status === 'pending_payment';
                                    const timePassed = now - ticket.createdAt;
                                    const timeLeft = 3600000 - timePassed;
                                    const isExpired = isPending && timeLeft <= 0;
                                    
                                    const minutesLeft = Math.floor(timeLeft / 60000);
                                    const secondsLeft = Math.floor((timeLeft % 60000) / 1000);

                                    return (
                                    <div key={ticket.id} className={`bg-white border-4 border-black rounded-3xl overflow-hidden shadow-[8px_8px_0px_0px_#000] flex flex-col group hover:-translate-y-2 transition-transform ${isExpired ? 'opacity-60 grayscale' : ''}`}>
                                        <div className={`border-b-4 border-black p-3 flex justify-between items-center ${
                                            ticket.status === 'won' ? 'bg-cyan-400' : 
                                            isExpired ? 'bg-gray-300' :
                                            ticket.status === 'pending_payment' ? 'bg-yellow-300' :
                                            ticket.status === 'rejected' ? 'bg-red-400' : 'bg-green-400'
                                        }`}>
                                            <span className="font-comic text-xl text-black uppercase">NUM. {ticket.ticketNumber}</span>
                                            {ticket.paymentMethod === 'yape_auto' && (
                                                <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1 border border-green-300 rounded">AUTO</span>
                                            )}
                                            {ticket.price === 0 && (
                                                <span className="text-[10px] font-bold bg-white px-1 border border-black rounded ml-1">GRATIS</span>
                                            )}
                                        </div>
                                        <div className="p-5 flex-grow flex flex-col relative bg-white">
                                            <div className="mb-4">
                                                <div className={`inline-block whitespace-nowrap px-3 py-1 rounded-xl border-2 border-black font-bold text-sm transform ${
                                                  isExpired ? 'bg-gray-200 text-gray-500' :
                                                  ticket.status === 'pending_payment' ? 'bg-yellow-50 text-black -rotate-1 shadow-[2px_2px_0px_#000]' : 
                                                  ticket.status === 'paid' ? 'bg-green-50 text-black rotate-1 shadow-[2px_2px_0px_#000]' : 
                                                  ticket.status === 'won' ? 'bg-yellow-400 text-black -rotate-2 shadow-[2px_2px_0px_#000] animate-bounce' : 
                                                  ticket.status === 'lost' ? 'bg-gray-50 text-gray-500 shadow-[2px_2px_0px_#000]' :
                                                  'bg-red-50 text-red-600 shadow-[2px_2px_0px_#000]'
                                                }`}>
                                                    {isExpired ? '⌛ EXPIRADO' : 
                                                     ticket.status === 'pending_payment' ? '🕰️ PENDIENTE' : 
                                                     ticket.status === 'paid' ? '🎟️ ¡PARTICIPANDO!' : 
                                                     ticket.status === 'won' ? '🏆 ¡GANADOR!' : 
                                                     ticket.status === 'lost' ? '💨 No ganador' : 
                                                     '❌ Rechazado'}
                                                </div>
                                            </div>

                                            {isPending && !isExpired && (
                                                <div className="mb-4 p-2 bg-yellow-50 border-2 border-dashed border-yellow-400 rounded-xl text-center">
                                                    <p className="text-[10px] uppercase font-bold text-yellow-700">Vence en:</p>
                                                    <p className="font-comic text-xl text-black">
                                                        {minutesLeft}:{secondsLeft < 10 ? `0${secondsLeft}` : secondsLeft}
                                                    </p>
                                                </div>
                                            )}

                                            {isExpired && (
                                                <div className="mb-4 p-2 bg-red-50 border-2 border-dashed border-red-400 rounded-xl text-center">
                                                    <p className="text-[10px] uppercase font-bold text-red-700">Tiempo agotado</p>
                                                    <p className="font-bold text-xs">Vuelve a pedir tu ticket</p>
                                                </div>
                                            )}
                                        
                                            {raffle && (
                                                <div className="mt-auto space-y-2 pt-3 border-t-2 border-dashed border-gray-200 text-sm font-bold">
                                                    {ticket.status === 'won' && (() => {
                                                        const winner = raffle.winners?.find((w: any) => w.ticketId === ticket.id);
                                                        return winner ? (
                                                            <div className="flex justify-between items-center mb-1 text-red-500 italic">
                                                                <span>Posición:</span>
                                                                <span>{winner.position}° PUESTO</span>
                                                            </div>
                                                        ) : null;
                                                    })()}
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-gray-400">{ticket.status === 'won' ? '¡Premio ganado!' : 'Premio:'}</span>
                                                        <span className="text-black line-clamp-1 max-w-[120px]">
                                                            {ticket.status === 'won' 
                                                                ? (() => {
                                                                    const winner = raffle.winners?.find((w: any) => w.ticketId === ticket.id);
                                                                    if (!winner) return raffle.prize;
                                                                    return winner.prize || (winner.position === 1 ? raffle.prize : winner.position === 2 ? raffle.prize2 : winner.position === 3 ? raffle.prize3 : '');
                                                                  })()
                                                                : raffle.prize
                                                            }
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {ticket.status === 'won' && (
                                                <button 
                                                    onClick={() => handleClaimPrize(ticket, raffle)}
                                                    className="mt-4 w-full bg-green-500 border-2 border-black text-white font-bold py-2 rounded-xl flex items-center justify-center gap-2 shadow-[2px_2px_0px_0px_#000] hover:translate-y-0.5 hover:shadow-none transition-all uppercase text-xs"
                                                >
                                                    <MessageCircle className="w-4 h-4" />
                                                    Reclamar Premio
                                                </button>
                                            )}
                                            
                                            {isPending && !isExpired && (
                                                <Link to={`/sorteo/${ticket.raffleId}`} className="mt-4 w-full bg-black text-white text-xs font-bold py-2 rounded-lg text-center hover:bg-gray-800 transition-colors uppercase">
                                                    Ver como pagar
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                )})}
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
    </div>
  );
}

function ReferralList({ referralCode }: { referralCode: string | undefined }) {
  const [referredUsers, setReferredUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!referralCode) {
      setLoading(false);
      return;
    }

    async function fetchReferredUsers() {
      try {
        const q = query(
          collection(db, 'users'),
          where('referredBy', '==', referralCode),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        setReferredUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error("Error fetching referred users:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchReferredUsers();
  }, [referralCode]);

  if (loading) return <div className="mt-8 text-center text-gray-400 font-bold">Cargando referidos...</div>;
  if (referredUsers.length === 0) return (
    <div className="mt-8 p-6 border-2 border-dashed border-gray-300 rounded-2xl text-center text-gray-500 font-bold italic">
      Aún no has referido a nadie. ¡Comparte tu enlace!
    </div>
  );

  return (
    <div className="mt-10">
        <h4 className="font-comic text-xl text-black mb-4 uppercase">Amigos que se unieron ({referredUsers.length})</h4>
        <div className="space-y-3">
            {referredUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between bg-gray-50 border-2 border-black p-3 rounded-xl">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-200 border-2 border-black rounded-full flex items-center justify-center font-bold text-black uppercase">
                            {u.name?.[0] || '?'}
                        </div>
                        <div>
                            <p className="font-bold text-black">{u.name} {u.lastName}</p>
                            <p className="text-[10px] text-gray-500 font-mono">Unido el {u.createdAt?.toDate?.()?.toLocaleDateString() || 'recientemente'}</p>
                        </div>
                    </div>
                    {u.referralRewardClaimed ? (
                        <span className="bg-green-100 text-green-700 text-[10px] font-black px-2 py-1 rounded-full border border-green-200 uppercase">Recompensa Otorgada ✓</span>
                    ) : (
                        <span className="bg-yellow-100 text-yellow-700 text-[10px] font-black px-2 py-1 rounded-full border border-yellow-200 uppercase italic">Esperando Compra</span>
                    )}
                </div>
            ))}
        </div>
    </div>
  );
}

function EditProfileModal({ user, dbUser, onClose }: { user: any, dbUser: any, onClose: () => void }) {
    const [name, setName] = useState(dbUser?.name || '');
    const [lastName, setLastName] = useState(dbUser?.lastName || '');
    const [whatsapp, setWhatsapp] = useState(dbUser?.whatsapp || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return setError('El nombre es obligatorio');
        if (!lastName.trim()) return setError('El apellido es obligatorio');
        if (whatsapp && !/^\d{9}$/.test(whatsapp)) return setError('Número de WhatsApp inválido (debe tener 9 dígitos)');

        setSaving(true);
        setError('');

        try {
            await updateDoc(doc(db, 'users', user.uid), {
                name: name.trim(),
                lastName: lastName.trim(),
                whatsapp: whatsapp || null,
                updatedAt: serverTimestamp()
            });
            onClose();
        } catch (err: any) {
            console.error('Error saving profile:', err);
            setError('Error al guardar los cambios');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative bg-white border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_#000] w-full max-w-md p-8 overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-200 -mr-16 -mt-16 rounded-full border-4 border-black" />
                
                <div className="flex justify-between items-center mb-6 relative">
                    <h3 className="text-3xl font-comic text-black">EDITAR PERFIL</h3>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full border-2 border-black">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSave} className="space-y-6 relative">
                    {error && (
                        <div className="bg-red-100 border-2 border-red-500 text-red-600 p-3 rounded-xl font-bold flex items-center gap-2">
                            <XCircle className="w-5 h-5" />
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block font-bold text-black mb-2 uppercase text-sm">Nombres</label>
                            <input 
                                type="text" 
                                value={name} 
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const capitalized = val.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
                                    setName(capitalized);
                                }}
                                className="w-full text-lg font-bold border-4 border-black rounded-xl px-4 py-3 focus:bg-yellow-50 outline-none transition-all shadow-[4px_4px_0px_0px_#000] focus:translate-x-0.5 focus:translate-y-0.5 focus:shadow-none capitalize"
                                placeholder="Ej. Juan"
                            />
                        </div>
                        <div>
                            <label className="block font-bold text-black mb-2 uppercase text-sm">Apellidos</label>
                            <input 
                                type="text" 
                                value={lastName} 
                                onChange={(e) => {
                                    const val = e.target.value;
                                    const capitalized = val.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
                                    setLastName(capitalized);
                                }}
                                className="w-full text-lg font-bold border-4 border-black rounded-xl px-4 py-3 focus:bg-yellow-50 outline-none transition-all shadow-[4px_4px_0px_0px_#000] focus:translate-x-0.5 focus:translate-y-0.5 focus:shadow-none capitalize"
                                placeholder="Ej. Pérez García"
                            />
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2 font-bold uppercase italic">※ Asegúrate de incluir tus apellidos correctamente para validar tus premios.</p>

                    <div>
                        <label className="block font-bold text-black mb-2 uppercase text-sm">WhatsApp (9 dígitos)</label>
                        <input 
                            type="text" 
                            value={whatsapp} 
                            onChange={(e) => setWhatsapp(e.target.value)}
                            maxLength={9}
                            className="w-full text-lg font-bold border-4 border-black rounded-xl px-4 py-3 focus:bg-cyan-50 outline-none transition-all shadow-[4px_4px_0px_0px_#000] focus:translate-x-0.5 focus:translate-y-0.5 focus:shadow-none"
                            placeholder="Ej. 912345678"
                        />
                        <p className="text-[10px] text-gray-500 mt-2 font-bold uppercase italic">※ Usamos esto para contactarte si ganas un premio.</p>
                    </div>

                    <button 
                        type="submit"
                        disabled={saving}
                        className="w-full bg-black text-white font-bold py-4 rounded-2xl border-4 border-black shadow-[4px_4px_0px_0px_#facc15] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all flex items-center justify-center gap-3 disabled:opacity-50 mt-4 uppercase text-xl"
                    >
                        {saving ? 'Guardando...' : (
                            <>
                                <Save className="w-6 h-6" />
                                Guardar Cambios
                            </>
                        )}
                    </button>
                </form>
            </motion.div>
        </div>
    );
}
