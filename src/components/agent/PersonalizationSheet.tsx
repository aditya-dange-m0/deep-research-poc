"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";


interface PersonalizationSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PersonalizationSheet({
  isOpen,
  onClose,
}: PersonalizationSheetProps) {
  // In a real app, this state would be fetched from and saved to your /api/agent/personalization endpoint.
  const [nickname, setNickname] = useState("");
  const [occupation, setOccupation] = useState("");
  const [profile, setProfile] = useState("");
  const [traits, setTraits] = useState<string[]>([]);

  const handleSave = () => {
    // Logic to POST data to your backend
    console.log("Saving personalization:", {
      nickname,
      occupation,
      profile,
      traits,
    });
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="bg-white border-gray-200">
        <SheetHeader>
          <SheetTitle className="text-2xl">Personalization</SheetTitle>
          <SheetDescription>
            Customize your agent's personality and how it interacts with you.
          </SheetDescription>
        </SheetHeader>
        {/* ... The rest of the form ... */}
      </SheetContent>
    </Sheet>
  );
}
