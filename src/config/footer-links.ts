/**
 * Footer 数据与样式基线（Vercel 抓取参考）
 *
 * 目标：为后续 Footer 组件提供可复用的数据结构、主题配色/间距/字体 token 与 hover 方案。
 * 采样来源：docs/vercel-style-capture.md（视口 1512px，dark/light 双主题）。
 */
import { FOOTER_STYLE_TOKENS } from "@/config/footer-style-tokens";
import {
  SINGLE_SITE_FOOTER_COLUMNS,
  type SiteFooterColumnConfig,
  type SiteFooterLinkItem,
} from "@/config/single-site";

export { FOOTER_STYLE_TOKENS };

export type FooterLinkItem = SiteFooterLinkItem;
export type FooterColumnConfig = SiteFooterColumnConfig;

export interface FooterLayoutTokens {
  /** 容器最大宽度（接近 Vercel 抓取的 1080px） */
  maxWidthPx: number;
  /** 左右留白：clamp(24px, 12vw, 184px) 对齐抓取数据 */
  marginXClamp: string;
  /** 内边距（与现有 layout 的 px-4/6/8 协调） */
  paddingX: {
    basePx: number;
    mdPx: number;
    lgPx: number;
  };
  /** 垂直内边距，用于保持顶部/底部留白一致 */
  paddingY: {
    basePx: number;
    mdPx: number;
    lgPx: number;
  };
  /** 网格间距 */
  gapPx: {
    column: number;
    row: number;
  };
  /** 单列最小宽度，避免窄屏拥挤 */
  minColumnWidthPx: number;
}

export interface FooterTypographyTokens {
  title: {
    fontSizePx: number;
    lineHeightPx: number;
    fontWeight: number;
    letterSpacing?: string;
  };
  link: {
    fontSizePx: number;
    lineHeightPx: number;
    fontWeight: number;
  };
  fontFamily: string;
}

export interface FooterColorTokens {
  light: {
    text: string;
    hoverText: string;
  };
  dark: {
    text: string;
    hoverText: string;
  };
  selection: {
    light: { background: string; foreground: string };
    dark: { background: string; foreground: string };
  };
}

export interface FooterHoverTokens {
  description: string;
  transition: string;
  light: {
    text: string;
    underline: boolean;
  };
  dark: {
    text: string;
    underline: boolean;
  };
}

export interface FooterStyleTokens {
  layout: FooterLayoutTokens;
  typography: FooterTypographyTokens;
  colors: FooterColorTokens;
  hover: FooterHoverTokens;
}

// Footer truth is authored in `src/config/single-site.ts`; this module only
// exposes the active single-site columns together with style tokens.
export const FOOTER_COLUMNS: FooterColumnConfig[] = SINGLE_SITE_FOOTER_COLUMNS;

export type FooterTokens = typeof FOOTER_STYLE_TOKENS;
