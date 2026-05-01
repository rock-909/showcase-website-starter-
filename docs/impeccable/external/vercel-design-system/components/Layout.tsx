import React from 'react';

/**
 * ============================================================
 * 容器组件 (Container)
 * ============================================================
 */

interface ContainerProps {
  children: React.ReactNode;
  /** 容器变体 */
  variant?: 'default' | 'narrow' | 'wide' | 'form';
  /** 自定义类名 */
  className?: string;
  /** 是否移除内边距 */
  noPadding?: boolean;
}

const containerWidths = {
  default: 'max-w-[1080px]',
  narrow: 'max-w-[860px]',
  wide: 'max-w-[1280px]',
  form: 'max-w-[640px]',
};

export const Container: React.FC<ContainerProps> = ({
  children,
  variant = 'default',
  className = '',
  noPadding = false,
}) => {
  const padding = noPadding ? '' : 'px-6 sm:px-6';
  
  return (
    <div className={`w-full mx-auto ${containerWidths[variant]} ${padding} ${className}`}>
      {children}
    </div>
  );
};

/**
 * ============================================================
 * 装饰网格线组件 (DecorativeGrid)
 * ============================================================
 */

interface DecorativeGridProps {
  children: React.ReactNode;
  /** 网格列数 */
  columns?: number;
  /** 网格行数 */
  rows?: number;
  /** 是否显示交叉标记 */
  showCrosshairs?: boolean;
  /** 自定义类名 */
  className?: string;
}

export const DecorativeGrid: React.FC<DecorativeGridProps> = ({
  children,
  columns = 12,
  rows = 8,
  showCrosshairs = false,
  className = '',
}) => {
  return (
    <div className={`relative ${className}`}>
      {/* 网格线背景 */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {Array.from({ length: columns * rows }).map((_, i) => {
          const col = i % columns;
          const row = Math.floor(i / columns);
          const isLastCol = col === columns - 1;
          const isLastRow = row === rows - 1;
          
          return (
            <div
              key={i}
              className={`
                ${!isLastCol ? 'border-r border-black/[0.05] dark:border-white/[0.05]' : ''}
                ${!isLastRow ? 'border-b border-black/[0.05] dark:border-white/[0.05]' : ''}
              `}
            />
          );
        })}
      </div>
      
      {/* 交叉标记 */}
      {showCrosshairs && (
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {/* 左上角 */}
          <Crosshair position="top-left" />
          {/* 右上角 */}
          <Crosshair position="top-right" />
          {/* 左下角 */}
          <Crosshair position="bottom-left" />
          {/* 右下角 */}
          <Crosshair position="bottom-right" />
        </div>
      )}
      
      {/* 内容 */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

/**
 * 交叉标记组件
 */
interface CrosshairProps {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

const Crosshair: React.FC<CrosshairProps> = ({ position }) => {
  const positionClasses = {
    'top-left': 'top-0 left-0',
    'top-right': 'top-0 right-0',
    'bottom-left': 'bottom-0 left-0',
    'bottom-right': 'bottom-0 right-0',
  };
  
  return (
    <div className={`absolute ${positionClasses[position]}`}>
      {/* 水平线 */}
      <div className="absolute w-[21px] h-[1px] bg-gray-300 dark:bg-gray-600" />
      {/* 垂直线 */}
      <div className="absolute w-[1px] h-[21px] bg-gray-300 dark:bg-gray-600" />
    </div>
  );
};

/**
 * ============================================================
 * 简单网格背景 (使用 CSS 背景)
 * ============================================================
 */

interface GridBackgroundProps {
  children: React.ReactNode;
  /** 网格单元大小 */
  cellSize?: number;
  /** 自定义类名 */
  className?: string;
}

export const GridBackground: React.FC<GridBackgroundProps> = ({
  children,
  cellSize = 90,
  className = '',
}) => {
  return (
    <div
      className={`relative ${className}`}
      style={{
        backgroundImage: `
          linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)
        `,
        backgroundSize: `${cellSize}px ${cellSize}px`,
      }}
    >
      {children}
    </div>
  );
};

/**
 * ============================================================
 * 分割线组件 (Divider)
 * ============================================================
 */

interface DividerProps {
  /** 方向 */
  orientation?: 'horizontal' | 'vertical';
  /** 自定义类名 */
  className?: string;
}

export const Divider: React.FC<DividerProps> = ({
  orientation = 'horizontal',
  className = '',
}) => {
  if (orientation === 'vertical') {
    return (
      <div 
        className={`w-px h-full bg-black/[0.05] dark:bg-white/[0.05] ${className}`} 
        aria-hidden="true"
      />
    );
  }
  
  return (
    <div 
      className={`w-full h-px bg-black/[0.05] dark:bg-white/[0.05] ${className}`} 
      aria-hidden="true"
    />
  );
};

/**
 * ============================================================
 * 响应式断点 Hook
 * ============================================================
 */

export const breakpoints = {
  xs: 375,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1150,  // 导航切换点
  '2xl': 1400,
} as const;

export type BreakpointKey = keyof typeof breakpoints;

/**
 * 获取当前断点的 Hook
 */
export const useBreakpoint = () => {
  const [breakpoint, setBreakpoint] = React.useState<BreakpointKey>('xs');
  
  React.useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      
      if (width >= breakpoints['2xl']) {
        setBreakpoint('2xl');
      } else if (width >= breakpoints.xl) {
        setBreakpoint('xl');
      } else if (width >= breakpoints.lg) {
        setBreakpoint('lg');
      } else if (width >= breakpoints.md) {
        setBreakpoint('md');
      } else if (width >= breakpoints.sm) {
        setBreakpoint('sm');
      } else {
        setBreakpoint('xs');
      }
    };
    
    updateBreakpoint();
    window.addEventListener('resize', updateBreakpoint);
    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);
  
  return breakpoint;
};

/**
 * 判断是否为移动导航模式
 */
export const useIsMobileNav = () => {
  const [isMobile, setIsMobile] = React.useState(false);
  
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= breakpoints.xl);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  return isMobile;
};
