import React from 'react';
import { ScrollText, ShieldCheck, Scale } from 'lucide-react';

export default function Terms() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-5xl font-comic text-black mb-6 inline-block bg-yellow-400 border-4 border-black px-6 py-2 shadow-[8px_8px_0px_0px_#000] -rotate-1 uppercase">
          Términos y Condiciones
        </h1>
      </div>

      <div className="bg-white border-4 border-black rounded-[2rem] p-8 comic-shadow space-y-8 font-bold text-gray-800">
        <section className="space-y-4">
          <div className="flex items-center gap-3 text-red-500">
            <Scale className="w-8 h-8" />
            <h2 className="text-2xl font-comic text-black uppercase">1. Ámbito de Aplicación</h2>
          </div>
          <p>
            Los presentes Términos y Condiciones regulan el acceso y uso de la plataforma de sorteos. Al utilizar nuestros servicios, usted acepta cumplir con estas normas de acuerdo con la legislación vigente en la República del Perú.
          </p>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3 text-cyan-500">
            <ScrollText className="w-8 h-8" />
            <h2 className="text-2xl font-comic text-black uppercase">2. Participación y Registro</h2>
          </div>
          <ul className="list-disc ml-6 space-y-2">
            <li>Solo podrán participar personas mayores de 18 años residentes en Perú.</li>
            <li>Es obligatorio el registro con datos reales (Nombre, DNI, Teléfono) conforme a la Ley de Protección de Datos Personales.</li>
            <li>El usuario es responsable de la veracidad de la información proporcionada.</li>
          </ul>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3 text-yellow-500">
            <ShieldCheck className="w-8 h-8" />
            <h2 className="text-2xl font-comic text-black uppercase">3. Mecánica de Sorteos</h2>
          </div>
          <p>
            Los sorteos se realizan bajo una modalidad de transparencia. Los números son asignados tras la validación del pago (Yape/Plin). El ganador será determinado en transmisiones en vivo a través de nuestras redes oficiales.
          </p>
          <div className="bg-yellow-50 border-2 border-dashed border-black p-4 rounded-xl italic">
            "De acuerdo con las normas de la ONAGI (cuando aplique), los ganadores tienen un plazo de 15 días calendario para reclamar su premio presentando su DNI original."
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-comic text-black uppercase">4. Pagos y Reembolsos</h2>
          <p>
            Toda compra de ticket es final. No se aceptan devoluciones una vez que el ticket ha sido emitido y validado, salvo cancelación total del evento por parte de los organizadores.
          </p>
        </section>

        <div className="pt-8 border-t-4 border-black text-center text-sm text-gray-500">
          Última actualización: Abril 2026 - Lima, Perú.
        </div>
      </div>
    </div>
  );
}
