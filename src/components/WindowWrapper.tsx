'use client'; // <-- THIS IS THE FIX. It must be the very first line.

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Minus, Plus } from 'lucide-react';
import React from 'react';

interface WindowWrapperProps {
  title: string;
  icon: React.ReactNode;
  isMinimized: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}

export function WindowWrapper({ title, icon, isMinimized, onToggle, children, className }: WindowWrapperProps) {
  if (isMinimized) {
    return (
      <div className={`w-full max-w-3xl mx-auto ${className}`}>
        <Button variant="outline" onClick={onToggle} className="w-full justify-start text-lg p-6 animate-in fade-in duration-300">
          <Plus className="mr-3 h-5 w-5" />
          {title}
        </Button>
      </div>
    );
  }

  return (
    <Card className={`w-full max-w-3xl mx-auto animate-in fade-in duration-300 ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-3">
          {icon}
          <span>{title}</span>
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onToggle}>
          <Minus className="h-5 w-5" />
        </Button>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
}