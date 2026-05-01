/**
 * i18n Locales Configuration
 * 统一配置翻译工具的语言列表
 *
 * 用于以下脚本：
 * - scripts/translation-scanner.js    (扫描代码中的翻译键)
 * - scripts/translation-sync.js       (同步缺失的翻译键)
 * - scripts/copy-translations.js      (复制翻译文件到 public/)
 * - scripts/validate-translations.js  (验证翻译文件一致性)
 * - scripts/i18n-shape-check.js       (检查翻译键结构一致性)
 *
 * 添加新语言时，只需在此处修改 locales 数组即可。
 */

module.exports = {
  locales: ["en", "zh"],
  defaultLocale: "en",
};
