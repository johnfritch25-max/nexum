/**
 * useConversationTransition.ts
 *
 * Manages a CSS class-based transition when the active conversation changes.
 * Returns a `transitionKey` that changes on each switch (forces React to
 * remount the panel with the entrance animation) and a `isTransitioning`
 * flag that applies the slide-in class.
 */

import { useState, useEffect, useRef } from 'react';

export function useConversationTransition(activeFriendId: number | null) {
    const [transitionKey, setTransitionKey] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const prevIdRef = useRef<number | null>(null);

    useEffect(() => {
        if (activeFriendId !== prevIdRef.current && prevIdRef.current !== null) {
            // Trigger the slide-in animation
            setIsTransitioning(true);
            setTransitionKey((k) => k + 1);

            const timer = setTimeout(() => setIsTransitioning(false), 220);
            return () => clearTimeout(timer);
        }
        prevIdRef.current = activeFriendId;
    }, [activeFriendId]);

    return { transitionKey, isTransitioning };
}
