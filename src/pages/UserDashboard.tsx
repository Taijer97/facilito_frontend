import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, getDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../components/AuthProvider';
import { Ticket as TicketIcon, Clock, CheckCircle2, XCircle, Search } from 'lucide-react';
import { Link } from 'react-router';

export default function UserDashboard() {
  const { user, loading, dbUser } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [raffles, setRaffles] = useState<Record<string, any>>({});
  const [fetching, setFetching] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'participating' | 'winner'>('participating');

  useEffect(() => {
    if (!user) {
        if(!loading) setFetching(false);
        return;
    }

    async function loadData() {
        try {
            // Fetch user's tickets
            const q = query(
                collection(db, 'tickets'),
                where('userId', '==', user.uid)
            );
            const snap = await getDocs(q);
            const loadedTickets = snap.docs.map(d => {
                const data = d.data() as any;
                return { 
                    id: d.id, 
                    ...data,
                    createdAt: data.createdAt?.toMillis ? data.createdAt.toMillis() : (data.createdAt || Date.now())
                };
            });
            
            // Collect unique raffle IDs to fetch their details
            const raffleIds = Array.from(new Set(loadedTickets.map(t => t.raffleId)));
            const raffleData: Record<string, any> = {};
            
            for (const rId of raffleIds) {
                const rSnap = await getDoc(doc(db, 'raffles', rId as string));
                if (rSnap.exists()) {
                    raffleData[rId as string] = rSnap.data();
                }
            }
            
            setTickets(loadedTickets);
            setRaffles(raffleData);
        } catch (error) {
            console.error("Error loading tickets", error);
        } finally {
            setFetching(false);
        }
    }
    loadData();
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

  if (loading || fetching) return <div className="p-20 text-center font-comic text-2xl">CARGANDO TU PANEL...</div>;
  if (!user) return <div className="p-20 text-center font-comic text-2xl text-red-500">DEBES INICIAR SESIÓN PARA VER TU PANEL.</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white border-4 border-black rounded-3xl p-8 flex items-center space-x-6 mb-12 shadow-[8px_8px_0px_0px_#000] transform -rotate-1">
            <img 
            src={user.photoURL || `https://ui-avatars.com/api/?name=${user.email}`} 
            alt="Perfil" 
            className="w-24 h-24 rounded-full border-4 border-black shadow-[4px_4px_0px_0px_#000]"
            />
            <div>
                <h1 className="text-4xl font-comic text-black drop-shadow-[2px_2px_0px_#fff]">¡HOLA, {dbUser?.name?.split(' ')[0] || user.displayName?.split(' ')[0] || 'USUARIO'}!</h1>
                <p className="font-bold text-gray-600 bg-yellow-200 inline-block px-3 py-1 border-2 border-black rounded-xl mt-2 shadow-[2px_2px_0px_0px_#000] transform rotate-1 mr-4">{user.email}</p>
            </div>
        </div>

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
            </div>
        </div>
        
        {filteredTickets.length === 0 ? (
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
                                            {ticket.price === 0 && (
                                                <span className="text-[10px] font-bold bg-white px-1 border border-black rounded">GRATIS</span>
                                            )}
                                        </div>
                                        <div className="p-5 flex-grow flex flex-col relative bg-white">
                                            <div className="mb-4">
                                                <div className={`inline-block px-3 py-1 rounded-xl border-2 border-black font-bold text-sm transform ${
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
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-gray-400">Premio:</span>
                                                        <span className="text-black line-clamp-1 max-w-[120px]">{raffle.prize}</span>
                                                    </div>
                                                </div>
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
