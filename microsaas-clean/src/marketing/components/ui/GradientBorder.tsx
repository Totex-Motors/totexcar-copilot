import React from 'react';
import { cn } from '../../lib/utils';

interface GradientBorderProps {
  children: React.ReactNode;
  className?: string;
  containerClassName?: string;
  gradient?: string;
}

export const GradientBorder: React.FC<GradientBorderProps> = ({ 
  children, 
  className, 
  containerClassName,
  gradient = "from-teal-500 via-cyan-500 to-teal-600"
}) => {
  return (
    <div className={cn("relative group p-[1px] rounded-full overflow-hidden", containerClassName)}>
      <div className={cn("absolute inset-0 bg-gradient-to-r opacity-70 group-hover:opacity-100 transition-opacity duration-300", gradient)} />
      <div className={cn("relative bg-black rounded-full h-full w-full", className)}>
        {children}
      </div>
    </div>
  );
};
