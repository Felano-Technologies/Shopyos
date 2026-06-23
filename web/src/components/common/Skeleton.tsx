import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: number | string;
  circle?: boolean;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  circle = false,
  className = ''
}) => {
  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: circle ? '50%' : (typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius),
  };

  return (
    <div 
      className={`bg-[#CBD5E1] animate-pulse overflow-hidden ${className}`} 
      style={style}
    />
  );
};
