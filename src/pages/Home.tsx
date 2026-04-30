import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { ArrowRight, Trophy, ShieldCheck, Ticket, Star, Zap, Clock } from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Home() {
  const [featuredRaffle, setFeaturedRaffle] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<{days: number, hours: number, min: number, seg: number}>({days: 0, hours: 0, min: 0, seg: 0});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFeatured() {
      try {
        const q = query(
          collection(db, 'raffles'), 
          where('status', '==', 'active'), 
          orderBy('endDate', 'asc'),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          setFeaturedRaffle({ id: snap.docs[0].id, ...snap.docs[0].data() });
        }
      } catch (error) {
        console.error("Error fetching featured raffle:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchFeatured();
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
      <section className="relative comic-sunburst py-20 lg:py-28 overflow-hidden border-b-8 border-black">
        {/* Comic background elements decoration */}
        <div className="absolute top-10 left-10 text-black opacity-10 transform -rotate-12 animate-pulse hidden md:block">
            <Star className="w-24 h-24" fill="currentColor" />
            <span className="font-comic text-4xl block mt-2">¡BOOM!</span>
        </div>
        <div className="absolute bottom-10 right-10 text-black opacity-10 transform rotate-12 animate-bounce hidden md:block">
            <Zap className="w-32 h-32" fill="currentColor" />
            <span className="font-comic text-4xl block mt-2 text-right">¡POW!</span>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="md:w-1/2 space-y-6 text-center md:text-left mb-12 md:mb-0">
            <div className="inline-block bg-white text-black font-bold px-4 py-2 border-4 border-black rounded-full shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transform -rotate-2 mb-2">
              {featuredRaffle ? '🌟 SORTEO ACTIVO 🌟' : '¡MUY PRONTO!'}
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-8xl font-comic text-black leading-none drop-shadow-[5px_5px_0px_#fff]">
              {featuredRaffle ? (
                <>GANA UN <br/> <span className="text-red-500 drop-shadow-[4px_4px_0px_#000]">{featuredRaffle.prize.length > 20 ? featuredRaffle.prize.substring(0, 20) + '...' : featuredRaffle.prize}</span></>
              ) : (
                <>NUEVOS <br/> <span className="text-red-500 drop-shadow-[4px_4px_0px_#000]">PREMIOS</span></>
              )}
            </h1>
            <p className="text-xl md:text-2xl text-black font-bold max-w-xl mx-auto md:mx-0 bg-white inline-block px-4 py-3 border-4 border-black shadow-[8px_8px_0px_0px_#000] rotate-1">
              {featuredRaffle ? `¡Participa hoy desde S/${featuredRaffle.ticketPrice}!` : 'Regístrate para recibir notificaciones.'}
            </p>
            <div className="flex justify-center md:justify-start pt-6">
              <Link to="/sorteos" className="bg-red-500 text-white font-comic text-2xl md:text-4xl px-12 py-6 rounded-3xl border-8 border-black shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] hover:translate-x-2 hover:translate-y-2 hover:shadow-[0px_0px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center space-x-4 group">
                <span>{featuredRaffle ? '¡COMPRAR!' : 'VER TODO'}</span>
                <ArrowRight className="w-8 h-8 md:w-12 md:h-12 group-hover:translate-x-4 transition-transform" />
              </Link>
            </div>
          </div>

          <div className="md:w-5/12 lg:w-4/12 bg-white comic-border p-6 rounded-[3rem] comic-shadow transform rotate-2 max-w-sm">
              <div className="bg-cyan-400 border-4 border-black rounded-xl p-2 text-center mb-4 shadow-[2px_2px_0px_0px_#000] transform -rotate-2">
                  <span className="text-lg font-comic tracking-wider text-black font-bold">Próximo Sorteo en:</span>
              </div>
              
              <div className="grid grid-cols-4 gap-2 text-center mb-6">
                {[
                  { val: timeLeft.days, label: 'Días' },
                  { val: timeLeft.hours, label: 'Horas' },
                  { val: timeLeft.min, label: 'Min' },
                  { val: timeLeft.seg, label: 'Seg' }
                ].map((item) => (
                  <div key={item.label} className="bg-yellow-300 border-4 border-black rounded-xl p-2 shadow-[2px_2px_0px_0px_#000]">
                    <div className="text-2xl font-bold font-comic text-red-500 drop-shadow-[1px_1px_0px_#000]">
                      {item.val < 10 ? `0${item.val}` : item.val}
                    </div>
                    <div className="text-[10px] text-black font-bold mt-0.5 uppercase tracking-tighter">{item.label}</div>
                  </div>
                ))}
              </div>
              
              {featuredRaffle ? (
                <div className="bg-cyan-100 border-4 border-black rounded-2xl overflow-hidden shadow-[4px_4px_0px_0px_#000]">
                    {featuredRaffle.imageUrl ? (
                      <div className="h-40 w-full border-b-4 border-black overflow-hidden bg-cyan-200">
                        <img src={featuredRaffle.imageUrl} alt={featuredRaffle.title} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="h-40 w-full flex items-center justify-center bg-cyan-200 border-b-4 border-black">
                        <Ticket className="w-10 h-10 text-black opacity-30" />
                      </div>
                    )}
                    <div className="p-4 text-center bg-white">
                        <h3 className="text-black font-comic text-xl mb-1 truncate">{featuredRaffle.title}</h3>
                        <p className="text-red-500 font-bold text-base mb-3 bg-yellow-200 inline-block px-3 py-1 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_#000] transform -rotate-2">Ticket: S/{featuredRaffle.ticketPrice}</p>
                        <Link to={`/sorteo/${featuredRaffle.id}`} className="block w-full bg-cyan-400 text-black border-4 border-black font-bold text-lg py-2 rounded-xl shadow-[3px_3px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-[0px_0px_0px_0px_#000] transition-all">Participar Ahora</Link>
                    </div>
                </div>
              ) : (
                <div className="bg-gray-100 border-4 border-dashed border-gray-300 rounded-2xl p-8 text-center">
                    <Clock className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-400 font-bold text-sm">¡Pronto anunciaremos el próximo sorteo!</p>
                </div>
              )}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="py-24 relative overflow-hidden bg-white border-y-8 border-black">
        {/* Decorative dots background */}
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 2px, transparent 2px)', backgroundSize: '30px 30px' }}></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-6xl md:text-8xl font-comic text-black mb-6 drop-shadow-[4px_4px_0px_#facc15]">¿CÓMO FUNCIONA?</h2>
            <p className="text-2xl font-black text-black bg-cyan-400 inline-block px-8 py-3 border-4 border-black shadow-[6px_6px_0px_0px_#000] transform rotate-1 uppercase">¡Gana en solo 3 pasos! 🚀</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="flex flex-col items-center text-center bg-yellow-100 comic-border rounded-[3rem] p-10 comic-shadow transform md:-rotate-2 hover:rotate-2 transition-all hover:bg-yellow-200">
              <div className="w-24 h-24 comic-gradient-yellow comic-border rounded-full flex items-center justify-center mb-6 shadow-[6px_6px_0px_0px_#000]">
                <Ticket className="w-12 h-12 text-black" />
              </div>
              <h3 className="text-3xl font-comic text-black mb-4">1. Elige tickets</h3>
              <p className="text-black font-bold text-lg leading-tight uppercase">Entra al sorteo, elige tus números favoritos y ¡listo! Tienes muchas opciones.</p>
            </div>
            
            <div className="flex flex-col items-center text-center bg-cyan-100 comic-border rounded-[3rem] p-10 comic-shadow transform md:translate-y-8 hover:-translate-y-2 transition-all hover:bg-cyan-200">
              <div className="w-24 h-24 comic-gradient-cyan comic-border rounded-full flex items-center justify-center mb-6 shadow-[6px_6px_0px_0px_#000]">
                <svg className="w-12 h-12 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
              </div>
              <h3 className="text-3xl font-comic text-black mb-4">2. Yape o Plin</h3>
              <p className="text-black font-bold text-lg leading-tight uppercase">Paga de forma segura. Envía tu captura y tu ticket aparecerá en tu panel.</p>
            </div>
            
            <div className="flex flex-col items-center text-center bg-red-100 comic-border rounded-[3rem] p-10 comic-shadow transform md:rotate-2 hover:-rotate-2 transition-all hover:bg-red-200">
              <div className="w-24 h-24 bg-red-500 comic-border rounded-full flex items-center justify-center mb-6 shadow-[6px_6px_0px_0px_#000]">
                <Trophy className="w-12 h-12 text-white" />
              </div>
              <h3 className="text-3xl font-comic text-black mb-4">3. ¡A GANAR!</h3>
              <p className="text-black font-bold text-lg leading-tight uppercase">¡Cruza los dedos! Mira la transmisión en vivo y descubre si eres el REY.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-16 bg-cyan-400 border-y-8 border-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 text-center">
                <div className="flex items-center space-x-4 bg-white border-4 border-black px-6 py-4 rounded-xl shadow-[4px_4px_0px_0px_#000] transform rotate-1">
                    <ShieldCheck className="w-12 h-12 text-red-500" />
                    <div className="text-left">
                        <p className="font-comic text-2xl text-black">100% SEGURO</p>
                        <p className="font-bold text-gray-700">Sorteos validados</p>
                    </div>
                </div>
                <div className="flex items-center space-x-4 bg-white border-4 border-black px-6 py-4 rounded-xl shadow-[4px_4px_0px_0px_#000] transform -rotate-1">
                    <Trophy className="w-12 h-12 text-yellow-500" />
                    <div className="text-left">
                        <p className="font-comic text-2xl text-black">+50 GANADORES</p>
                        <p className="font-bold text-gray-700">En todo el Perú</p>
                    </div>
                </div>
            </div>
        </div>
      </section>
    </div>
  );
}
