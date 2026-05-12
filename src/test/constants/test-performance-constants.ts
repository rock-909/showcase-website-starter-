/**
 * 测试性能相关常量定义
 * 包含Web Vitals、性能监控、主题分析等性能相关常量
 */

// ==================== Web Vitals 性能监控常量 ====================

/** Web Vitals 性能监控相关常量 */
export const WEB_VITALS_CONSTANTS = {
  // 性能阈值 - CLS (Cumulative Layout Shift)
  CLS_GOOD_THRESHOLD: 0.1,
  CLS_NEEDS_IMPROVEMENT_THRESHOLD: 0.25,
  CLS_WARNING_CHANGE: 0.05,
  CLS_CRITICAL_CHANGE: 0.1,

  // 性能阈值 - LCP (Largest Contentful Paint)
  LCP_GOOD_THRESHOLD: 2500, // 毫秒
  LCP_NEEDS_IMPROVEMENT_THRESHOLD: 4000, // 毫秒
  LCP_WARNING_CHANGE: 500, // 毫秒
  LCP_CRITICAL_CHANGE: 1000, // 毫秒

  // 性能阈值 - FID (First Input Delay)
  FID_GOOD_THRESHOLD: 100, // 毫秒
  FID_NEEDS_IMPROVEMENT_THRESHOLD: 300, // 毫秒
  FID_WARNING_CHANGE: 50, // 毫秒
  FID_CRITICAL_CHANGE: 100, // 毫秒

  // 性能阈值 - FCP (First Contentful Paint)
  FCP_GOOD_THRESHOLD: 1800, // 毫秒
  FCP_NEEDS_IMPROVEMENT_THRESHOLD: 3000, // 毫秒
  FCP_WARNING_CHANGE: 300, // 毫秒
  FCP_CRITICAL_CHANGE: 600, // 毫秒

  // 性能阈值 - TTFB (Time to First Byte)
  TTFB_GOOD_THRESHOLD: 800, // 毫秒
  TTFB_NEEDS_IMPROVEMENT_THRESHOLD: 1800, // 毫秒
  TTFB_WARNING_CHANGE: 200, // 毫秒
  TTFB_CRITICAL_CHANGE: 400, // 毫秒

  // 性能阈值 - INP (Interaction to Next Paint)
  INP_GOOD_THRESHOLD: 200, // 毫秒
  INP_NEEDS_IMPROVEMENT_THRESHOLD: 500, // 毫秒
  INP_WARNING_CHANGE: 100, // 毫秒
  INP_CRITICAL_CHANGE: 200, // 毫秒

  // 监控配置
  MONITORING_INTERVAL: 1000, // 监控间隔 (毫秒)
  SAMPLE_RATE: 0.1, // 采样率 (10%)
  MAX_SAMPLES: 100, // 最大样本数
  BUFFER_SIZE: 50, // 缓冲区大小
  FLUSH_INTERVAL: 5000, // 刷新间隔 (毫秒)

  // 分析配置
  ANALYSIS_WINDOW: 30000, // 分析窗口 (毫秒)
  TREND_WINDOW: 10, // 趋势窗口大小
  OUTLIER_THRESHOLD: 2.0, // 异常值阈值 (标准差倍数)
  CONFIDENCE_LEVEL: 0.95, // 置信水平

  // 报告配置
  REPORT_INTERVAL: 60000, // 报告间隔 (毫秒)
  MAX_REPORT_SIZE: 1000, // 最大报告大小
  COMPRESSION_THRESHOLD: 500, // 压缩阈值
  RETENTION_PERIOD: 86400000, // 保留期 (24小时，毫秒)

  // 性能预算
  PERFORMANCE_BUDGET_JS: 170000, // JavaScript 预算 (字节)
  PERFORMANCE_BUDGET_CSS: 50000, // CSS 预算 (字节)
  PERFORMANCE_BUDGET_IMAGES: 500000, // 图片预算 (字节)
  PERFORMANCE_BUDGET_FONTS: 100000, // 字体预算 (字节)

  // 网络配置
  SLOW_NETWORK_THRESHOLD: 1000, // 慢网络阈值 (毫秒)
  FAST_NETWORK_THRESHOLD: 200, // 快网络阈值 (毫秒)
  NETWORK_TIMEOUT: 10000, // 网络超时 (毫秒)
  RETRY_ATTEMPTS: 3, // 重试次数

  // 设备配置
  LOW_END_DEVICE_THRESHOLD: 2, // 低端设备阈值 (CPU 核心数)
  HIGH_END_DEVICE_THRESHOLD: 8, // 高端设备阈值 (CPU 核心数)
  MEMORY_THRESHOLD_LOW: 2048, // 低内存阈值 (MB)
  MEMORY_THRESHOLD_HIGH: 8192, // 高内存阈值 (MB)

  // 测试配置
  TEST_DURATION: 30000, // 测试持续时间 (毫秒)
  WARMUP_DURATION: 5000, // 预热时间 (毫秒)
  COOLDOWN_DURATION: 2000, // 冷却时间 (毫秒)
  TEST_ITERATIONS: 10, // 测试迭代次数

  // 数据处理
  SMOOTHING_FACTOR: 0.1, // 平滑因子
  PERCENTILE_95: 0.95, // 95百分位
  PERCENTILE_99: 0.99, // 99百分位
  MOVING_AVERAGE_WINDOW: 5, // 移动平均窗口

  // 阈值配置
  PERFORMANCE_SCORE_EXCELLENT: 90, // 优秀性能分数
  PERFORMANCE_SCORE_GOOD: 70, // 良好性能分数
  PERFORMANCE_SCORE_POOR: 50, // 较差性能分数
  PERFORMANCE_SAMPLE_SIZE: 40, // 性能采样大小
  ANALYSIS_DEPTH_LIMIT: 3, // 分析深度限制
  REPORT_ITEM_LIMIT: 50, // 报告项目限制

  // 评分权重配置
  SCORE_WEIGHT_QUARTER: 0.25, // 四分之一权重
  SCORE_WEIGHT_HALF: 0.5, // 一半权重
  SCORE_WEIGHT_FULL: 1.0, // 全权重

  // 评分乘数配置
  SCORE_MULTIPLIER_GOOD: 30, // 良好评分乘数
  SCORE_MULTIPLIER_NEEDS_IMPROVEMENT: 15, // 需要改进评分乘数
  SCORE_MULTIPLIER_POOR: 5, // 较差评分乘数

  // 资源监控配置
  SLOW_RESOURCE_THRESHOLD: 1000, // 慢资源阈值 (毫秒)
  MAX_SLOW_RESOURCES: 10, // 最大慢资源数量

  // 测试时间常量
  TEST_FETCH_START: 100, // 测试获取开始时间
  TEST_DOMAIN_LOOKUP_END: 150, // 测试域名查找结束时间
  TEST_CONNECT_START: 200, // 测试连接开始时间
  TEST_CONNECT_END: 250, // 测试连接结束时间
  TEST_REQUEST_START: 300, // 测试请求开始时间
  TEST_RESPONSE_START: 400, // 测试响应开始时间
  TEST_RESPONSE_END: 500, // 测试响应结束时间
  TEST_DOM_INTERACTIVE: 600, // 测试DOM交互时间
  TEST_DOM_CONTENT_LOADED_START: 700, // 测试DOM内容加载开始时间
  TEST_DOM_CONTENT_LOADED_END: 750, // 测试DOM内容加载结束时间
  TEST_DOM_COMPLETE: 800, // 测试DOM完成时间
  TEST_LOAD_EVENT_END: 900, // 测试加载事件结束时间

  // 测试网络常量
  TEST_DOWNLINK_SPEED: 10, // 测试下行速度 (Mbps)
  TEST_RTT_LATENCY: 50, // 测试RTT延迟 (毫秒)

  // 测试定时器常量
  TEST_TIMER_ADVANCE: 1000, // 测试定时器推进时间 (毫秒)
  TEST_TIMEOUT_LONG: 5000, // 测试长超时时间 (毫秒)
} as const;

// ==================== 主题分析测试常量 ====================

/** 主题分析测试相关常量 */
export const THEME_ANALYTICS_CONSTANTS = {
  // 采样率常量
  SAMPLE_RATE_FULL: 1.0, // 100% 采样
  SAMPLE_RATE_HALF: 0.5, // 50% 采样
  SAMPLE_RATE_SIXTY_PERCENT: 0.6, // 60% 采样
  SAMPLE_RATE_INVALID: 1.5, // 无效采样率 (>1.0)

  // 时间常量
  COLLECTION_INTERVAL: 1000, // 收集间隔 (毫秒)
  ANALYSIS_INTERVAL: 5000, // 分析间隔 (毫秒)
  REPORT_INTERVAL: 30000, // 报告间隔 (毫秒)
  SESSION_TIMEOUT: 1800000, // 会话超时 (30分钟)

  // 数据限制
  MAX_EVENTS_PER_SESSION: 1000, // 每会话最大事件数
  MAX_SESSION_DURATION: 3600000, // 最大会话时长 (1小时)
  MAX_QUEUE_SIZE: 500, // 最大队列大小
  BATCH_SIZE: 50, // 批处理大小

  // 性能阈值
  PROCESSING_TIME_LIMIT: 100, // 处理时间限制 (毫秒)
  MEMORY_USAGE_LIMIT: 50, // 内存使用限制 (MB)
  CPU_USAGE_LIMIT: 80, // CPU使用限制 (%)
  NETWORK_LATENCY_LIMIT: 200, // 网络延迟限制 (毫秒)

  // 错误处理
  MAX_RETRY_ATTEMPTS: 3, // 最大重试次数
  RETRY_DELAY: 1000, // 重试延迟 (毫秒)
  ERROR_THRESHOLD: 0.05, // 错误阈值 (5%)
  CIRCUIT_BREAKER_THRESHOLD: 10, // 断路器阈值

  // 随机数生成
  RANDOM_SEED: 12345, // 随机种子
  RANDOM_RANGE: 1000, // 随机范围
  RANDOM_DIVISOR: 4294967296, // 随机除数 (2^32)
  RANDOM_MULTIPLIER: 1664525, // 随机乘数

  // 浏览器兼容性
  CHROME_VERSION: 91.0, // Chrome 版本
  FIREFOX_VERSION: 89.0, // Firefox 版本
  SAFARI_VERSION: 14.1, // Safari 版本
  EDGE_VERSION: 91.0, // Edge 版本
  WINDOWS_VERSION: 10.0, // Windows 版本
  MAC_VERSION: 10.15, // macOS 版本
  WEBKIT_VERSION: 537.36, // WebKit 版本
} as const;

// ==================== 测试性能基准常量 ====================

/** 测试性能基准常量 */
export const TEST_PERFORMANCE_CONSTANTS = {
  /** 性能测试基准时间 - 25ms */
  BENCHMARK_TIME: 25,

  /** 性能测试分钟基准 - 60 */
  BENCHMARK_MINUTE: 60,

  /** 性能测试小时基准 - 24 */
  BENCHMARK_HOUR: 24,

  /** 性能测试毫秒基准 - 1000 */
  BENCHMARK_MILLISECOND: 1000,
} as const;

// ==================== 导出性能常量类型 ====================

export type WebVitalsConstants = typeof WEB_VITALS_CONSTANTS;
export type ThemeAnalyticsConstants = typeof THEME_ANALYTICS_CONSTANTS;
export type TestPerformanceConstants = typeof TEST_PERFORMANCE_CONSTANTS;
