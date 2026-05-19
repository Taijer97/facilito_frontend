import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { doc, onSnapshot, getDoc, collection, addDoc, serverTimestamp, updateDoc, increment, query, where, getDocs } from 'firebase/firestore';
import { db, signInWithGoogle } from '../lib/firebase';
import { useAuth } from '../components/AuthProvider';
import { handleFirestoreError, OperationType } from '../lib/errorHandling';
import { Trophy, Clock, Image as ImageIcon, QrCode, Ticket as TicketIcon, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function RaffleDetail() {
  const { id } = useParams<{ id: string }>();
  const [raffle, setRaffle] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, dbUser } = useAuth();
  const navigate = useNavigate();

  // Purchase state
  const [qty, setQty] = useState(1);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('yape');
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [boughtTickets, setBoughtTickets] = useState<string[]>([]);
  const [useReferralBalance, setUseReferralBalance] = useState(false);
  const [copied, setCopied] = useState(false);

  // Automatic Payment state
  const [isAutoActive, setIsAutoActive] = useState(false);
  const [securityCode, setSecurityCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutes
  const [verifying, setVerifying] = useState(false);
  const [autoApproved, setAutoApproved] = useState(false);
  const [wasAutoPaid, setWasAutoPaid] = useState(false);
  const [autoStatus, setAutoStatus] = useState<{ type: 'idle' | 'verifying' | 'success' | 'error', message: string }>({ type: 'idle', message: '' });

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error(error);
      alert("Error al iniciar sesión");
    }
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'config'), (snap) => {
      if (snap.exists()) {
        setSettings(snap.data());
      }
    }, (error) => {
      console.error("Error fetching settings:", error);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!id) return;
    
    const unsubscribe = onSnapshot(doc(db, 'raffles', id), (snap) => {
      if (snap.exists()) {
        setRaffle({ id: snap.id, ...snap.data() });
      } else {
        setRaffle(null);
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `raffles/${id}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
      if (dbUser) {
          if (dbUser.name) setName(dbUser.name);
          if (dbUser.lastName) setLastName(dbUser.lastName);
          if (dbUser.whatsapp) setPhone(dbUser.whatsapp);
      } else if (user) {
          const parts = (user.displayName || '').split(' ');
          setName(parts[0] || '');
          setLastName(parts.slice(1).join(' ') || '');
      }
  }, [user, dbUser]);

  useEffect(() => {
    if (isAutoActive && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0) {
      setIsAutoActive(false);
      alert("El tiempo para el pago automático ha expirado. Por favor, intenta de nuevo o usa el método manual.");
    }
  }, [isAutoActive, timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAutoVerify = async () => {
    if (securityCode.length !== 3) {
      alert("⚠️ El código de seguridad debe tener 3 dígitos");
      return;
    }

    setVerifying(true);
    setAutoStatus({ type: 'verifying', message: 'Verificando tu pago en la red de Yape...' });
    try {
        const rawTotal = qty * raffle.ticketPrice;
        const availableBalance = dbUser?.referralBalance || 0;
        const discountApplied = useReferralBalance ? Math.min(rawTotal, availableBalance) : 0;
        const finalTotal = (rawTotal - discountApplied).toFixed(2);

        const response = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre: name,
                apellido: lastName,
                monto: finalTotal,
                codigoSeguridad: securityCode,
                fecha: new Date().toISOString()
            })
        });

        const data = await response.json();

        if (data.matched) {
            setAutoStatus({ type: 'success', message: '✅ ¡PAGO VERIFICADO! Procesando tus tickets...' });
            setWasAutoPaid(true);
            setTimeout(() => {
                setAutoApproved(true);
                setIsAutoActive(false);
                // Now proceed to buy with automatic approval status
                handleBuy(true);
            }, 1500);
        } else {
            const reasonMap: Record<string, string> = {
                'Monto incorrecto': '❌ El monto pagado no coincide con el total de los tickets.',
                'Codigo incorrecto': '❌ El código de seguridad de Yape es incorrecto.',
                'Transaction not found': '❌ No encontramos tu pago. Asegúrate de haber yapeado antes de verificar.'
            };
            const msg = reasonMap[data.reason] || `⚠️ ${data.reason || 'No se pudo verificar el pago. Intenta de nuevo.'}`;
            setAutoStatus({ type: 'error', message: msg });
        }
    } catch (error) {
        console.error("Error verifying payment:", error);
        setAutoStatus({ type: 'error', message: '🔌 Error de conexión con el servidor de validación.' });
    } finally {
        setVerifying(false);
    }
  };

  const handleBuy = async (isAlreadyPaid: boolean = false) => {
      if (!user) {
          alert("Debes iniciar sesión para comprar tickets");
          return;
      }
      
      if (!name || !lastName || phone.length < 9) {
          alert("Por favor completa tu nombre, apellidos y celular");
          return;
      }

      setSubmitting(true);
      try {
          const ticketsRef = collection(db, `tickets`);
          
          const bonusThreshold = raffle.bonusThreshold || 0;
          const bonusQty = bonusThreshold > 0 ? Math.floor(qty / bonusThreshold) : 0;
          const totalQty = qty + bonusQty;
          const generatedNumbers: string[] = [];
          
          const rawTotal = qty * raffle.ticketPrice;
          const availableBalance = dbUser?.referralBalance || 0;
          const discountApplied = useReferralBalance ? Math.min(rawTotal, availableBalance) : 0;
          const finalTotal = rawTotal - discountApplied;
          // Determine if it should be immediately paid (fully covered by balance OR auto-verified)
          const immediatePaid = (finalTotal <= 0 && rawTotal > 0) || isAlreadyPaid;
          
          let amountToDeduct = discountApplied;

          for (let i = 0; i < totalQty; i++) {
              const randomNum = Math.floor(100000 + Math.random() * 900000).toString();
              const isBonus = i >= qty;
              generatedNumbers.push(randomNum);
              
              const basePrice = isBonus ? 0 : raffle.ticketPrice;
              // If auto-verified or paid by referral, status is paid.
              // Admin still needs to "confirm" it in some apps, but here we set 'paid'
              // if it was matched automatically.
              let ticketStatus = immediatePaid ? 'paid' : 'pending_payment';

              await addDoc(ticketsRef, {
                  userId: user.uid,
                  raffleId: id,
                  ticketNumber: randomNum,
                  status: ticketStatus,
                  price: basePrice,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                  paymentMethod: isAlreadyPaid ? 'yape_auto' : (immediatePaid ? 'referral_balance' : paymentMethod),
                  userName: `${name} ${lastName}`.trim(),
                  userPhone: phone,
                  discountApplied: isBonus ? 0 : (amountToDeduct > 0 ? Math.min(amountToDeduct, basePrice) : 0)
              });
              
              if (!isBonus && amountToDeduct > 0) {
                  amountToDeduct -= Math.min(amountToDeduct, basePrice);
              }
          }
          
          // Update user info if missing or changed
          await updateDoc(doc(db, 'users', user.uid), {
              name: name.trim(),
              lastName: lastName.trim(),
              whatsapp: phone || dbUser?.whatsapp || null,
              referralBalance: increment(-discountApplied),
              updatedAt: serverTimestamp()
          });
          
          // If auto-verified or paid by referral, increment the raffle's sold tickets count and revenue immediately
          if (immediatePaid) {
              await updateDoc(doc(db, 'raffles', id), {
                soldTickets: increment(totalQty),
                revenue: increment(finalTotal)
              });
          }
          
          setBoughtTickets(generatedNumbers);
          setStep(3); // Success
      } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, `raffles/${id}/tickets`);
          alert("Hubo un error al generar tus tickets. Intenta de nuevo.");
      } finally {
          setSubmitting(false);
      }
  };

  const sendWhatsApp = () => {
    if (!settings?.whatsappNumber) {
        alert("WhatsApp no configurado. Contacta al soporte.");
        return;
    }
    
    const bonusThreshold = raffle.bonusThreshold || 0;
    const bonusQty = bonusThreshold > 0 ? Math.floor(qty / bonusThreshold) : 0;
    
    const rawTotal = qty * raffle.ticketPrice;
    const availableBalance = dbUser?.referralBalance || 0;
    const discountApplied = useReferralBalance ? Math.min(rawTotal, availableBalance) : 0;
    const finalTotal = rawTotal - discountApplied;
    
    const message = `Hola, acabo de adquirir tickets para el sorteo: *${raffle.title}*
    
*Detalle de la compra:*
- Nombre: ${name} ${lastName}
- Tickets: ${qty} ${bonusQty > 0 ? `(+ ${bonusQty} de regalo)` : ''}
- Números: ${boughtTickets.join(', ')}
${discountApplied > 0 ? `- Descuento Referidos: S/${discountApplied.toFixed(2)}\n` : ''}- Monto a transferir: *S/${finalTotal.toFixed(2)}*

Adjunto comprobante de pago para la aprobacion de mis tickets.`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${settings.whatsappNumber}?text=${encodedMessage}`, '_blank');
  };

  const maskName = (name: string) => {
    if (!name) return '';
    const parts = name.trim().split(/\s+/);
    if (parts.length <= 1) return name;
    return parts.map((part, index) => {
      if (index === 0) return part;
      if (part.length <= 1) return part;
      return part[0] + '*'.repeat(Math.min(part.length - 1, 5));
    }).join(' ');
  };

  if (loading) return <div className="p-20 text-center font-comic text-2xl">CARGANDO SORTEO...</div>;
  if (!raffle) return <div className="p-20 text-center font-comic text-2xl text-red-500 bg-white border-4 border-black m-10 shadow-[8px_8px_0px_0px_#000]">SORTEO NO ENCONTRADO</div>;

  const total = (raffle.ticketPrice * qty).toFixed(2);
  const soldCount = raffle.soldTickets || 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white rounded-3xl shadow-[12px_12px_0px_0px_#000] border-4 border-black overflow-hidden relative">
        {/* Decorative corner */}
        <div className="absolute top-0 right-0 w-16 h-16 bg-yellow-400 border-b-4 border-l-4 border-black z-10 hidden md:block" style={{ borderBottomLeftRadius: '24px' }}></div>
        
        <div className="md:flex relative z-20">
          {/* Left: Image & Info */}
          <div className="md:w-1/2 bg-cyan-100 p-8 border-b-4 md:border-b-0 md:border-r-4 border-black">
            <div className="rounded-2xl overflow-hidden shadow-[4px_4px_0px_0px_#000] border-4 border-black mb-6 bg-white aspect-square flex items-center justify-center transform -rotate-2 hover:rotate-0 transition-transform">
                {raffle.imageUrl ? (
                    <img src={raffle.imageUrl} alt={raffle.title} className="w-full h-full object-cover" />
                ) : (
                    <ImageIcon className="w-16 h-16 text-black opacity-30" />
                )}
            </div>
            
            <div className="mb-4 inline-block bg-yellow-400 border-2 border-black px-3 py-1 font-bold text-sm shadow-[2px_2px_0px_0px_#000] transform rotate-1">
                {raffle.status === 'active' ? '¡SORTEO ACTIVO!' : 'SORTEO FINALIZADO'}
            </div>
            
            <h1 className="text-4xl font-comic text-black mb-3 leading-none drop-shadow-[2px_2px_0px_#fff]">{raffle.title}</h1>
            <p className="text-black font-semibold text-lg mb-6 bg-white p-3 border-2 border-black shadow-[4px_4px_0px_0px_#000] rounded-xl">{raffle.description || raffle.prize}</p>
            
            <div className="bg-white rounded-2xl p-5 border-4 border-black space-y-4 shadow-[4px_4px_0px_0px_#000] transform rotate-1">
                <div className="flex justify-between items-start text-lg font-bold border-b-2 border-gray-200 pb-3">
                    <div className="flex gap-3">
                        {raffle.imageUrl && <img src={raffle.imageUrl} className="w-12 h-12 rounded-lg border-2 border-black object-cover shadow-[2px_2px_0px_0px_#000]" />}
                        <span className="flex flex-col">
                            <span className="flex items-center"><Trophy className="w-4 h-4 mr-1 text-yellow-500" /> 1° Premio</span>
                            <span className="text-red-500 text-xl leading-none mt-1">{raffle.prize}</span>
                        </span>
                    </div>
                </div>
                {raffle.prize2 && (
                    <div className="flex justify-between items-start text-md font-bold border-b-2 border-gray-100 pb-2">
                        <div className="flex gap-2">
                            {raffle.imageUrl2 && <img src={raffle.imageUrl2} className="w-10 h-10 rounded-lg border-2 border-black object-cover" />}
                            <span className="flex flex-col">
                                <span className="flex items-center text-xs"><Trophy className="w-3 h-3 mr-1 text-cyan-500" /> 2° Premio</span>
                                <span className="text-black">{raffle.prize2}</span>
                            </span>
                        </div>
                    </div>
                )}
                {raffle.prize3 && (
                    <div className="flex justify-between items-start text-md font-bold border-b-2 border-gray-100 pb-2">
                        <div className="flex gap-2">
                            {raffle.imageUrl3 && <img src={raffle.imageUrl3} className="w-10 h-10 rounded-lg border-2 border-black object-cover" />}
                            <span className="flex flex-col">
                                <span className="flex items-center text-xs"><Trophy className="w-3 h-3 mr-1 text-purple-500" /> 3° Premio</span>
                                <span className="text-black">{raffle.prize3}</span>
                            </span>
                        </div>
                    </div>
                )}
                <div className="flex justify-between items-center text-lg font-bold">
                    <span className="flex items-center"><TicketIcon className="w-5 h-5 mr-2 text-blue-500" /> Adquiridos</span>
                    <span>{soldCount} tickets vendidos</span>
                </div>
            </div>
          </div>

          {/* Right: Checkout */}
          <div className="md:w-1/2 p-8 bg-white relative">
             {raffle.status !== 'active' ? (
                <div className="h-full flex flex-col justify-center items-center text-center space-y-6">
                    <div className="w-20 h-20 bg-yellow-400 border-4 border-black rounded-full flex items-center justify-center shadow-[4px_4px_0px_0px_#000] animate-bounce">
                        <Trophy className="w-10 h-10 text-black" />
                    </div>
                    <h3 className="text-4xl font-comic text-black">¡SORTEO FINALIZADO!</h3>
                    
                    {raffle.winners && raffle.winners.length > 0 && (
                        <div className="w-full space-y-4 py-4">
                            <p className="font-black text-xl uppercase bg-black text-white py-2 rounded-xl border-4 border-black shadow-[4px_4px_0px_0px_#facc15]">Cuadro de Ganadores</p>
                            <div className="space-y-4">
                                {raffle.winners.sort((a: any, b: any) => (a.position || 0) - (b.position || 0)).map((winner: any) => {
                                    const winnerImg = winner.position === 1 ? raffle.imageUrl : (winner.position === 2 ? raffle.imageUrl2 : (winner.position === 3 ? raffle.imageUrl3 : raffle.imageUrl));
                                    const isFirst = winner.position === 1;
                                    
                                    return (
                                        <div key={winner.position} className={`flex flex-col sm:flex-row border-4 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000] overflow-hidden ${isFirst ? 'bg-yellow-200 scale-[1.03] my-4 ring-4 ring-yellow-400 ring-offset-2' : winner.position === 2 ? 'bg-cyan-100' : 'bg-purple-100'}`}>
                                            {winnerImg && (
                                                <div className={`sm:w-20 flex-shrink-0 border-b-4 sm:border-b-0 sm:border-r-4 border-black ${isFirst ? 'sm:w-24' : ''}`}>
                                                    <img src={winnerImg} className="w-full h-full object-cover aspect-video sm:aspect-square" />
                                                </div>
                                            )}
                                            <div className="p-4 flex-grow flex justify-between items-center">
                                                <div className="text-left">
                                                    <p className={`font-black uppercase flex items-center gap-1 ${isFirst ? 'text-sm text-yellow-800' : 'text-[10px] text-gray-500'}`}>
                                                        <Trophy className={`w-3 h-3 ${isFirst ? 'text-yellow-600' : 'text-gray-400'}`} />
                                                        {winner.position}° PREMIO {isFirst ? '🏆' : ''}
                                                    </p>
                                                    <p className={`max-w-[200px] truncate font-bold text-red-500 ${isFirst ? 'text-sm mb-1' : 'text-xs'}`}>
                                                        {winner.prize || (winner.position === 1 ? raffle.prize : winner.position === 2 ? raffle.prize2 : winner.position === 3 ? raffle.prize3 : '')}
                                                    </p>
                                                    <p className={`font-comic text-black ${isFirst ? 'text-2xl' : 'text-xl'}`}>{maskName(winner.userName)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`font-black text-red-600 ${isFirst ? 'text-4xl' : 'text-2xl'}`}>#{winner.ticketNumber}</p>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Ticket Ganador</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                    
                    <button 
                        onClick={() => navigate('/')}
                        className="bg-cyan-400 border-4 border-black px-8 py-3 rounded-2xl font-comic text-xl shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all mt-4"
                    >
                        VER OTROS SORTEOS
                    </button>
                </div>
             ) : (
                <>
                    {/* If active but has some winners (like 2nd or 3rd) */}
                    {raffle.winners && raffle.winners.length > 0 && (
                        <div className="mb-8 p-4 border-4 border-black rounded-2xl bg-yellow-50 shadow-[4px_4px_0px_0px_#000]">
                            <p className="font-black text-center text-sm uppercase mb-3">¡Ya tenemos algunos ganadores!</p>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {[...raffle.winners].sort((a: any, b: any) => (a.position || 0) - (b.position || 0)).map((w: any) => (
                                    <div key={w.position} className="bg-white border-2 border-black px-3 py-1 rounded-xl text-xs font-bold shadow-[2px_2px_0px_0px_#000]">
                                        {w.position}°: {maskName(w.userName)} (#{w.ticketNumber})
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {step === 1 && (
                        <div className="space-y-8">
                            <h2 className="text-3xl font-comic text-black border-b-4 border-black pb-4">COMPRA TUS TICKETS</h2>
                            
                            <div>
                                <label className="block text-xl font-bold text-black mb-3">Cantidad de tickets</label>
                                <div className="flex items-center justify-center space-x-6 bg-yellow-100 p-4 border-4 border-black rounded-2xl shadow-[4px_4px_0px_0px_#000]">
                                    <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-14 h-14 rounded-xl bg-white border-4 border-black flex items-center justify-center font-comic text-3xl text-black hover:bg-cyan-200 shadow-[2px_2px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[0px_0px_0px_0px_#000] transition-all">-</button>
                                    <span className="font-comic text-5xl w-20 text-center text-red-500 drop-shadow-[2px_2px_0px_#000]">{qty}</span>
                                    <button onClick={() => setQty(qty + 1)} className="w-14 h-14 rounded-xl bg-white border-4 border-black flex items-center justify-center font-comic text-3xl text-black hover:bg-yellow-400 shadow-[2px_2px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[0px_0px_0px_0px_#000] transition-all">+</button>
                                </div>
                                {raffle.bonusThreshold > 0 && Math.floor(qty / raffle.bonusThreshold) > 0 && (
                                    <p className="mt-4 text-center font-bold text-xl text-black bg-green-400 px-4 py-2 rounded-xl transform rotate-1 border-4 border-black block shadow-[4px_4px_0px_0px_#000]">
                                        ¡Llevas {Math.floor(qty / raffle.bonusThreshold)} {Math.floor(qty / raffle.bonusThreshold) === 1 ? 'ticket' : 'tickets'} GRATIS! 🎁
                                    </p>
                                )}
                            </div>
                            
                            <div className="bg-cyan-300 border-4 border-black p-4 rounded-2xl flex justify-between items-center text-xl font-comic shadow-[4px_4px_0px_0px_#000] transform -rotate-1">
                                <span>TOTAL A PAGAR:</span>
                                <span className="text-3xl bg-white px-3 py-1 border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000]">S/{total}</span>
                            </div>
                            
                            {!user ? (
                                <div className="text-center p-6 border-4 border-black bg-yellow-300 rounded-3xl shadow-[4px_4px_0px_0px_#000]">
                                    <p className="font-bold text-xl mb-4 text-black">¡Inicia sesión para continuar!</p>
                                    <button 
                                        onClick={handleLogin}
                                        className="bg-red-500 text-white py-3 px-8 rounded-xl font-comic text-xl border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-[0px_0px_0px_0px_#000] transition-all w-full"
                                    >
                                        Ingresar con Google
                                    </button>
                                </div>
                            ) : (
                                <button onClick={() => setStep(2)} className="w-full bg-red-500 text-white font-comic text-2xl py-4 rounded-2xl border-4 border-black shadow-[6px_6px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-[0px_0px_0px_0px_#000] transition-all mt-4">
                                    ¡CONTINUAR S/{total}!
                                </button>
                            )}
                        </div>
                    )}
                    
                    {step === 2 && (
                        <div className="space-y-6">
                            <div className="flex items-center space-x-3 mb-6 border-b-4 border-black pb-4">
                                <button onClick={() => setStep(1)} className="text-black font-bold bg-yellow-400 border-2 border-black px-3 py-1 rounded-xl shadow-[2px_2px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[0px_0px_0px_0px_#000]">← Volver</button>
                                <h2 className="text-2xl font-comic text-black uppercase">Método de Pago</h2>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <button onClick={() => { setPaymentMethod('yape'); setIsAutoActive(false); }} className={`p-4 rounded-xl border-4 transition-all flex items-center justify-center font-comic text-2xl ${paymentMethod === 'yape' && !isAutoActive ? 'border-purple-600 bg-purple-200 stroke-black shadow-[4px_4px_0px_0px_#000] text-purple-700 transform -rotate-1' : 'border-black bg-white shadow-[4px_4px_0px_0px_#000] text-black hover:bg-gray-100'}`}>
                                    YAPE
                                </button>
                                <button onClick={() => { setPaymentMethod('plin'); setIsAutoActive(false); }} className={`p-4 rounded-xl border-4 transition-all flex items-center justify-center font-comic text-2xl ${paymentMethod === 'plin' && !isAutoActive ? 'border-blue-600 bg-cyan-200 shadow-[4px_4px_0px_0px_#000] text-blue-700 transform rotate-1' : 'border-black bg-white shadow-[4px_4px_0px_0px_#000] text-black hover:bg-gray-100'}`}>
                                    PLIN
                                </button>
                            </div>

                            {settings?.autoPaymentEnabled && (
                            <div className="mb-6">
                                <button 
                                    onClick={() => {
                                        if (!name || !lastName) {
                                            alert("Por favor completa tu nombre y apellidos antes de continuar");
                                            return;
                                        }
                                        setIsAutoActive(true);
                                        setTimeLeft(180);
                                        setPaymentMethod('yape');
                                    }} 
                                    className={`w-full p-4 rounded-xl border-4 transition-all flex flex-col items-center justify-center gap-1 ${isAutoActive ? 'border-green-600 bg-green-100 shadow-[4px_4px_0px_0px_#000] text-green-800' : 'border-black bg-yellow-400 shadow-[4px_4px_0px_0px_#000] text-black hover:bg-yellow-300'}`}
                                >
                                    <span className="font-comic text-2xl">⚡ PAGO AUTOMÁTICO</span>
                                    <span className="text-xs font-bold uppercase leading-none">Verificación instantánea</span>
                                </button>
                            </div>
                            )}

                            {isAutoActive ? (
                                <div className="bg-white border-4 border-black rounded-2xl p-6 shadow-[6px_6px_0px_0px_#000] space-y-6">
                                    <div className="flex justify-between items-center bg-red-100 border-2 border-black p-2 rounded-xl mb-4">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-5 h-5 text-red-600 animate-pulse" />
                                            <span className="font-bold text-red-700">TIEMPO RESTANTE:</span>
                                        </div>
                                        <span className="font-comic text-2xl text-red-600">{formatTime(timeLeft)}</span>
                                    </div>

                                    <AnimatePresence>
                                        {autoStatus.type !== 'idle' && (
                                            <motion.div 
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.95 }}
                                                className={`p-6 border-4 border-black rounded-2xl font-black text-lg text-center mb-6 shadow-[6px_6px_0px_0px_#000] ${
                                                    autoStatus.type === 'verifying' ? 'bg-cyan-200 animate-pulse' : 
                                                    autoStatus.type === 'success' ? 'bg-green-400 text-black' : 'bg-red-500 text-white shadow-[6px_6px_0px_0px_#000]'
                                                }`}
                                            >
                                                {autoStatus.message}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    <div className="space-y-4 text-left">
                                        <p className="font-bold text-lg border-b-2 border-black pb-1">INSTRUCCIONES:</p>
                                        <ol className="list-decimal list-inside space-y-2 font-bold text-sm">
                                            <li>Escanea el código QR de Yape (abajo).</li>
                                            <li>Realiza el pago verificando el nombre <span className="text-blue-600 uppercase">({settings?.yapeName || 'Titular'})</span> y el monto <span className="text-red-500">S/{total}</span>.</li>
                                            <li>Digita el <span className="text-purple-600 uppercase">código de seguridad</span> de tu Yape (3 dígitos).</li>
                                        </ol>
                                    </div>

                                    {settings?.yapeQrUrl && (
                                        <img src={settings.yapeQrUrl} alt="QR Pago" className="w-40 h-40 mx-auto border-4 border-black shadow-[4px_4px_0px_0px_#000]" />
                                    )}

                                    <div className="space-y-2">
                                        <label className="block text-center font-black uppercase text-sm">Código de Seguridad (3 dígitos):</label>
                                        <input 
                                            type="text" 
                                            maxLength={3}
                                            value={securityCode}
                                            onChange={(e) => setSecurityCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                                            placeholder="000"
                                            className="w-32 mx-auto block text-center text-3xl font-comic border-4 border-black rounded-xl py-2 shadow-[2px_2px_0px_0px_#000] focus:bg-yellow-100 outline-none"
                                        />
                                    </div>

                                    <button 
                                        onClick={handleAutoVerify}
                                        disabled={verifying || securityCode.length !== 3}
                                        className="w-full bg-green-500 disabled:bg-gray-300 text-white font-comic text-2xl py-4 rounded-xl border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
                                    >
                                        {verifying ? 'VERIFICANDO...' : 'VERIFICAR PAGO'}
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="bg-yellow-50 border-4 border-black rounded-2xl p-6 text-center shadow-[4px_4px_0px_0px_#000] mb-6">
                                        {settings?.yapeQrUrl ? (
                                            <img src={settings.yapeQrUrl} alt="QR Pago" className="w-48 h-48 mx-auto border-4 border-black mb-3 shadow-[4px_4px_0px_0px_#000]" />
                                        ) : (
                                            <QrCode className="w-24 h-24 mx-auto text-black mb-3" />
                                        )}
                                        <p className="font-bold text-lg mb-1 uppercase">Paga por {paymentMethod}:</p>
                                        {settings?.yapeName && (
                                            <p className="font-bold text-md text-gray-700 bg-white border-2 border-dashed border-gray-400 rounded-lg py-1 px-4 mb-2 inline-block">
                                                Titular: {settings.yapeName}
                                            </p>
                                        )}
                                        <div className="relative group">
                                            <p className="font-comic text-3xl sm:text-4xl text-black tracking-widest drop-shadow-[2px_2px_0px_#fff] bg-white border-2 border-black rounded-xl py-2 my-2 break-words px-2">
                                                {settings?.yapeNumber || 'REVISAR PANEL'}
                                            </p>
                                            {settings?.yapeNumber && (
                                                <motion.button 
                                                    whileHover={{ scale: 1.02 }}
                                                    whileTap={{ scale: 0.98 }}
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(settings.yapeNumber);
                                                        setCopied(true);
                                                        setTimeout(() => setCopied(false), 2000);
                                                    }}
                                                    className={`mt-2 w-full text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-2 transition-colors border-2 border-black shadow-[2px_2px_0px_0px_#000] ${
                                                        copied ? 'bg-green-400 text-black shadow-none translate-x-[2px] translate-y-[2px]' : 'bg-black text-white hover:bg-gray-800'
                                                    }`}
                                                >
                                                    <AnimatePresence mode="wait">
                                                        {copied ? (
                                                            <motion.div 
                                                                key="copied"
                                                                initial={{ opacity: 0, y: 5 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                exit={{ opacity: 0, y: -5 }}
                                                                className="flex items-center gap-2"
                                                            >
                                                                <Check className="w-4 h-4" />
                                                                ¡NÚMERO COPIADO!
                                                            </motion.div>
                                                        ) : (
                                                            <motion.div 
                                                                key="copy"
                                                                initial={{ opacity: 0, y: 5 }}
                                                                animate={{ opacity: 1, y: 0 }}
                                                                exit={{ opacity: 0, y: -5 }}
                                                                className="flex items-center gap-2"
                                                            >
                                                                <TicketIcon className="w-4 h-4" />
                                                                COPIAR NÚMERO
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </motion.button>
                                            )}
                                        </div>
                                        <p className="font-bold bg-cyan-200 inline-block px-3 py-1 border-2 border-black rounded-lg mt-2 uppercase">Verificar titular al pagar</p>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        {(dbUser?.referralBalance || 0) > 0 && (
                                            <div className="bg-purple-100 border-4 border-black p-4 rounded-xl shadow-[4px_4px_0px_0px_#000] flex items-center justify-between cursor-pointer" onClick={() => setUseReferralBalance(!useReferralBalance)}>
                                                <div>
                                                    <p className="font-black text-purple-800 uppercase">Saldo de Referidos</p>
                                                    <p className="text-sm font-bold text-purple-600">Tienes <span className="bg-white border text-black border-black px-1 rounded">S/ {(dbUser?.referralBalance || 0).toFixed(2)}</span> disponible</p>
                                                </div>
                                                <div className={`w-8 h-8 rounded border-4 border-black flex items-center justify-center transition-colors ${useReferralBalance ? 'bg-green-400' : 'bg-white'}`}>
                                                    {useReferralBalance && <span className="text-black font-black text-xl leading-none block transform translate-x-[1px] -translate-y-[2px]">✓</span>}
                                                </div>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block font-bold text-black mb-2">Nombres:</label>
                                                <input 
                                                    type="text" 
                                                    value={name} 
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        const capitalized = val.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
                                                        setName(capitalized);
                                                    }} 
                                                    readOnly={!!(dbUser?.name)}
                                                    className={`w-full text-lg font-bold border-4 border-black rounded-xl px-4 py-3 outline-none transition-all shadow-[4px_4px_0px_0px_#000] capitalize ${!!(dbUser?.name) ? 'bg-gray-100 cursor-not-allowed' : 'focus:bg-yellow-100 focus:shadow-[2px_2px_0px_0px_#000] focus:translate-x-0.5 focus:translate-y-0.5'}`}
                                                    placeholder="Ej. Juan" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block font-bold text-black mb-2">Apellidos:</label>
                                                <input 
                                                    type="text" 
                                                    value={lastName} 
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        const capitalized = val.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
                                                        setLastName(capitalized);
                                                    }} 
                                                    readOnly={!!(dbUser?.lastName)}
                                                    className={`w-full text-lg font-bold border-4 border-black rounded-xl px-4 py-3 outline-none transition-all shadow-[4px_4px_0px_0px_#000] capitalize ${!!(dbUser?.lastName) ? 'bg-gray-100 cursor-not-allowed' : 'focus:bg-yellow-100 focus:shadow-[2px_2px_0px_0px_#000] focus:translate-x-0.5 focus:translate-y-0.5'}`}
                                                    placeholder="Ej. Pérez García" 
                                                />
                                            </div>
                                        </div>
                                        {!dbUser?.whatsapp && (
                                            <div>
                                                <label className="block font-bold text-black mb-2">Ingrese su N° de WhatsApp:<span className="font-normal text-gray-500">(9 dígitos)</span></label>
                                                <input 
                                                    type="tel" 
                                                    value={phone} 
                                                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 9))} 
                                                    className="w-full text-lg font-bold border-4 border-black rounded-xl px-4 py-3 focus:bg-cyan-100 outline-none transition-all shadow-[4px_4px_0px_0px_#000] focus:shadow-[2px_2px_0px_0px_#000] focus:translate-x-0.5 focus:translate-y-0.5" 
                                                    placeholder="Ej. 9XXXXXXXX" 
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {(() => {
                                        const rawTotalCalc = qty * raffle.ticketPrice;
                                        const discountCalc = useReferralBalance ? Math.min(rawTotalCalc, dbUser?.referralBalance || 0) : 0;
                                        const finalTotalCalc = rawTotalCalc - discountCalc;
                                        const immediatePaidUI = finalTotalCalc <= 0 && rawTotalCalc > 0;
                                        
                                        return (
                                            <button 
                                                onClick={() => handleBuy(false)} 
                                                disabled={submitting || !name || !lastName || phone.length < 9}
                                                className="w-full bg-red-500 disabled:bg-gray-400 disabled:shadow-none text-white font-comic text-2xl py-4 rounded-2xl border-4 border-black shadow-[6px_6px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-[0px_0px_0px_0px_#000] transition-all mt-8"
                                            >
                                                {submitting ? 'CONFIRMANDO...' : immediatePaidUI ? `¡OBTENER TICKETS Y PAGAR S/ 0!` : `¡PAGO POR S/ ${finalTotalCalc.toFixed(2)}!`}
                                            </button>
                                        );
                                    })()}
                                </>
                            )}
                        </div>
                    )}

                    {step === 3 && (() => {
                        const rawTotalCalc = qty * raffle.ticketPrice;
                        const discountCalc = useReferralBalance ? Math.min(rawTotalCalc, dbUser?.referralBalance || 0) : 0;
                        const finalTotalCalc = rawTotalCalc - discountCalc;
                        const immediatePaidUI = finalTotalCalc <= 0 && rawTotalCalc > 0;
                        
                        return (
                            <div className="text-center space-y-8 py-10">
                                <div className="inline-block relative">
                                    <div className="absolute inset-0 bg-yellow-400 border-4 border-black rounded-3xl transform rotate-3"></div>
                                    <div className="relative bg-white border-4 border-black rounded-3xl p-6 shadow-[8px_8px_0px_0px_#000]">
                                        <div className="w-24 h-24 bg-green-400 border-4 border-black rounded-full flex items-center justify-center mx-auto mb-6 shadow-[4px_4px_0px_0px_#000]">
                                            <svg className="w-12 h-12 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg>
                                        </div>
                                        <h2 className="text-4xl font-comic text-black mb-4">{wasAutoPaid ? '¡PAGO CONFIRMADO!' : '¡TICKETS RESERVADOS!'}</h2>
                                        
                                        {wasAutoPaid ? (
                                            <p className="text-xl font-bold bg-green-100 p-4 border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_#000] text-left">
                                                ✅ Tu pago ha sido verificado automáticamente. Tus tickets ya están <span className="inline-block bg-green-200 px-2 py-1 rounded border-2 border-black">confirmados</span> y estás participando oficialmente en el sorteo.
                                            </p>
                                        ) : immediatePaidUI ? (
                                            <p className="text-xl font-bold bg-green-100 p-4 border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_#000] text-left">
                                                ¡Tus tickets han sido reservados usando tu saldo de referidos! Aparecerán como confirmados en tu panel una vez validados por el administrador.
                                            </p>
                                        ) : (
                                            <>
                                                <p className="text-xl font-bold bg-yellow-100 p-4 border-4 border-black rounded-xl shadow-[4px_4px_0px_0px_#000] text-left">
                                                    Validaremos tu pago en los próximos minutos y tus tickets aparecerán como <span className="inline-block bg-cyan-200 px-2 py-1 rounded border-2 border-black">pagados</span> en tu panel.
                                                </p>
                                                
                                                <div className="mt-8 pt-6 border-t-2 border-dashed border-gray-300">
                                                    <p className="font-bold text-lg mb-4 text-gray-700">Para agilizar la validación, envía tu comprobante:</p>
                                                    <button 
                                                        onClick={sendWhatsApp}
                                                        className="w-full bg-green-500 text-white font-comic text-xl py-4 rounded-xl border-4 border-black shadow-[4px_4px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 2.462 1.791 4.845 2.037 5.174.247.33 3.522 5.378 8.534 7.532 1.192.512 2.122.817 2.842 1.048 1.198.381 2.292.327 3.151.198.959-.142 2.943-1.202 3.357-2.361.414-1.159.414-2.152.291-2.361-.124-.208-.456-.334-.753-.484zM12.146 22.109c-2.107 0-4.167-.568-5.968-1.644l-.428-.255-4.437 1.163 1.183-4.324-.28-.445C1.042 14.773.456 12.511.456 10.16c0-6.444 5.242-11.685 11.69-11.685 3.123 0 6.06 1.216 8.267 3.425 2.207 2.209 3.42 5.148 3.42 8.269 0 6.446-5.242 11.685-11.687 11.685zM20.52 4.092C18.283 1.853 15.304.62 12.146.62 5.584.62.24 5.965.24 12.527c0 2.097.549 4.144 1.59 5.937L.24 23.38l5.068-1.328c1.724.94 3.666 1.437 5.638 1.438h.005c6.561 0 11.906-5.344 11.906-12.515 0-3.179-1.238-6.166-3.477-8.406z"/></svg>
                                                        ENVIAR COMPROBANTE
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="pt-6">
                                    <button onClick={() => navigate('/panel')} className="bg-cyan-400 text-black font-comic text-2xl py-4 px-10 rounded-2xl border-4 border-black shadow-[6px_6px_0px_0px_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-[0px_0px_0px_0px_#000] transition-all inline-block">
                                        IR A MI PANEL
                                    </button>
                                </div>
                            </div>
                        );
                    })()}
                </>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}
