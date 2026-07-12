import React from 'react';

interface RollingTextProps {
  text: string;
  className?: string;
}

export const RollingText: React.FC<RollingTextProps> = ({ text, className = "" }) => {
  return (
    <div className={`relative overflow-hidden h-[1.3em] flex flex-col items-center justify-start ${className}`}>
      {/* Primary Text */}
      <span className="block transition-transform duration-300 ease-in-out group-hover:-translate-y-[150%]">
        {text}
      </span>
      {/* Duplicate Text (enters from bottom) */}
      <span className="absolute top-0 translate-y-[150%] transition-transform duration-300 ease-in-out group-hover:translate-y-0">
        {text}
      </span>
    </div>
  );
};
