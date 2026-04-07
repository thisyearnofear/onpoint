import React from "react";
import { Badge } from "@repo/ui/badge";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

interface ENSStatusProps {
  address: string;
  ensName?: string;
  isLoading?: boolean;
  error?: string;
}

export function ENSStatus({
  address,
  ensName,
  isLoading,
  error,
}: ENSStatusProps) {
  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Resolving ENS...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center space-x-2 text-sm text-orange-600">
        <AlertCircle className="w-4 h-4" />
        <span>
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
      </div>
    );
  }

  if (ensName) {
    return (
      <div className="flex items-center space-x-2">
        <CheckCircle className="w-4 h-4 text-green-500" />
        <span className="font-medium">{ensName}</span>
        <Badge variant="secondary" className="text-xs">
          ENS
        </Badge>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
      <span>
        {address.slice(0, 6)}...{address.slice(-4)}
      </span>
    </div>
  );
}
