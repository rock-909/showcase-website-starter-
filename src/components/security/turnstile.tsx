"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Turnstile } from "@marsidev/react-turnstile";
import { logger } from "@/lib/logger-core";
import {
  getPublicRuntimeEnvBoolean,
  getPublicRuntimeEnvString,
  isPublicRuntimeDevelopment,
} from "@/lib/public-env";

/**
 * 使用全局 logger（开发环境输出，生产环境静默）
 */

interface TurnstileProps {
  onSuccess?: (_token: string) => void;
  onError?: (_error: string) => void;
  onExpire?: () => void;
  onLoad?: () => void;
  className?: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "compact";
  tabIndex?: number;
  id?: string;
  action?: string;
  cData?: string;
}

/**
 * Cloudflare Turnstile CAPTCHA component
 */
export function TurnstileWidget({
  onSuccess,
  onError,
  onExpire,
  onLoad,
  className,
  theme = "auto",
  size = "normal",
  tabIndex,
  id,
  action = getPublicRuntimeEnvString("NEXT_PUBLIC_TURNSTILE_ACTION") ||
    "contact_form",
  cData,
}: TurnstileProps) {
  const siteKey = getPublicRuntimeEnvString("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
  const isBypassMode =
    isPublicRuntimeDevelopment() &&
    getPublicRuntimeEnvBoolean("NEXT_PUBLIC_TURNSTILE_BYPASS") === true;
  const bypassTriggeredRef = useRef(false);

  // All hooks must be called before any conditional returns
  useEffect(() => {
    if (!isBypassMode || bypassTriggeredRef.current) return;
    bypassTriggeredRef.current = true;
    logger.warn("[DEV] Turnstile bypass mode enabled");
    if (onSuccess) {
      onSuccess("TURNSTILE_BYPASS_TOKEN");
    }
  }, [isBypassMode, onSuccess]);

  useEffect(() => {
    if (!siteKey && !isBypassMode) {
      logger.warn(
        "Turnstile site key not configured. Bot protection is disabled.",
      );
      if (onError) {
        onError("Turnstile site key not configured");
      }
    }
  }, [siteKey, isBypassMode, onError]);

  // Conditional returns after all hooks
  if (isBypassMode) {
    return (
      <div
        className={`turnstile-bypass ${className ?? ""}`}
        data-testid="turnstile-bypass"
        role="status"
        aria-live="polite"
      >
        <div className="rounded-md border border-[var(--warning-border)] bg-[var(--warning-muted)] p-3 text-sm text-[var(--warning-foreground)]">
          <strong>Dev Mode:</strong> Turnstile verification bypassed
        </div>
      </div>
    );
  }

  if (!siteKey) {
    return (
      <div
        className={`turnstile-fallback ${className ?? ""}`}
        role="status"
        aria-live="polite"
      >
        <div className="text-sm text-destructive">
          Security verification is temporarily unavailable.
        </div>
      </div>
    );
  }

  if (getPublicRuntimeEnvBoolean("NEXT_PUBLIC_TEST_MODE") === true) {
    return (
      <div
        className={`turnstile-mock ${className ?? ""}`}
        data-testid="turnstile-mock"
      >
        <div className="text-sm text-muted-foreground">
          Bot protection disabled in test mode
        </div>
      </div>
    );
  }

  const handleSuccess = (token: string) => {
    if (onSuccess) {
      onSuccess(token);
    }
  };

  const handleError = (error: string) => {
    logger.error("Turnstile error:", error);
    if (onError) {
      onError(error);
    }
  };

  const handleExpire = () => {
    logger.warn("Turnstile token expired");
    if (onExpire) {
      onExpire();
    }
  };

  const handleLoad = () => {
    if (onLoad) {
      onLoad();
    }
  };

  return (
    <div className={`turnstile-container ${className || ""}`}>
      <Turnstile
        siteKey={siteKey}
        onSuccess={handleSuccess}
        onError={handleError}
        onExpire={handleExpire}
        onLoad={handleLoad}
        options={{
          theme,
          size,
          tabIndex,
          action,
          cData,
        }}
        id={id}
      />
    </div>
  );
}

/**
 * Hook for managing Turnstile state
 */
export function useTurnstile() {
  const [isVerified, setIsVerified] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, _setError] = useState<string | null>(null);
  const [isLoading, _setIsLoading] = useState(false);

  const handleSuccessCallback = useCallback((verificationToken: string) => {
    setToken(verificationToken);
    setIsVerified(true);
    _setError(null);
    _setIsLoading(false);
  }, []);

  const handleError = useCallback((errorMessage: string) => {
    _setError(errorMessage);
    setIsVerified(false);
    setToken(null);
    _setIsLoading(false);
  }, []);

  const handleExpire = useCallback(() => {
    setIsVerified(false);
    setToken(null);
    _setError(null);
    _setIsLoading(false);
  }, []);

  const handleLoad = useCallback(() => {
    _setIsLoading(true);
    _setError(null);
  }, []);

  const reset = useCallback(() => {
    setIsVerified(false);
    setToken(null);
    _setError(null);
    _setIsLoading(false);
  }, []);

  return {
    isVerified,
    token,
    error,
    isLoading,
    handlers: {
      onSuccess: handleSuccessCallback,
      onError: handleError,
      onExpire: handleExpire,
      onLoad: handleLoad,
    },
    reset,
  };
}

// Re-export for convenience
export { Turnstile } from "@marsidev/react-turnstile";
