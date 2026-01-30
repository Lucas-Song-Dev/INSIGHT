"""
Circuit Breaker Pattern Implementation
Prevents cascading failures by stopping requests to failing services
"""
import time
import logging
from threading import Lock

logger = logging.getLogger(__name__)


class CircuitBreakerOpenError(Exception):
    """Raised when circuit breaker is OPEN and request is rejected"""
    pass


class CircuitBreaker:
    """
    Circuit breaker implementation with three states:
    - CLOSED: Normal operation, requests pass through
    - OPEN: Service is failing, requests are rejected immediately
    - HALF_OPEN: Testing if service has recovered
    """
    
    def __init__(self, failure_threshold=5, timeout=60, expected_exception=Exception):
        """
        Initialize circuit breaker
        
        Args:
            failure_threshold: Number of failures before opening circuit
            timeout: Seconds to wait before attempting half-open
            expected_exception: Exception types that count as failures
        """
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.expected_exception = expected_exception
        self.failure_count = 0
        self.last_failure_time = None
        self.state = 'CLOSED'  # CLOSED, OPEN, HALF_OPEN
        self.lock = Lock()
        self.success_count = 0  # Track successes in HALF_OPEN state
    
    def reset(self):
        """Reset circuit breaker to CLOSED state"""
        with self.lock:
            self.state = 'CLOSED'
            self.failure_count = 0
            self.last_failure_time = None
            self.success_count = 0
            logger.info("Circuit breaker reset to CLOSED state")
    
    def record_failure(self):
        """Record a failure and update circuit breaker state"""
        with self.lock:
            self.failure_count += 1
            self.last_failure_time = time.time()
            
            if self.state == 'HALF_OPEN':
                # Failure in HALF_OPEN means service is still down
                self.state = 'OPEN'
                self.failure_count = self.failure_threshold
                logger.warning(f"Circuit breaker moved to OPEN state after failure in HALF_OPEN")
            elif self.failure_count >= self.failure_threshold:
                self.state = 'OPEN'
                logger.warning(
                    f"Circuit breaker opened after {self.failure_count} failures. "
                    f"Will attempt recovery in {self.timeout}s"
                )
    
    def record_success(self):
        """Record a success and update circuit breaker state"""
        with self.lock:
            if self.state == 'HALF_OPEN':
                self.success_count += 1
                # If we get a few successes, close the circuit
                if self.success_count >= 2:
                    self.reset()
                    logger.info("Circuit breaker closed after successful recovery")
            elif self.state == 'CLOSED':
                # Reset failure count on success
                self.failure_count = 0
    
    def call(self, func, *args, **kwargs):
        """
        Execute function with circuit breaker protection
        
        Args:
            func: Function to execute
            *args, **kwargs: Arguments to pass to function
            
        Returns:
            Function result
            
        Raises:
            CircuitBreakerOpenError: If circuit is OPEN
        """
        # Check if we should attempt recovery
        if self.state == 'OPEN':
            if self.last_failure_time and (time.time() - self.last_failure_time) > self.timeout:
                with self.lock:
                    if self.state == 'OPEN':  # Double-check after acquiring lock
                        self.state = 'HALF_OPEN'
                        self.success_count = 0
                        logger.info("Circuit breaker moved to HALF_OPEN state for recovery test")
            else:
                raise CircuitBreakerOpenError(
                    f"Circuit breaker is OPEN. Service unavailable. "
                    f"Retry after {self.timeout - (time.time() - self.last_failure_time):.0f}s"
                )
        
        # Execute function
        try:
            result = func(*args, **kwargs)
            self.record_success()
            return result
        except self.expected_exception as e:
            self.record_failure()
            raise
        except Exception as e:
            # Unexpected exception - don't count as failure but still raise
            logger.error(f"Unexpected exception in circuit breaker: {type(e).__name__}: {str(e)}")
            raise


# Global circuit breakers for external services
reddit_circuit_breaker = CircuitBreaker(failure_threshold=5, timeout=60)
claude_circuit_breaker = CircuitBreaker(failure_threshold=5, timeout=60)
openai_circuit_breaker = CircuitBreaker(failure_threshold=5, timeout=60)

