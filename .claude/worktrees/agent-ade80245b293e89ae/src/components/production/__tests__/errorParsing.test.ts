import { describe, it, expect } from "vitest";

/**
 * PipelineErrorBanner Component Guard Rails
 * 
 * These tests verify the error parsing and classification logic
 * that determines how errors are displayed to users.
 */

// Simulates the parseError function from PipelineErrorBanner.tsx
interface PipelineError {
  code: string;
  message: string;
  isRetryable: boolean;
  suggestion?: string;
}

function parseError(error: string | null | undefined): PipelineError | null {
  if (!error) return null;

  const errorLower = error.toLowerCase();

  // Continuity failures - CRITICAL GUARD
  if (errorLower.includes("continuity") || errorLower.includes("frame")) {
    return {
      code: "CONTINUITY_ERROR",
      message: error,
      isRetryable: true,
      suggestion: "Frame extraction failed. The system will auto-recover on retry.",
    };
  }

  // Credit errors
  if (
    errorLower.includes("credit") ||
    errorLower.includes("402") ||
    errorLower.includes("balance")
  ) {
    return {
      code: "INSUFFICIENT_CREDITS",
      message: error,
      isRetryable: false,
      suggestion: "Add more credits to continue generating clips.",
    };
  }

  // Rate limiting
  if (
    errorLower.includes("rate") ||
    errorLower.includes("429") ||
    errorLower.includes("too many")
  ) {
    return {
      code: "RATE_LIMITED",
      message: error,
      isRetryable: true,
      suggestion: "API rate limit reached. Wait a moment and retry.",
    };
  }

  // Content policy
  if (
    errorLower.includes("content") ||
    errorLower.includes("policy") ||
    errorLower.includes("violate")
  ) {
    return {
      code: "CONTENT_POLICY",
      message: error,
      isRetryable: false,
      suggestion: "Prompt contains restricted content. Edit the prompt and retry.",
    };
  }

  // Production incomplete
  if (
    errorLower.includes("production incomplete") ||
    errorLower.includes("failed:")
  ) {
    return {
      code: "PRODUCTION_INCOMPLETE",
      message: error,
      isRetryable: true,
      suggestion: "Some clips failed to generate. Use Resume to continue production.",
    };
  }

  // Model/API errors
  if (
    errorLower.includes("model") ||
    errorLower.includes("deprecated") ||
    errorLower.includes("422")
  ) {
    return {
      code: "MODEL_ERROR",
      message: error,
      isRetryable: true,
      suggestion: "The AI model encountered an issue. Retry should use fallback.",
    };
  }

  // Timeout errors
  if (errorLower.includes("timeout") || errorLower.includes("timed out")) {
    return {
      code: "TIMEOUT",
      message: error,
      isRetryable: true,
      suggestion: "Request timed out. The server is busy - retry in a moment.",
    };
  }

  // Default
  return {
    code: "UNKNOWN",
    message: error,
    isRetryable: true,
    suggestion: "An unexpected error occurred. Try resuming the pipeline.",
  };
}

describe("PipelineErrorBanner - Error Parsing", () => {
  describe("STRICT_CONTINUITY_FAILURE Classification", () => {
    it("should classify STRICT_CONTINUITY_FAILURE as CONTINUITY_ERROR", () => {
      const result = parseError(
        "STRICT_CONTINUITY_FAILURE: Clip 6 requires valid last frame from clip 5"
      );
      expect(result?.code).toBe("CONTINUITY_ERROR");
      expect(result?.isRetryable).toBe(true);
    });

    it("should suggest auto-recovery for continuity errors", () => {
      const result = parseError("STRICT_CONTINUITY_FAILURE: No last frame URL");
      expect(result?.suggestion).toContain("auto-recover");
    });

    it("should classify frame extraction errors as continuity", () => {
      const result = parseError("Frame extraction failed for clip 3");
      expect(result?.code).toBe("CONTINUITY_ERROR");
    });

    it("should classify 'last frame' errors as continuity", () => {
      const result = parseError("No last frame URL extracted from previous clip");
      expect(result?.code).toBe("CONTINUITY_ERROR");
    });
  });

  describe("Credit Errors", () => {
    it("should classify insufficient credits as non-retryable", () => {
      const result = parseError("Insufficient credits to continue");
      expect(result?.code).toBe("INSUFFICIENT_CREDITS");
      expect(result?.isRetryable).toBe(false);
    });

    it("should classify 402 errors as credit errors", () => {
      const result = parseError("HTTP 402: Payment required");
      expect(result?.code).toBe("INSUFFICIENT_CREDITS");
    });

    it("should classify balance errors as credit errors", () => {
      const result = parseError("Credit balance too low");
      expect(result?.code).toBe("INSUFFICIENT_CREDITS");
    });
  });

  describe("Rate Limiting", () => {
    it("should classify rate limit errors as retryable", () => {
      const result = parseError("Rate limit exceeded, please wait");
      expect(result?.code).toBe("RATE_LIMITED");
      expect(result?.isRetryable).toBe(true);
    });

    it("should classify 429 errors as rate limiting", () => {
      const result = parseError("HTTP 429: Too many requests");
      expect(result?.code).toBe("RATE_LIMITED");
    });
  });

  describe("Content Policy", () => {
    it("should classify content policy as non-retryable", () => {
      const result = parseError("Content policy violation detected");
      expect(result?.code).toBe("CONTENT_POLICY");
      expect(result?.isRetryable).toBe(false);
    });

    it("should suggest editing prompt for policy violations", () => {
      const result = parseError("Prompt violates content guidelines");
      expect(result?.suggestion).toContain("Edit the prompt");
    });
  });

  describe("Production Incomplete", () => {
    it("should classify production incomplete as retryable", () => {
      const result = parseError("Production incomplete: Failed: 3, 5");
      expect(result?.code).toBe("PRODUCTION_INCOMPLETE");
      expect(result?.isRetryable).toBe(true);
    });

    it("should suggest Resume for incomplete production", () => {
      const result = parseError("Production incomplete. Some clips failed.");
      expect(result?.suggestion).toContain("Resume");
    });
  });

  describe("Model Errors", () => {
    it("should classify model errors as retryable with fallback", () => {
      const result = parseError("Model deprecated, use newer version");
      expect(result?.code).toBe("MODEL_ERROR");
      expect(result?.isRetryable).toBe(true);
      expect(result?.suggestion).toContain("fallback");
    });

    it("should classify 422 errors as model errors", () => {
      const result = parseError("HTTP 422: Unprocessable entity");
      expect(result?.code).toBe("MODEL_ERROR");
    });
  });

  describe("Timeout Errors", () => {
    it("should classify timeout as retryable", () => {
      const result = parseError("Request timed out after 30 seconds");
      expect(result?.code).toBe("TIMEOUT");
      expect(result?.isRetryable).toBe(true);
    });

    it("should mention server busy for timeouts", () => {
      const result = parseError("Connection timeout");
      expect(result?.suggestion).toContain("busy");
    });
  });

  describe("Unknown Errors", () => {
    it("should default to UNKNOWN for unrecognized errors", () => {
      const result = parseError("Some random unexpected error");
      expect(result?.code).toBe("UNKNOWN");
      expect(result?.isRetryable).toBe(true);
    });

    it("should return null for empty/null errors", () => {
      expect(parseError(null)).toBeNull();
      expect(parseError(undefined)).toBeNull();
      expect(parseError("")).toBeNull();
    });
  });
});
