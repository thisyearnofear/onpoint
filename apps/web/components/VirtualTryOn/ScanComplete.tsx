"use client";

import React from "react";
import { Button } from "@repo/ui/button";
import { Card, CardContent } from "@repo/ui/card";
import { CheckCircle } from "lucide-react";

interface ScanCompleteProps {
  onReset: () => void;
  loading: boolean;
}

export function ScanComplete({ onReset, loading }: ScanCompleteProps) {
  return (
    <Card>
      <CardContent className="flex items-center justify-center py-8">
        <div className="text-center">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">
            Body Scan Complete
          </h3>
          <p className="text-muted-foreground mb-4">
            Your measurements have been analyzed and are ready for
            try-on
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={onReset}
            disabled={loading}
          >
            Start New Scan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}