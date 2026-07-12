import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { GradientBorder } from '../components/ui/GradientBorder';
import { TrustLogos } from '../components/TrustLogos';
import { FAQ } from '../components/FAQ';
import { CTA } from '../components/CTA';
import { RollingText } from '../components/ui/RollingText';

export const Contact = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    message: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      alert("Mensagem enviada!");
      setFormData({ firstName: '', lastName: '', email: '', phone: '', message: '' });
    }, 1500);
  };

  return (
    <div className="relative w-full min-h-screen pt-32 bg-[#050505] overflow-x-hidden">
      
      {/* Background Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-[60vw] h-[60vw] bg-teal-600/10 blur-[120px] rounded-full opacity-50" />
        <div className="absolute top-0 right-0 w-[60vw] h-[60vw] bg-cyan-600/10 blur-[120px] rounded-full opacity-50" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 mb-24">
        
        {/* --- HERO SECTION --- */}
        <div className="flex flex-col items-center text-center mb-16">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-6xl lg:text-7xl font-semibold text-white tracking-tight mb-6"
          >
            Fale com a gente
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed"
          >
            Dúvidas, sugestões ou precisa de ajuda com a TotexCar Co-pilot? Preencha o formulário ou escreva para contato@totexmotors.com que a gente responde.
          </motion.p>
        </div>

        {/* --- CONTACT FORM --- */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="max-w-3xl mx-auto bg-[#0A0A0A] border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden"
        >
          {/* Subtle inner glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* First Name */}
              <div className="space-y-2">
                <label htmlFor="firstName" className="text-sm font-medium text-white">Nome</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="Seu nome"
                  required
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:bg-black/60 outline-none transition-all"
                />
              </div>

              {/* Last Name */}
              <div className="space-y-2">
                <label htmlFor="lastName" className="text-sm font-medium text-white">Sobrenome</label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Seu sobrenome"
                  required
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:bg-black/60 outline-none transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Email */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-white">E-mail</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Seu e-mail"
                  required
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:bg-black/60 outline-none transition-all"
                />
              </div>

              {/* Phone Number */}
              <div className="space-y-2">
                <label htmlFor="phone" className="text-sm font-medium text-white">Telefone</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Seu telefone (WhatsApp)"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:bg-black/60 outline-none transition-all"
                />
              </div>
            </div>

            {/* Message */}
            <div className="space-y-2">
              <label htmlFor="message" className="text-sm font-medium text-white">Mensagem</label>
              <textarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                placeholder="Escreva sua mensagem"
                rows={4}
                required
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:border-cyan-500/50 focus:bg-black/60 outline-none transition-all resize-none"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <GradientBorder 
                gradient="from-teal-500 via-cyan-500 to-teal-600"
                containerClassName="w-full rounded-xl p-[1px]"
                className="rounded-xl"
              >
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-[#0F0F0F] text-white font-medium rounded-xl hover:bg-black transition-colors relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="relative z-10 block">
                    <RollingText text={isSubmitting ? 'Enviando...' : 'Enviar mensagem'} className="justify-center" />
                  </span>
                </button>
              </GradientBorder>
            </div>

            <p className="text-center text-xs text-gray-500 mt-4">
              Ao enviar este formulário você concorda com a nossa <a href="#" className="text-teal-500 hover:underline">Política de Privacidade</a>
            </p>

          </form>
        </motion.div>
      </div>

      {/* --- TRUST SECTION --- */}
      <div className="relative z-10 mb-24">
        <div className="text-center mb-8">
          <p className="text-sm font-medium text-white">Donos de carro de todo o Brasil já usam a TotexCar Co-pilot</p>
        </div>
        <TrustLogos />
      </div>

      {/* --- FAQ SECTION --- */}
      <FAQ />

      {/* --- CTA SECTION --- */}
      <CTA />

    </div>
  );
};
