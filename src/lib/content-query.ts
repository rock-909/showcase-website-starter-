/**
 * Content Management System - Query Functions - 主入口
 * 重新导出所有内容查询相关模块
 */

// 重新导出查询函数
export {
  getAllPages,
  getContentBySlug,
  getPageBySlug,
} from "@/lib/content-query/queries";

// 重新导出统计函数
export { getContentStats } from "@/lib/content-query/stats";
