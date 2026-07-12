import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { GradientBorder } from "../components/ui/GradientBorder";
import { CTA } from "../components/CTA";
import { RollingText } from "../components/ui/RollingText";

export const NotFound = () => {
  return (
    <div className="relative w-full min-h-screen pt-32 bg-[#050505] overflow-x-hidden flex flex-col">
      {/* Background Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] bg-blue-900/10 blur-[150px] rounded-full opacity-40" />
      </div>

      <div className="flex-grow flex items-center justify-center relative z-10 px-6">
        <div className="text-center max-w-2xl mx-auto">
          {/* 404 SVG Text for Gradient Stroke Effect */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="mb-8 relative"
          >
            <svg
              viewBox="0 0 300 120"
              className="w-full h-auto max-w-[600px] mx-auto overflow-visible"
            >
              <defs>
                <linearGradient
                  id="textGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="0%" stopColor="#0D8DFD" />
                  <stop offset="100%" stopColor="#CB342A" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <text
                x="50%"
                y="50%"
                dy=".35em"
                textAnchor="middle"
                className="text-[150px] font-bold"
                style={{
                  fill: "transparent",
                  stroke: "url(#textGradient)",
                  strokeWidth: "2px",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                404
              </text>
              {/* Inner glow/fill for better visibility */}
              <text
                x="50%"
                y="50%"
                dy=".35em"
                textAnchor="middle"
                className="text-[150px] font-bold opacity-10"
                style={{
                  fill: "url(#textGradient)",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                404
              </text>
            </svg>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl md:text-3xl font-medium text-white mb-4 leading-snug"
          >
            Hmmmm... I couldn't find that page. It's <br />
            just me playing the guitar :)
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-12 flex justify-center"
          >
            <GradientBorder
              gradient="from-teal-500 via-cyan-500 to-teal-600"
              containerClassName="rounded-full p-[1px]"
            >
              <Link to="/">
                <button
                  className="px-12 py-3 bg-black text-white text-sm font-medium rounded-full hover:bg-gray-900 transition-colors group"
                  name="back-to-home"
                >
                  <RollingText text="Back to home" />
                </button>
              </Link>
            </GradientBorder>
          </motion.div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative z-20">
        <CTA />
      </div>
    </div>
  );
};
