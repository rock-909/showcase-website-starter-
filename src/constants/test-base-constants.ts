/**
 * 测试基础常量定义
 * 包含最基本的数字、时间、计数等常量
 */

// ==================== 测试基础常量 ====================

/** 测试基础数字常量 */
export const TEST_BASE_NUMBERS = {
  // 时间相关
  MILLISECONDS_PER_SECOND: 1000,
  SECONDS_PER_MINUTE: 60,
  MINUTES_PER_HOUR: 60,
  HOURS_PER_DAY: 24,
  TWENTY_FIVE_HOURS: 25,

  // 计数相关
  SMALL_COUNT: 2,
  MEDIUM_COUNT: 5,
  LARGE_COUNT: 10,
  VERY_LARGE_COUNT: 20,
  HUGE_COUNT: 25,

  // 百分比
  PERCENTAGE_FULL: 100,
  HALF_PERCENTAGE: 50,

  // 角度
  FULL_CIRCLE_DEGREES: 360,
} as const;

// ==================== 测试超时和延迟常量 ====================

/** 测试超时常量 (毫秒) */
export const TEST_TIMEOUT_CONSTANTS = {
  /** 标准测试超时 - 1000ms */
  STANDARD: TEST_BASE_NUMBERS.MILLISECONDS_PER_SECOND,

  /** 扩展测试超时 - 1100ms */
  EXTENDED:
    TEST_BASE_NUMBERS.MILLISECONDS_PER_SECOND +
    TEST_BASE_NUMBERS.PERCENTAGE_FULL,

  /** 长测试超时 - 2000ms */
  LONG:
    TEST_BASE_NUMBERS.SMALL_COUNT * TEST_BASE_NUMBERS.MILLISECONDS_PER_SECOND,

  /** 超长测试超时 - 2100ms */
  EXTRA_LONG: 2100,

  /** 短延迟 - 100ms */
  SHORT_DELAY: 100,

  /** 中等延迟 - 200ms */
  MEDIUM_DELAY: 200,
} as const;

// ==================== 测试计数常量 ====================

/** 测试迭代和计数常量 */
export const TEST_COUNT_CONSTANTS = {
  /** 小计数 - 2 */
  SMALL: TEST_BASE_NUMBERS.SMALL_COUNT,

  /** 中等计数 - 5 */
  MEDIUM: TEST_BASE_NUMBERS.MEDIUM_COUNT,

  /** 大计数 - 10 */
  LARGE: TEST_BASE_NUMBERS.LARGE_COUNT,

  /** 超大计数 - 20 */
  VERY_LARGE: TEST_BASE_NUMBERS.VERY_LARGE_COUNT,

  /** 巨大计数 - 25 */
  HUGE: TEST_BASE_NUMBERS.HUGE_COUNT,

  /** 完整百分比 - 100 */
  PERCENTAGE_FULL: TEST_BASE_NUMBERS.PERCENTAGE_FULL,
} as const;

// ==================== 测试百分比常量 ====================

/** 测试百分比常量 */
export const TEST_PERCENTAGE_CONSTANTS = {
  /** 完整 - 100% */
  FULL: TEST_BASE_NUMBERS.PERCENTAGE_FULL,

  /** 一半 - 50% */
  HALF: TEST_BASE_NUMBERS.HALF_PERCENTAGE,

  /** 四分之一 - 25% */
  QUARTER: TEST_BASE_NUMBERS.HUGE_COUNT,
} as const;

// ==================== 测试时间戳常量 ====================

/** 测试时间戳常量 */
export const TEST_TIMESTAMP_CONSTANTS = {
  /** 基础时间戳 - 1000 */
  BASE: TEST_BASE_NUMBERS.MILLISECONDS_PER_SECOND,

  /** 时间戳偏移 - 1005 */
  OFFSET: 1005,

  /** 时间戳增量 - 1010 */
  INCREMENT: 1010,

  /** 时间戳差值 - 1020 */
  DELTA: 1020,

  /** 时间戳步长 - 1050 */
  STEP: 1050,

  /** 时间戳间隔 - 1100 */
  INTERVAL: 1100,

  /** 大数值偏移 - 200100 */
  LARGE_OFFSET: 200100,
} as const;

// ==================== 导出基础常量 ====================

/** 基础测试常量类型定义 */
export type TestTimeoutConstants = typeof TEST_TIMEOUT_CONSTANTS;
export type TestCountConstants = typeof TEST_COUNT_CONSTANTS;
export type TestPercentageConstants = typeof TEST_PERCENTAGE_CONSTANTS;
export type TestTimestampConstants = typeof TEST_TIMESTAMP_CONSTANTS;
