import React, { useState } from "react";
import { Link } from "react-router-dom";
import { GradientBorder } from "./ui/GradientBorder";
import { RollingText } from "./ui/RollingText";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const NavLink = ({
  children,
  to,
  onClick,
}: {
  children: React.ReactNode;
  to: string;
  onClick?: () => void;
}) => (
  <Link
    to={to}
    onClick={onClick}
    className="text-gray-400 hover:text-white text-sm font-medium transition-colors duration-200"
  >
    {children}
  </Link>
);

export const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-4 md:px-6 py-4 w-full">
      <div className="max-w-7xl mx-auto flex items-center justify-between bg-black/40 backdrop-blur-xl rounded-full px-6 py-3 border border-white/5 shadow-2xl">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-3 group"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <img
            src="/totexmotors-logo.png"
            alt="TotexMotors"
            className="h-7 w-auto"
          />
          <span className="text-white font-bold text-lg tracking-tight hidden sm:inline">
            TotexCar Co-pilot
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center gap-8">
          <NavLink to="/about">Sobre</NavLink>
          <NavLink to="/pricing">Preços</NavLink>
          <NavLink to="/integrations">Recursos</NavLink>
          <NavLink to="/blogs">Blog</NavLink>
          <NavLink to="/entrar">Entrar</NavLink>

          <GradientBorder
            gradient="from-teal-500 via-cyan-500 to-teal-600"
            containerClassName="rounded-full p-[1px]"
          >
            <Link
              to="/entrar?tab=register"
              className="flex items-center px-6 py-2 bg-black text-white text-sm font-semibold rounded-full hover:bg-gray-900 transition-colors group shadow-md"
            >
              <RollingText text="Começar grátis" />
            </Link>
          </GradientBorder>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="lg:hidden text-white p-2"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="lg:hidden fixed inset-0 bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center space-y-8 z-[-1]"
          >
            <NavLink to="/about" onClick={() => setIsMobileMenuOpen(false)}>Sobre</NavLink>
            <NavLink to="/pricing" onClick={() => setIsMobileMenuOpen(false)}>Preços</NavLink>
            <NavLink to="/integrations" onClick={() => setIsMobileMenuOpen(false)}>Recursos</NavLink>
            <NavLink to="/blogs" onClick={() => setIsMobileMenuOpen(false)}>Blog</NavLink>
            <NavLink to="/entrar" onClick={() => setIsMobileMenuOpen(false)}>Entrar</NavLink>
            <Link
              to="/entrar?tab=register"
              onClick={() => setIsMobileMenuOpen(false)}
              className="px-10 py-4 bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-bold rounded-full"
            >
              Começar grátis
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
