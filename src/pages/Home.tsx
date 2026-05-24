import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Trophy, ShieldCheck, Ticket, Star, Zap, Clock } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Home() {
  const [featuredRaffle, setFeaturedRaffle] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<{days: number, hours: number, min: number, seg: number}>({days: 0, hours: 0, min: 0, seg: 0});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'raffles'), 
      where('status', '==', 'active'), 
      orderBy('endDate', 'asc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setFeaturedRaffle({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setFeaturedRaffle(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching featured raffle:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!featuredRaffle?.endDate) return;

    const timer = setInterval(() => {
      const end = new Date(featuredRaffle.endDate).getTime();
      const now = new Date().getTime();
      const distance = end - now;

      if (distance < 0) {
        clearInterval(timer);
        setTimeLeft({ days: 0, hours: 0, min: 0, seg: 0 });
        return;
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const min = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seg = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, min, seg });
    }, 1000);

    return () => clearInterval(timer);
  }, [featuredRaffle]);

  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="relative comic-sunburst py-10 md:py-16 overflow-hidden border-b-4 border-black">
        {/* Comic background elements decoration */}
        <div className="absolute top-5 left-5 text-black opacity-10 transform -rotate-12 animate-pulse hidden md:block">
            <Star className="w-16 h-16" fill="currentColor" />
            <span className="font-comic text-lg block mt-1">¡BOOM!</span>
        </div>
        <div className="absolute bottom-5 right-5 text-black opacity-10 transform rotate-12 animate-bounce hidden md:block">
            <Zap className="w-20 h-20" fill="currentColor" />
            <span className="font-comic text-lg block mt-1 text-right">¡POW!</span>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-4 lg:px-4 relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="md:w-1/2 space-y-3 text-center md:text-left mb-6 md:mb-0">
            <div className="inline-block bg-white text-black font-bold px-3 py-1 border-2 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transform -rotate-2 mb-2 text-xs">
              {featuredRaffle ? '🌟 SORTEO ACTIVO 🌟' : '¡MUY PRONTO!'}
            </div>
            <h1 className="text-xl md:text-lg font-comic text-black leading-tight drop-shadow-[2px_2px_0px_#fff]">
              {featuredRaffle ? (
                <>GANA UN <br/> <span className="text-red-500 drop-shadow-[2px_2px_0px_#000]">{featuredRaffle.prize.length > 20 ? featuredRaffle.prize.substring(0, 20) + '...' : featuredRaffle.prize}</span></>
              ) : (
                <>NUEVOS <br/> <span className="text-red-500 drop-shadow-[2px_2px_0px_#000]">PREMIOS</span></>
              )}
            </h1>
            <p className="text-sm text-black font-bold max-w-sm mx-auto md:mx-0 bg-white inline-block px-2 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_#000] rotate-1">
              {featuredRaffle ? `¡Participa hoy desde S/${featuredRaffle.ticketPrice}!` : 'Regístrate para recibir notificaciones.'}
            </p>
            <div className="flex justify-center md:justify-start pt-3">
              <Link to="/sorteos" className="bg-red-500 text-white font-comic text-lg px-5 py-2 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center space-x-2 group">
                <span>{featuredRaffle ? '¡COMPRAR!' : 'VER TODO'}</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          <div className="md:w-5/12 lg:w-4/12 bg-white comic-border p-4 rounded-xl comic-shadow transform rotate-2 max-w-sm">
              <div className="bg-cyan-400 border-2 border-black rounded-xl p-1.5 text-center mb-3 shadow-[2px_2px_0px_0px_#000] transform -rotate-2">
                  <span className="text-base font-comic tracking-wider text-black font-bold">Próximo Sorteo en:</span>
              </div>
              
              <div className="grid grid-cols-4 gap-2 text-center mb-4">
                {[
                  { val: timeLeft.days, label: 'Días' },
                  { val: timeLeft.hours, label: 'Horas' },
                  { val: timeLeft.min, label: 'Min' },
                  { val: timeLeft.seg, label: 'Seg' }
                ].map((item) => (
                  <div key={item.label} className="bg-yellow-300 border-2 border-black rounded-lg p-1.5 shadow-[2px_2px_0px_0px_#000]">
                    <div className="text-xl font-bold font-comic text-red-500 drop-shadow-[1px_1px_0px_#000]">
                      {item.val < 10 ? `0${item.val}` : item.val}
                    </div>
                    <div className="text-[9px] text-black font-bold mt-0.5 uppercase tracking-tighter">{item.label}</div>
                  </div>
                ))}
              </div>
              
              {featuredRaffle ? (
                <div className="bg-cyan-100 border-2 border-black rounded-xl overflow-hidden shadow-[3px_3px_0px_0px_#000]">
                    {featuredRaffle.imageUrl ? (
                      <div className="h-32 w-full border-b-2 border-black overflow-hidden bg-cyan-200">
                        <img src={featuredRaffle.imageUrl} alt={featuredRaffle.title} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="h-32 w-full flex items-center justify-center bg-cyan-200 border-b-2 border-black">
                        <Ticket className="w-8 h-8 text-black opacity-30" />
                      </div>
                    )}
                    {featuredRaffle.bonusThreshold > 0 && (
                      <div className="absolute top-2 left-2 bg-green-500 text-white font-black text-[9px] px-2 py-1 rounded-md border-2 border-black shadow-[2px_2px_0px_0px_#000] transform -rotate-12 z-20 animate-pulse">
                        ¡LLEVA {featuredRaffle.bonusThreshold} + 1 GRATIS! 🎁
                      </div>
                    )}
                    <div className="p-3 text-center bg-white">
                        <h3 className="text-black font-comic text-lg mb-1 truncate">{featuredRaffle.title}</h3>
                        <p className="text-red-500 font-bold text-sm mb-2 bg-yellow-200 inline-block px-2 py-0.5 border-2 border-black rounded-md shadow-[2px_2px_0px_0px_#000] transform -rotate-2">Ticket: S/{featuredRaffle.ticketPrice}</p>
                        <Link to={`/sorteo/${featuredRaffle.id}`} className="block w-full bg-cyan-400 text-black border-2 border-black font-bold text-sm py-1.5 rounded-lg shadow-[2px_2px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all">Participar Ahora</Link>
                    </div>
                </div>
              ) : (
                <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-2xl p-4 text-center">
                    <Clock className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-400 font-bold text-sm">¡Pronto anunciaremos el próximo sorteo!</p>
                </div>
              )}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="py-4 md:py-12 relative overflow-hidden bg-white border-y-4 border-black">
        {/* Decorative dots background */}
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 2px, transparent 2px)', backgroundSize: '16px 16px' }}></div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-4 lg:px-4 relative z-10">
          <div className="text-center mb-4">
            <h2 className="text-lg md:text-xl lg:text-lg font-comic text-black mb-3 drop-shadow-[2px_2px_0px_#facc15]">¿CÓMO FUNCIONA?</h2>
            <p className="text-sm md:text-base font-black text-black bg-cyan-400 inline-block px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_#000] transform rotate-1 uppercase">¡Gana en solo 3 pasos! 🚀</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col items-center text-center bg-yellow-100 comic-border rounded-xl p-4 comic-shadow-sm transform md:-rotate-1 hover:rotate-1 transition-all hover:bg-yellow-200">
              <div className="w-12 h-12 comic-gradient-yellow border-2 border-black rounded-full flex items-center justify-center mb-3 shadow-[2px_2px_0px_0px_#000]">
                <Ticket className="w-6 h-6 text-black" />
              </div>
              <h3 className="text-lg md:text-xl font-comic text-black mb-1.5">1. Elige tickets</h3>
              <p className="text-black font-bold text-xs md:text-sm leading-tight uppercase">Selecciona el sorteo que más te guste y elige la cantidad de tickets.</p>
            </div>
            
            <div className="flex flex-col items-center text-center bg-cyan-100 comic-border rounded-xl p-4 comic-shadow-sm transform md:translate-y-2 hover:-translate-y-1 transition-all hover:bg-cyan-200">
              <div className="w-12 h-12 comic-gradient-cyan border-2 border-black rounded-full flex items-center justify-center mb-3 shadow-[2px_2px_0px_0px_#000]">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
              </div>
              <h3 className="text-lg md:text-xl font-comic text-black mb-1.5">2. Yape o Plin</h3>
              <p className="text-black font-bold text-xs md:text-sm leading-tight uppercase">Paga de forma segura. Ingresa código o envía tu captura.</p>
            </div>
            
            <div className="flex flex-col items-center text-center bg-red-100 comic-border rounded-xl p-4 comic-shadow-sm transform md:rotate-1 hover:-rotate-1 transition-all hover:bg-red-200">
              <div className="w-12 h-12 bg-red-500 border-2 border-black rounded-full flex items-center justify-center mb-3 shadow-[2px_2px_0px_0px_#000]">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg md:text-xl font-comic text-black mb-1.5">3. ¡A GANAR!</h3>
              <p className="text-black font-bold text-xs md:text-sm leading-tight uppercase">Obtén tu ticket y descubre si eres el ganador.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-4 bg-cyan-400 border-y-8 border-black">
        <div className="max-w-4xl mx-auto px-4 sm:px-4 lg:px-4">
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-4 text-center">
                <div className="flex items-center space-x-3 bg-white border-2 border-black px-4 py-3 rounded-xl shadow-[2px_2px_0px_0px_#000] transform rotate-1">
                    <ShieldCheck className="w-8 h-8 text-red-500" />
                    <div className="text-left">
                        <p className="font-comic text-lg text-black">100% SEGURO</p>
                        <p className="font-bold text-gray-700 text-xs">Sorteos validados</p>
                    </div>
                </div>
                <div className="flex items-center space-x-3 bg-white border-2 border-black px-4 py-3 rounded-xl shadow-[2px_2px_0px_0px_#000] transform -rotate-1">
                    <Trophy className="w-8 h-8 text-yellow-500" />
                    <div className="text-left">
                        <p className="font-comic text-lg text-black">+50 GANADORES</p>
                        <p className="font-bold text-gray-700 text-xs">En todo el Perú</p>
                    </div>
                </div>
            </div>
        </div>
      </section>
    </div>
  );
}
