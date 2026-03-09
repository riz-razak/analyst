/**
 * SessionManager - Collaborative Editing Session Handler
 * Manages locks, autosave, heartbeats, and handoff
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export function useCollaborativeSession(dossierId, userId, userEmail) {
  const [sessionState, setSessionState] = useState({
    lock: null,
    sessionId: null,
    isLocked: false,
    lockedByOther: false,
    lockOwner: null,
    timeRemaining: null,
    draft: null,
    isDirty: false,
    isSaving: false,
    error: null,
    warnings: [],
  });

  const [isEditing, setIsEditing] = useState(false);
  const heartbeatInterval = useRef(null);
  const autosaveInterval = useRef(null);
  const statusCheckInterval = useRef(null);
  const inactivityTimer = useRef(null);
  const contentRef = useRef('');

  const AUTOSAVE_INTERVAL = 30 * 1000; // 30 seconds
  const HEARTBEAT_INTERVAL = 20 * 1000; // 20 seconds
  const STATUS_CHECK_INTERVAL = 5 * 1000; // 5 seconds
  const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  /**
   * Acquire lock for this dossier
   */
  const acquireLock = useCallback(async () => {
    try {
      const response = await fetch('/api/session/acquire-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dossierId,
          userId,
          userEmail,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 409) {
          // Lock held by another user
          setSessionState((prev) => ({
            ...prev,
            lockedByOther: true,
            lockOwner: error.lock,
            error: `Locked by ${error.lock.userEmail}`,
            timeRemaining: error.timeRemainingMs,
          }));
          return false;
        }
        throw new Error(error.error);
      }

      const { lock } = await response.json();
      setSessionState((prev) => ({
        ...prev,
        lock,
        sessionId: lock.sessionId,
        isLocked: true,
        lockedByOther: false,
        error: null,
      }));

      // Start heartbeat and autosave
      startHeartbeat(lock.sessionId);
      startAutosave(lock.sessionId);
      startStatusCheck();

      return true;
    } catch (error) {
      setSessionState((prev) => ({
        ...prev,
        error: `Failed to acquire lock: ${error.message}`,
      }));
      return false;
    }
  }, [dossierId, userId, userEmail]);

  /**
   * Release lock
   */
  const releaseLock = useCallback(async () => {
    if (!sessionState.sessionId) return;

    try {
      clearInterval(heartbeatInterval.current);
      clearInterval(autosaveInterval.current);
      clearInterval(statusCheckInterval.current);

      await fetch('/api/session/release-lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dossierId,
          sessionId: sessionState.sessionId,
        }),
      });

      setSessionState((prev) => ({
        ...prev,
        lock: null,
        sessionId: null,
        isLocked: false,
        isDirty: false,
      }));

      setIsEditing(false);
    } catch (error) {
      console.error('Failed to release lock:', error);
    }
  }, [dossierId, sessionState.sessionId]);

  /**
   * Send heartbeat to keep lock alive
   */
  const startHeartbeat = (sessionId) => {
    const sendHeartbeat = async () => {
      try {
        await fetch('/api/session/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dossierId,
            sessionId,
          }),
        });
      } catch (error) {
        console.error('Heartbeat failed:', error);
      }
    };

    heartbeatInterval.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
  };

  /**
   * Check session status and warn on timeout
   */
  const startStatusCheck = () => {
    const checkStatus = async () => {
      try {
        const response = await fetch(
          `/api/session/status?dossierId=${dossierId}`
        );
        const { lock } = await response.json();

        if (!lock) {
          setSessionState((prev) => ({
            ...prev,
            isLocked: false,
            error: 'Lock lost unexpectedly',
          }));
          return;
        }

        const timeRemaining = lock.timeRemainingMs;

        // Warn at 4m 45s (15 seconds before timeout)
        if (timeRemaining > 0 && timeRemaining < 15 * 1000) {
          setSessionState((prev) => ({
            ...prev,
            timeRemaining,
            warnings: ['Lock expiring soon. Your work will be auto-saved.'],
          }));
        } else if (timeRemaining > 15 * 1000) {
          setSessionState((prev) => ({
            ...prev,
            timeRemaining,
            warnings: [],
          }));
        }
      } catch (error) {
        console.error('Status check failed:', error);
      }
    };

    statusCheckInterval.current = setInterval(checkStatus, STATUS_CHECK_INTERVAL);
  };

  /**
   * Autosave draft
   */
  const startAutosave = (sessionId) => {
    const save = async () => {
      if (!sessionState.isDirty) return;

      try {
        setSessionState((prev) => ({ ...prev, isSaving: true }));

        const response = await fetch('/api/session/autosave', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dossierId,
            sessionId,
            content: contentRef.current,
            metadata: {
              editedAt: Date.now(),
              editor: userEmail,
            },
          }),
        });

        if (!response.ok) {
          throw new Error('Autosave failed');
        }

        setSessionState((prev) => ({
          ...prev,
          isDirty: false,
          isSaving: false,
        }));
      } catch (error) {
        console.error('Autosave error:', error);
        setSessionState((prev) => ({
          ...prev,
          error: `Autosave failed: ${error.message}`,
          isSaving: false,
        }));
      }
    };

    autosaveInterval.current = setInterval(save, AUTOSAVE_INTERVAL);
  };

  /**
   * Handle content changes
   */
  const handleContentChange = (newContent) => {
    contentRef.current = newContent;
    setSessionState((prev) => ({
      ...prev,
      isDirty: true,
    }));

    // Reset inactivity timer
    clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      console.warn('User inactive for 5 minutes');
      // UI will show warning about lock expiring
    }, INACTIVITY_TIMEOUT);
  };

  /**
   * Publish current draft
   */
  const publishDraft = useCallback(async (message = '') => {
    if (!sessionState.sessionId) {
      setSessionState((prev) => ({
        ...prev,
        error: 'No active session',
      }));
      return false;
    }

    try {
      // Autosave before publish
      await fetch('/api/session/autosave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dossierId,
          sessionId: sessionState.sessionId,
          content: contentRef.current,
        }),
      });

      // Publish
      const response = await fetch('/api/session/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dossierId,
          sessionId: sessionState.sessionId,
          message: message || `Published by ${userEmail}`,
        }),
      });

      if (!response.ok) {
        throw new Error('Publish failed');
      }

      setSessionState((prev) => ({
        ...prev,
        isDirty: false,
        isLocked: false,
        draft: null,
      }));

      await releaseLock();
      return true;
    } catch (error) {
      setSessionState((prev) => ({
        ...prev,
        error: `Publish error: ${error.message}`,
      }));
      return false;
    }
  }, [dossierId, sessionState.sessionId, userEmail, releaseLock]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      clearInterval(heartbeatInterval.current);
      clearInterval(autosaveInterval.current);
      clearInterval(statusCheckInterval.current);
      clearTimeout(inactivityTimer.current);
    };
  }, []);

  return {
    sessionState,
    isEditing,
    setIsEditing,
    acquireLock,
    releaseLock,
    handleContentChange,
    publishDraft,
  };
}

/**
 * SessionIndicator Component
 * Shows lock status, who's editing, time remaining
 */
export function SessionIndicator({ sessionState, dossierId }) {
  const formatTime = (ms) => {
    if (!ms) return '';
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (sessionState.lockedByOther) {
    return (
      <div className="session-indicator locked-by-other">
        <div className="session-icon">🔒</div>
        <div className="session-details">
          <div className="session-status">Locked by {sessionState.lockOwner?.userEmail}</div>
          <div className="session-time">
            Available in {formatTime(sessionState.timeRemaining)}
          </div>
        </div>
      </div>
    );
  }

  if (sessionState.isLocked) {
    return (
      <div className="session-indicator locked">
        <div className="session-icon">✏️</div>
        <div className="session-details">
          <div className="session-status">
            {sessionState.isDirty ? '⚡ Editing' : '✓ Locked'}
          </div>
          {sessionState.isSaving && <div className="session-meta">Saving...</div>}
          {sessionState.timeRemaining && sessionState.timeRemaining < 60 * 1000 && (
            <div className="session-warning">
              Expiring in {formatTime(sessionState.timeRemaining)}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="session-indicator available">
      <div className="session-icon">📝</div>
      <div className="session-status">Ready to edit</div>
    </div>
  );
}

/**
 * SessionWarnings Component
 * Shows warnings and errors
 */
export function SessionWarnings({ warnings, error }) {
  if (!warnings?.length && !error) return null;

  return (
    <div className="session-warnings">
      {error && <div className="session-error">⚠️ {error}</div>}
      {warnings?.map((warning, idx) => (
        <div key={idx} className="session-warning">
          ⚠️ {warning}
        </div>
      ))}
    </div>
  );
}
