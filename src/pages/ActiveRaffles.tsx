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
    return <div className="p-20 text-center font-comic text-lg text-black">CARGANDO SORTEOS...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-4 lg:px-4 py-4 md:py-12">
      <div className="mb-6 text-center relative px-4">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md h-48 comic-sunburst opacity-10 -z-10 rounded-full blur-2xl"></div>
        <h1 className="text-lg md:text-lg font-comic text-black mb-4 inline-block bg-yellow-400 border-2 md:border-2 border-black px-4 py-3 shadow-[2px_2px_0px_0px_#000] -rotate-2 transform hover:rotate-0 transition-transform">
            SORTEOS ACTIVOS
        </h1>
        <p className="text-black font-black text-lg md:text-xl max-w-xl mx-auto mt-4 bg-white inline-block px-5 py-2 border-2 border-black rotate-1 shadow-[2px_2px_0px_0px_#000]">¡No te quedes fuera! 🔥 ¡Participa ahora!</p>
      </div>

      {raffles.length === 0 ? (
        <div className="bg-white rounded-xl p-4 text-center border-2 border-black shadow-[2px_2px_0px_0px_#000] transform rotate-1 max-w-2xl mx-auto">
          <div className="w-20 h-20 bg-cyan-200 border-2 border-black rounded-full flex items-center justify-center mx-auto mb-6 shadow-[2px_2px_0px_0px_#000] -rotate-6">
            <Clock className="w-10 h-10 text-black" />
          </div>
          <h2 className="text-lg font-comic text-black mb-2">No hay sorteos activos ahora</h2>
          <p className="text-black font-bold">Vuelve pronto para ver nuestros nuevos premios.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {raffles.map((raffle) => (
            <Link key={raffle.id} to={`/sorteo/${raffle.id}`} className="group bg-white rounded-xl shadow-[2px_2px_0px_0px_#000] hover:shadow-[2px_2px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 transition-all border-2 border-black overflow-hidden flex flex-col">
              <div className="relative aspect-[4/3] border-b-4 border-black overflow-hidden bg-cyan-100">
                {raffle.imageUrl ? (
                  <img src={raffle.imageUrl} alt={raffle.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-black font-bold text-lg">SUPER PREMIO</div>
                )}
                {raffle.bonusThreshold > 0 && (
                  <div className="absolute top-4 left-4 bg-green-500 text-white font-black text-xs px-3 py-1.5 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] transform -rotate-6 z-20 animate-pulse">
                    ¡LLEVA {raffle.bonusThreshold} + 1 GRATIS! 🎁
                  </div>
                )}
                <div className="absolute top-4 right-4 bg-red-500 text-white font-comic text-xl px-4 py-2 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] transform rotate-3">
                  S/ {raffle.ticketPrice.toFixed(2)}
                </div>
              </div>
              <div className="p-4 flex-grow flex flex-col bg-yellow-50">
                <h3 className="text-lg font-comic text-black mb-2 line-clamp-1">{raffle.title}</h3>
                <p className="text-black font-bold mb-4 line-clamp-2 flex-grow">{raffle.prize}</p>
                
                 <div className="space-y-3 mb-6 bg-white border-2 border-black p-3 rounded-xl shadow-[2px_2px_0px_0px_#000]">
                   <div className="flex justify-between text-sm font-bold text-black">
                     <span className="flex items-center text-xs uppercase"><Users className="w-3 h-3 mr-1 text-red-500"/> Recaudado</span>
                     <span className="text-xs">S/ {(raffle.revenue || 0).toFixed(0)} / S/ {raffle.revenueGoal || (raffle.totalTickets * raffle.ticketPrice) || 500}</span>
                   </div>
                   <div className="w-full bg-gray-200 border-2 border-black rounded-full h-3 overflow-hidden">
                     <div className="bg-cyan-400 h-full border-r-2 border-black transition-all duration-500" style={{ width: `${Math.min(100, (((raffle.revenue || 0) / (raffle.revenueGoal || (raffle.totalTickets * raffle.ticketPrice) || 500)) * 100))}%` }}></div>
                   </div>
                 </div>

                <div className="mt-auto bg-cyan-400 border-2 border-black py-3 px-4 rounded-xl shadow-[2px_2px_0px_0px_#000] group-hover:bg-yellow-400 transition-colors flex items-center justify-between text-black font-bold text-lg">
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
