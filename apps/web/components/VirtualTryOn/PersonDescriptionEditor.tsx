"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import { Textarea } from "@repo/ui/textarea";
import { Sparkles, Edit3, Check, X, User } from "lucide-react";

interface PersonDescriptionEditorProps {
  description: string;
  onDescriptionChange: (description: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function PersonDescriptionEditor({
  description,
  onDescriptionChange,
  onConfirm,
  onCancel,
  loading = false
}: PersonDescriptionEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(description);

  const handleEdit = () => {
    setIsEditing(true);
    setEditText(description);
  };

  const handleSave = () => {
    onDescriptionChange(editText);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditText(description);
  };

  // Format the raw AI text for display
  const formatDescriptionForDisplay = (text: string) => {
    if (!text || text.trim() === '') {
      return (
        <div className="text-xs text-muted-foreground text-center py-4">
          No analysis data available. Please generate an analysis first.
        </div>
      );
    }

    const lines = text.split('\n').filter(line => line.trim() !== '');
    
    return (
      <div className="space-y-2">
        {lines.map((line, index) => {
          const trimmedLine = line.trim();
          if (trimmedLine === '') return null;
          
          // Check if line ends with a colon (category header)
          const isCategoryHeader = trimmedLine.endsWith(':');
          
          if (isCategoryHeader) {
            return (
              <div key={index} className="text-xs">
                <div className="font-medium text-primary">
                  {trimmedLine.replace(':', '')}
                </div>
              </div>
            );
          } 
          // Skip the introductory sentences
          else if (trimmedLine.startsWith('Based on the image provided') || 
                   trimmedLine.startsWith('This description should help')) {
            return (
              <div key={index} className="text-xs text-muted-foreground mb-2">
                {trimmedLine}
              </div>
            );
          }
          else {
            return (
              <div key={index} className="text-xs flex items-start">
                <span className="inline-block w-1 h-1 rounded-full bg-primary mt-1.5 mr-1.5"></span>
                <span className="text-muted-foreground">{trimmedLine}</span>
              </div>
            );
          }
        })}
      </div>
    );
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <User className="h-3.5 w-3.5 text-primary" />
          Person Analysis
        </CardTitle>
        <p className="text-xs text-muted-foreground -mt-1">
          AI has analyzed your photo. Review and edit if needed.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pb-3 pt-2">
        {isEditing ? (
          <div className="space-y-3">
            <div className="bg-background/20 rounded p-2 border border-primary/5">
              <Textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                placeholder="Enter person description..."
                className="min-h-40 text-xs border-none bg-transparent resize-none focus:ring-0 focus:border-none"
                rows={8}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={loading}
                className="h-6 px-2 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={loading}
                className="h-6 px-2 text-xs fashion-gradient text-white"
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="bg-background/20 rounded p-2 border border-primary/5">
              {formatDescriptionForDisplay(description)}
            </div>
            <div className="flex justify-between items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEdit}
                disabled={loading}
                className="h-6 px-1.5 py-0 text-xs hover:bg-transparent hover:text-primary"
              >
                <Edit3 className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCancel}
                  disabled={loading}
                  className="h-6 px-2 text-xs"
                >
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={onConfirm}
                  disabled={loading}
                  className="h-6 px-2 text-xs fashion-gradient text-white"
                >
                  {loading ? (
                    <div className="flex items-center gap-1">
                      <div className="animate-spin rounded-full h-2.5 w-2.5 border-b-2 border-white"></div>
                      <span className="text-xs">Generating...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <Sparkles className="h-2.5 w-2.5" />
                      <span className="text-xs">Generate Outfit</span>
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}