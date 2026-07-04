import { useRef } from "react";
import type { MessagesMap } from "../types/chat";

const DEFAULT_TYPING_SPEED_MS = 15;

interface UseTypingEffectOptions {
  speedMs?: number;
}

type SetMessagesFn = (
  updater: (prev: MessagesMap) => MessagesMap
) => void;

interface UseTypingEffectReturn {
  triggerTypingEffect: (
    fullText: string,
    messageId: string,
    sessionId: string,
    onComplete: () => void
  ) => void;
  cancelTyping: () => void;
}

export const useTypingEffect = (
  setMessagesBySession: SetMessagesFn,
  options: UseTypingEffectOptions = {}
): UseTypingEffectReturn => {
  const speedMs = options.speedMs ?? DEFAULT_TYPING_SPEED_MS;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cancelTyping = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const triggerTypingEffect = (
    fullText: string,
    messageId: string,
    sessionId: string,
    onComplete: () => void
  ) => {
    cancelTyping();

    if (speedMs === 0) {
      setMessagesBySession((prev) => {
        const sessionMsgs = prev[sessionId] || [];
        return {
          ...prev,
          [sessionId]: sessionMsgs.map((msg) =>
            msg.id === messageId
              ? { ...msg, displayedText: fullText, isFinished: true }
              : msg
          ),
        };
      });
      onComplete();
      return;
    }

    let index = 0;
    const interval = setInterval(() => {
      index += 2;
      if (index >= fullText.length) {
        clearInterval(interval);
        intervalRef.current = null;
        setMessagesBySession((prev) => {
          const sessionMsgs = prev[sessionId] || [];
          return {
            ...prev,
            [sessionId]: sessionMsgs.map((msg) =>
              msg.id === messageId
                ? { ...msg, displayedText: fullText, isFinished: true }
                : msg
            ),
          };
        });
        onComplete();
      } else {
        const chunk = fullText.slice(0, index);
        setMessagesBySession((prev) => {
          const sessionMsgs = prev[sessionId] || [];
          return {
            ...prev,
            [sessionId]: sessionMsgs.map((msg) =>
              msg.id === messageId ? { ...msg, displayedText: chunk } : msg
            ),
          };
        });
      }
    }, speedMs);

    intervalRef.current = interval;
  };

  return { triggerTypingEffect, cancelTyping };
};
