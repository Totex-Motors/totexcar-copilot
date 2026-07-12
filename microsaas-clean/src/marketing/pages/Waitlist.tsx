import React, { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { GradientBorder } from "../components/ui/GradientBorder";
import { RollingText } from "../components/ui/RollingText";

// Mock avatars for social proof
const avatars = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100&auto=compress&fit=crop",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=100&auto=compress&fit=crop",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=100&auto=compress&fit=crop",
];

export const Waitlist = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setStatus("error");
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setStatus("loading");

    // Simulate API call
    setTimeout(() => {
      setStatus("success");
      setEmail("");
    }, 2000);
  };

  return (
    <div className="relative w-full min-h-[90vh] pt-32 pb-20 bg-[#050505] overflow-hidden flex flex-col items-center justify-center">
      {/* --- BACKGROUND GRADIENTS --- */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Left Orange Glow - Stronger & Larger as per design */}
        <div className="absolute top-0 left-0 w-[60vw] h-full bg-gradient-to-r from-teal-600/30 via-teal-900/10 to-transparent blur-[120px] opacity-80" />

        {/* Right Blue Glow - Stronger & Larger as per design */}
        <div className="absolute top-0 right-0 w-[60vw] h-full bg-gradient-to-l from-cyan-600/30 via-blue-900/10 to-transparent blur-[120px] opacity-80" />
      </div>

      <div className="relative z-10 w-full max-w-4xl mx-auto px-6 text-center">
        {/* --- HEADLINES --- */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-5xl md:text-7xl lg:text-8xl font-semibold text-white tracking-tight leading-[1.1] mb-8"
        >
          Join the Waitlist
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed mb-12"
        >
          Be first to try the AI-agent template, get launch updates, private
          previews, and early-bird pricing.
        </motion.p>

        {/* --- TIMER STATUS --- */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-12"
        >
          <span className="text-2xl md:text-3xl font-semibold text-white">
            Timer Has Ended
          </span>
        </motion.div>

        {/* --- FORM SECTION --- */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="w-full max-w-lg mx-auto"
        >
          {status === "success" ? (
            <div className="bg-[#0A0A0A] border border-green-500/30 rounded-2xl p-8 flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="text-green-500" size={24} />
              </div>
              <h3 className="text-xl font-bold text-white">
                You're on the list!
              </h3>
              <p className="text-gray-400">
                We'll notify you as soon as spots open up.
              </p>
              <button
                onClick={() => setStatus("idle")}
                className="text-sm text-gray-500 hover:text-white underline mt-2"
              >
                Join with another email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="relative">
              <div className="relative flex items-center bg-[#0A0A0A] border border-white/10 rounded-2xl p-2 shadow-2xl focus-within:border-white/20 transition-colors">
                <input
                  type="email"
                  placeholder="Your email address"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (status === "error") setStatus("idle");
                  }}
                  disabled={status === "loading"}
                  className="flex-1 bg-transparent border-none text-white placeholder:text-gray-500 px-4 py-3 outline-none min-w-0"
                />

                <GradientBorder
                  gradient="from-teal-500 via-cyan-500 to-teal-600"
                  containerClassName="rounded-xl flex-shrink-0"
                  className="rounded-xl"
                >
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="px-6 py-3 bg-[#0F0F0F] text-white font-medium rounded-xl hover:bg-black transition-colors relative overflow-hidden group min-w-[120px] flex items-center justify-center"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-teal-500/20 to-cyan-500/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="relative z-10">
                      {status === "loading" ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : (
                        <RollingText text="Join Waitlist" />
                      )}
                    </span>
                  </button>
                </GradientBorder>
              </div>

              {/* Error Message */}
              {status === "error" && (
                <div className="absolute -bottom-8 left-0 flex items-center gap-2 text-cyan-500 text-sm">
                  <AlertCircle size={14} />
                  {errorMessage}
                </div>
              )}
            </form>
          )}

          {/* --- SOCIAL PROOF --- */}
          <div className="mt-8 flex items-center justify-center gap-4">
            <div className="flex -space-x-3">
              {avatars.map((src, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full border-2 border-[#050505] overflow-hidden"
                >
                  <img
                    src={src}
                    alt="Member"
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-300 font-medium">
              <span className="text-white font-bold">2,300+</span> Peoples
              already joined
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
