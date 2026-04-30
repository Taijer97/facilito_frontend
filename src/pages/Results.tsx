import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Trophy, PlayCircle } from 'lucide-react';

export default function Results() {
  const [raffles, setRaffles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPastRaffles() {
      try {
        const q = query(
          collection(db, 'raffles'),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        const endedRaffles = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((r: any) => r.status === 'ended');
        setRaffles(endedRaffles);
      } catch (error) {
        console.error("Error loading past raffles", error);
      } finally {
        setLoading(false);
      }
    }
    loadPastRaffles();
  }, []);

  const maskName = (name: string) => {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return name;

    return parts.map((part, index) => {
      if (index === 0) return part; // Keep first name
      if (part.length <= 1) return part;
      return part[0] + '*'.repeat(Math.min(part.length - 1, 5)); // Mask surnames, limit to 5 stars for a cleaner look or use actual length
    }).join(' ');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-comic text-black mb-6 inline-block bg-cyan-400 border-4 border-black px-6 py-2 shadow-[8px_8px_0px_0px_#000] rotate-1">
            RESULTADOS
        </h1>
        <p className="text-black font-bold text-xl max-w-2xl mx-auto mt-4 bg-white p-3 border-2 border-black inline-block transform -rotate-1 shadow-[4px_4px_0px_0px_#000]">Transparencia total. Aquí puedes ver todos nuestros sorteos pasados.</p>
      </div>

      {loading ? (
        <div className="p-20 text-center font-comic text-2xl">CARGANDO RESULTADOS...</div>
      ) : raffles.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border-4 border-black shadow-[8px_8px_0px_0px_#000] max-w-2xl mx-auto transform rotate-1">
          <div className="w-20 h-20 bg-yellow-300 border-4 border-black rounded-full flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0px_0px_#000]">
            <Trophy className="w-10 h-10 text-black" />
          </div>
          <h2 className="text-3xl font-comic text-black mb-2">Aún no hay sorteos finalizados</h2>
          <p className="text-black font-bold text-lg">Próximamente publicaremos aquí a nuestros primeros ganadores.</p>
        </div>
      ) : (
        <div className="space-y-10 max-w-4xl mx-auto">
          {raffles.map((raffle) => (
            <div key={raffle.id} className="bg-white rounded-3xl shadow-[8px_8px_0px_0px_#000] border-4 border-black overflow-hidden md:flex items-center hover:translate-x-1 hover:translate-y-1 hover:shadow-[4px_4px_0px_0px_#000] transition-all">
              <div className="md:w-1/3 bg-cyan-100 border-b-4 md:border-b-0 md:border-r-4 border-black h-56 md:h-full flex-shrink-0 relative">
                {raffle.imageUrl ? (
                  <img src={raffle.imageUrl} alt={raffle.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-comic text-black text-xl">Sin Imagen</div>
                )}
                <div className="absolute top-0 left-0 bg-yellow-400 text-black text-sm font-bold border-2 border-black px-3 py-1 m-4 rounded-xl shadow-[2px_2px_0px_0px_#000] flex items-center transform -rotate-3">
                  <Trophy className="w-4 h-4 mr-1 text-red-500" /> FINALIZADO
                </div>
              </div>
              <div className="p-8 md:w-2/3 flex flex-col justify-between">
                <div>
                  <h3 className="text-3xl font-comic text-black mb-2">{raffle.title}</h3>
                  <div className="space-y-1 mb-6">
                    <p className="text-black font-bold text-lg">1° Puesto: {raffle.prize}</p>
                    {raffle.prize2 && <p className="text-gray-700 font-bold text-sm">2° Puesto: {raffle.prize2}</p>}
                    {raffle.prize3 && <p className="text-gray-700 font-bold text-sm">3° Puesto: {raffle.prize3}</p>}
                  </div>
                </div>
                
                <div className="space-y-4">
                  {(raffle.winners && raffle.winners.length > 0) ? (
                    <div className="space-y-4">
                      {raffle.winners.sort((a: any, b: any) => (a.position || 0) - (b.position || 0)).map((w: any) => {
                        const winnerImage = w.position === 1 ? raffle.imageUrl : (w.position === 2 ? raffle.imageUrl2 : (w.position === 3 ? raffle.imageUrl3 : raffle.imageUrl));
                        const isFirst = w.position === 1;
                        
                        return (
                          <div 
                            key={`${raffle.id}_${w.position}`} 
                            className={`border-4 border-black rounded-3xl overflow-hidden flex flex-col sm:flex-row shadow-[6px_6px_0px_0px_#000] transition-all hover:scale-[1.01] ${
                              isFirst 
                                ? 'bg-yellow-200 ring-4 ring-yellow-400 ring-offset-4 ring-offset-white scale-[1.02] sm:scale-105 my-8' 
                                : w.position === 2 ? 'bg-cyan-100' : 'bg-purple-100'
                            }`}
                          >
                            {winnerImage && (
                              <div className={`sm:w-32 flex-shrink-0 border-b-4 sm:border-b-0 sm:border-r-4 border-black ${isFirst ? 'sm:w-48' : ''}`}>
                                <img src={winnerImage} alt={`Premio ${w.position}`} className="w-full h-full object-cover aspect-square sm:aspect-auto sm:h-full" />
                              </div>
                            )}
                            <div className={`p-4 sm:p-6 flex-grow flex flex-col justify-center ${isFirst ? 'sm:p-8' : ''}`}>
                              <div className="flex items-center justify-between gap-4 mb-2">
                                <div className="flex items-center gap-2">
                                  <Trophy className={`w-5 h-5 ${isFirst ? 'text-yellow-600 scale-125' : 'text-gray-500'}`} />
                                  <p className={`font-black uppercase tracking-widest ${isFirst ? 'text-sm text-yellow-800' : 'text-[10px] text-black'}`}>
                                      {w.position}° LUGAR {isFirst ? '🏆 GRAN PREMIO' : ''}
                                  </p>
                                </div>
                                {isFirst && (
                                  <span className="bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_#000] -rotate-3 animate-pulse">
                                    ¡GANADOR!
                                  </span>
                                )}
                              </div>
                              
                              <p className={`font-bold mb-3 ${isFirst ? 'text-lg text-black bg-white/50 px-2 py-1 rounded inline-block border border-yellow-400' : 'text-xs text-gray-600'}`}>
                                {w.prize || (w.position === 1 ? raffle.prize : w.position === 2 ? raffle.prize2 : w.position === 3 ? raffle.prize3 : '')}
                              </p>

                              <div className="flex items-center justify-between sm:justify-start gap-4 flex-wrap">
                                  <div className="relative">
                                    <p className={`font-comic text-red-500 drop-shadow-[2px_2px_0px_#fff] ${isFirst ? 'text-5xl sm:text-6xl' : 'text-3xl sm:text-4xl'}`}>#{w.ticketNumber}</p>
                                    <div className="absolute -top-1 -right-1 bg-black text-white text-[10px] px-1 rounded font-bold">№</div>
                                  </div>
                                  <p className={`font-black uppercase bg-white border-4 border-black shadow-[4px_4px_0px_0px_#000] ${isFirst ? 'text-xl sm:text-2xl px-6 py-2' : 'text-sm px-4 py-1'}`}>
                                    {maskName(w.userName)}
                                  </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-yellow-200 border-4 border-black rounded-2xl p-6 flex justify-between items-center shadow-[4px_4px_0px_0px_#000] transform rotate-1">
                      <div>
                        <p className="text-sm text-black font-bold uppercase tracking-wider mb-1">TICKET GANADOR</p>
                        <p className="font-comic text-4xl text-red-500 drop-shadow-[2px_2px_0px_#fff]">
                          {raffle.winningTicketNumber || '-----'}
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex justify-end pt-2">
                    <button className="flex items-center space-x-2 text-white bg-red-500 border-4 border-black px-4 py-2 rounded-xl hover:bg-black transition-colors font-bold shadow-[2px_2px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none text-sm">
                      <PlayCircle className="w-5 h-5" />
                      <span>Ver Sorteo</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
