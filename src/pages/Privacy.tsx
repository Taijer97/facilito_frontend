import React from 'react';
import { Lock, Eye, FileText } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-comic text-black mb-6 inline-block bg-cyan-400 border-4 border-black px-6 py-2 shadow-[8px_8px_0px_0px_#000] rotate-1 uppercase">
          Política de Privacidad
        </h1>
      </div>

      <div className="bg-white border-4 border-black rounded-[2rem] p-8 comic-shadow space-y-8 font-bold text-gray-800">
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-purple-500">
            <Lock className="w-8 h-8" />
            <h2 className="text-2xl font-comic text-black uppercase">1. Compromiso de Seguridad</h2>
          </div>
          <p>
            En cumplimiento con la <strong>Ley N° 29733 - Ley de Protección de Datos Personales</strong>, garantizamos que sus datos serán tratados con la máxima confidencialidad y solo para fines relacionados con la administración de los sorteos.
          </p>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3 text-red-500">
            <Eye className="w-8 h-8" />
            <h2 className="text-2xl font-comic text-black uppercase">2. Información Recopilada</h2>
          </div>
          <p>Para participar, solicitamos datos esenciales:</p>
          <ul className="list-disc ml-6 space-y-2">
            <li>Identidad: Nombre, apellidos y número de DNI.</li>
            <li>Contacto: Correo electrónico y número de celular (WhatsApp).</li>
            <li>Transacción: Capturas de comprobantes de pago.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3 text-cyan-500">
            <FileText className="w-8 h-8" />
            <h2 className="text-2xl font-comic text-black uppercase">3. Derechos ARCO</h2>
          </div>
          <p>
            Usted tiene derecho a ejercer sus derechos de <strong>Acceso, Rectificación, Cancelación y Oposición (ARCO)</strong>. Puede solicitar la actualización o eliminación de sus datos enviando un correo a soporte@sorteosfacilito.com.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-comic text-black uppercase">4. Uso de Cookies</h2>
          <p>
            Utilizamos cookies técnicas para mantener su sesión activa y recordar sus preferencias de navegación. No compartimos información de comportamiento con terceros para fines publicitarios.
          </p>
        </section>

        <div className="bg-cyan-50 border-4 border-black p-6 rounded-2xl">
          <p className="text-sm">
            Los datos personales serán almacenados en nuestro banco de datos de "Usuarios de Plataforma", debidamente protegido con medidas de seguridad técnicas y organizativas para evitar el mal uso o robo.
          </p>
        </div>

        <div className="pt-8 border-t-4 border-black text-center text-sm text-gray-500">
          Esta política se rige bajo la Autoridad Nacional de Protección de Datos Personales del Perú.
        </div>
      </div>
    </div>
  );
}
