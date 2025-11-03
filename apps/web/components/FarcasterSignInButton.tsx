"use client";

import { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { Button } from "@repo/ui/button";
import { useMiniApp } from "@neynar/react";

export function FarcasterSignInButton() {
  const { isSDKLoaded, context } = useMiniApp();
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    try {
      const inMiniApp = !!context?.client;
      setIsMiniApp(isSDKLoaded && inMiniApp);
      if (context?.user?.fid) {
        setIsSignedIn(true);
      }
    } catch {
      setIsMiniApp(false);
    }

    return () => {
      // no-op cleanup
    };
  }, [isSDKLoaded, context]);

  const handleSignIn = async () => {
    try {
      if (sdk?.actions?.signIn) {
        const now = new Date();
        await sdk.actions.signIn({
          nonce: crypto.randomUUID(),
          notBefore: now.toISOString(),
          expirationTime: new Date(now.getTime() + 5 * 60_000).toISOString(),
        });
      }
      setIsSignedIn(true);
    } catch (e) {
      // Ignore sign-in errors
    }
  };

  if (!isMiniApp || isSignedIn) return null;

  return (
    <Button variant="outline" onClick={handleSignIn}>
      Sign in with Farcaster
    </Button>
  );
}