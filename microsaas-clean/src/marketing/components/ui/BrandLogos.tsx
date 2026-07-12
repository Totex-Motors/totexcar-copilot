import React from 'react';

export const OpenAILogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.0462 6.0462 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 3.5687-2.0594.8152-1.5801-3.9844 2.297-6.0607-3.4951.2559-.5666a4.4998 4.4998 0 0 1 7.3356-1.2092l.8042 7.7346zm-6.9184-5.5584a4.4708 4.4708 0 0 1-1.0835-2.8598l.1419.0853 3.5735 2.0545.4313 1.722-3.9939-2.3066-6.0607 3.5045-.2133-.6045a4.4998 4.4998 0 0 1 4.4413-6.6812l2.7635 7.0858zm-2.005-9.1046a4.4708 4.4708 0 0 1 1.7923-2.4806l-.1419.0853-3.5735 2.0545-1.2417-1.2704 3.9987-2.3018 6.0607 3.4997-.5214.3555a4.4998 4.4998 0 0 1-2.8906 6.9324l-3.4826-6.8746zm10.6626-2.4569a4.4755 4.4755 0 0 1 2.8764 1.0408l-.1419.0805-3.5687 2.0593-.8152 1.5801 3.9844-2.297 6.0607 3.4951-.2559.5666a4.4998 4.4998 0 0 1-7.3356 1.2092l-.8042-7.7346zm6.9184 5.5584a4.4708 4.4708 0 0 1 1.0835 2.8598l-.1419-.0853-3.5735-2.0545-.4313-1.722 3.9939 2.3066 6.0607-3.5045.2133.6045a4.4998 4.4998 0 0 1-4.4413 6.6812l-2.7635-7.0858zm2.005 9.1046a4.4708 4.4708 0 0 1-1.7923 2.4806l.1419-.0853 3.5735-2.0545 1.2417 1.2704-3.9987 2.3018-6.0607-3.4997.5214-.3555a4.4998 4.4998 0 0 1 2.8906-6.9324l3.4826 6.8746z" />
  </svg>
);

export const ClaudeLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="20" height="20" rx="4" fill="#D97757" />
    <path d="M12 5L14 10H10L12 5Z" fill="white" />
    <path d="M17 8L15 13H19L17 8Z" fill="white" />
    <path d="M7 8L9 13H5L7 8Z" fill="white" />
    <path d="M12 19L10 14H14L12 19Z" fill="white" />
    <path d="M17 16L19 11H15L17 16Z" fill="white" />
    <path d="M7 16L5 11H9L7 16Z" fill="white" />
  </svg>
);

export const GeminiLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M16.5 2.6C15.8 2.6 15.2 3.1 15 3.8L13.5 10.2C13.3 11 12.6 11.6 11.8 11.6H3.4C2.5 11.6 1.9 12.4 2.1 13.2L3.5 19.6C3.7 20.4 4.4 21 5.2 21H13.6C14.5 21 15.1 20.2 14.9 19.4L13.5 13C13.3 12.2 14 11.6 14.8 11.6H23.2C24.1 11.6 24.7 10.8 24.5 10L23.1 3.6C22.9 2.8 22.2 2.2 21.4 2.2H16.5V2.6Z" fill="url(#gemini-gradient)" />
    <defs>
      <linearGradient id="gemini-gradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4E84FF" />
        <stop offset="1" stopColor="#FF8675" />
      </linearGradient>
    </defs>
  </svg>
);

export const CohereLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill="#39594D" />
    <path d="M12 6C8.68629 6 6 8.68629 6 12C6 15.3137 8.68629 18 12 18C15.3137 18 18 15.3137 18 12" stroke="white" strokeWidth="2" strokeLinecap="round" />
    <circle cx="16" cy="8" r="2" fill="#F4B486" />
  </svg>
);

export const GrokLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="4" fill="white"/>
    <path d="M6 18L18 6M6 6L18 18" stroke="black" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

export const PerplexityLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="4" fill="#22B8CD"/>
    <path d="M12 4V20M4 12H20M7 7L17 17M7 17L17 7" stroke="white" strokeWidth="2"/>
  </svg>
);

export const LlamaLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#0668E1"/>
    <path d="M12 6C10 6 8 8 8 10V14C8 16 10 18 12 18C14 18 16 16 16 14V10C16 8 14 6 12 6ZM12 10C12.5 10 13 10.5 13 11V13C13 13.5 12.5 14 12 14C11.5 14 11 13.5 11 13V11C11 10.5 11.5 10 12 10Z" fill="white"/>
  </svg>
);

export const DeepSeekLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="6" fill="#4D6BFE"/>
    <path d="M16 8L8 16M8 8L16 16" stroke="white" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

export const DeepgramLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="4" fill="white"/>
    <path d="M7 7H17V12H12V17H7V7Z" fill="black"/>
  </svg>
);

export const ElevenLabsLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="4" fill="white"/>
    <rect x="7" y="6" width="4" height="12" rx="1" fill="black"/>
    <rect x="13" y="6" width="4" height="12" rx="1" fill="black"/>
  </svg>
);

export const RunwayLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="4" fill="white"/>
    <path d="M7 6H13C15.5 6 17 7.5 17 10C17 12.5 15.5 14 13 14H9V18H7V6ZM9 8V12H13C14 12 15 11.5 15 10C15 8.5 14 8 13 8H9Z" fill="black"/>
  </svg>
);
