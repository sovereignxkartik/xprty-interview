import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl',
  };

  return (
    <span className={`inline-flex items-center font-sans tracking-tight ${sizeClasses[size]} ${className}`}>
      {/* <span className="text-[#DB7A57] font-semibold mr-0.5">&lt;/</span>
      <span className="text-[#F4F2EB] font-medium lowercase">xprty</span>
      <span className="text-[#DB7A57] font-semibold ml-0.5">&gt;</span> */}
      <span className="text-[#ABA7A2] font-normal ml-2 tracking-normal text-xs uppercase opacity-80">
        Xprty Interview
      </span>
    </span>
  );
};
