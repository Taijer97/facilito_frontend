import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Clock, Users, ArrowRight } from 'lucide-react';

export default function ActiveRaffles() {
  const [raffles, setRaffles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'raffles'), where('status', '==', 'active'), orderBy('endDate', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snap) => {
      const rafflesData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRaffles(rafflesData);
      setLoading(false);
    }, (error) => {
      console.error("Error loading raffles", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div className="p-20 text-center font-comic text-2xl text-black">CARGANDO SORTEOS...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-16 text-center relative px-4">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-64 comic-sunburst opacity-10 -z-10 rounded-full blur-3xl"></div>
        <h1 className="text-5xl md:text-7xl font-comic text-black mb-6 inline-block bg-yellow-400 border-4 md:border-8 border-black px-8 py-4 shadow-[12px_12px_0px_0px_#000] -rotate-2 transform hover:rotate-0 transition-transform">
            SORTEOS ACTIVOS
        </h1>
        <p className="text-black font-black text-xl md:text-2xl max-w-2xl mx-auto mt-6 bg-white inline-block px-6 py-2 border-4 border-black rotate-1 shadow-[4px_4px_0px_0px_#000]">¡No te quedes fuera! 🔥 ¡Participa ahora!</p>
      </div>

      {raffles.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border-4 border-black shadow-[8px_8px_0px_0px_#000] transform rotate-1 max-w-2xl mx-auto">
          <div className="w-20 h-20 bg-cyan-200 border-4 border-black rounded-full flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0px_0px_#000] -rotate-6">
            <Clock className="w-10 h-10 text-black" />
          </div>
          <h2 className="text-2xl font-comic text-black mb-2">No hay sorteos activos ahora</h2>
          <p className="text-black font-bold">Vuelve pronto para ver nuestros nuevos premios.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {raffles.map((raffle) => (
            <Link key={raffle.id} to={`/sorteo/${raffle.id}`} className="group bg-white rounded-3xl shadow-[8px_8px_0px_0px_#000] hover:shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 transition-all border-4 border-black overflow-hidden flex flex-col">
              <div className="relative aspect-[4/3] border-b-4 border-black overflow-hidden bg-cyan-100">
                {raffle.imageUrl ? (
                  <img src={raffle.imageUrl} alt={raffle.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-black font-bold text-lg">SUPER PREMIO</div>
                )}
                <div className="absolute top-4 right-4 bg-red-500 text-white font-comic text-xl px-4 py-2 rounded-xl border-4 border-black shadow-[4px_4px_0px_0px_#000] transform rotate-3">
                  S/ {raffle.ticketPrice.toFixed(2)}
                </div>
              </div>
              <div className="p-6 flex-grow flex flex-col bg-yellow-50">
                <h3 className="text-2xl font-comic text-black mb-2 line-clamp-1">{raffle.title}</h3>
                <p className="text-black font-bold mb-4 line-clamp-2 flex-grow">{raffle.prize}</p>
                
                <div className="space-y-3 mb-6 bg-white border-2 border-black p-3 rounded-xl shadow-[4px_4px_0px_0px_#000]">
                  <div className="flex justify-between text-sm font-bold text-black">
                    <span className="flex items-center"><Users className="w-4 h-4 mr-1 text-red-500"/> Tickets</span>
                    <span>{raffle.soldTickets || 0} / {raffle.totalTickets}</span>
                  </div>
                  <div className="w-full bg-gray-200 border-2 border-black rounded-full h-4 overflow-hidden">
                    <div className="bg-cyan-400 h-full border-r-2 border-black transition-all duration-500" style={{ width: `${Math.min(100, ((raffle.soldTickets || 0) / raffle.totalTickets) * 100)}%` }}></div>
                  </div>
                </div>

                <div className="mt-auto bg-cyan-400 border-4 border-black py-3 px-4 rounded-xl shadow-[4px_4px_0px_0px_#000] group-hover:bg-yellow-400 transition-colors flex items-center justify-between text-black font-bold text-lg">
                  <span>¡PARTICIPAR!</span>
                  <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
