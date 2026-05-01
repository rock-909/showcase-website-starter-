/**
 * 核心路径配置
 */

import type {
  DynamicPageType,
  DynamicRoutePattern,
  LocalizedPath,
  PageType,
} from "@/config/paths/types";

// 核心路径配置 - 使用标准路径方案
export const PATHS_CONFIG = Object.freeze({
  // 基础路径
  home: Object.freeze({
    en: "/",
    zh: "/",
  }),

  // 主要页面路径 - 统一使用标准路径
  about: Object.freeze({
    en: "/about",
    zh: "/about",
  }),

  contact: Object.freeze({
    en: "/contact",
    zh: "/contact",
  }),

  products: Object.freeze({
    en: "/products",
    zh: "/products",
  }),

  // 法律页面 - 统一使用标准路径
  privacy: Object.freeze({
    en: "/privacy",
    zh: "/privacy",
  }),

  terms: Object.freeze({
    en: "/terms",
    zh: "/terms",
  }),

  customProject: Object.freeze({
    en: "/custom-project-support",
    zh: "/custom-project-support",
  }),
} as const satisfies Record<PageType, LocalizedPath>);

// 动态路由配置 - 用于 next-intl 路由和语言切换
export const DYNAMIC_PATHS_CONFIG = Object.freeze({
  productMarket: Object.freeze({
    pattern: "/products/[market]",
    paramName: "market",
  }),
} as const satisfies Record<DynamicPageType, DynamicRoutePattern>);

export type PathsConfig = typeof PATHS_CONFIG;
export type DynamicPathsConfig = typeof DYNAMIC_PATHS_CONFIG;
