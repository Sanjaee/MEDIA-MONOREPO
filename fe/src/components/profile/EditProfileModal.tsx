"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { X, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/utils/imageCompressor";
import { useRouter } from "next/navigation";

interface EditProfileModalProps {
  user: any;
  onClose: () => void;
}

export function EditProfileModal({ user, onClose }: EditProfileModalProps) {
  const router = useRouter();
  const [name, setName] = useState(user.name || "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState(user.image || "");
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type.startsWith("image/")) {
        setImageFile(file);
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        toast.error("Please select a valid image file");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", name);

      if (imageFile) {
        // Compress image before upload
        try {
          const compressedFile = await compressImage(imageFile, 800, 800, 0.8) as File;
          formData.append("image", compressedFile);
        } catch (err) {
          console.error("Compression failed:", err);
          formData.append("image", imageFile); // fallback to original
        }
      }

      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to update profile");
      }

      toast.success("Profile updated successfully!");
      router.refresh(); // Refresh page to see new data
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("An error occurred while updating profile");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#1b1b1b] border border-[#333] w-full max-w-md shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-[#333] bg-[#21425e]">
          <h2 className="text-white font-bold shadow-sm" style={{ textShadow: "1px 1px 1px #000" }}>Edit Profile</h2>
          <button 
            onClick={onClose}
            className="text-white hover:text-red-400 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          <div className="flex flex-col items-center gap-3">
            <label className="relative w-24 h-24 bg-black border border-[#333] group overflow-hidden cursor-pointer flex items-center justify-center block">
              {previewUrl ? (
                <Image
                  src={previewUrl}
                  alt="Preview"
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl bg-slate-800 text-white font-bold">
                  {name ? name.charAt(0).toUpperCase() : "U"}
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Upload size={20} className="text-white mb-1" />
                <span className="text-white text-[10px] font-bold">Change</span>
              </div>
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handleFileChange}
              />
            </label>
            <p className="text-[#888] text-[10px]">Click image to upload new avatar</p>
          </div>

          <div className="flex flex-col gap-1.5 mt-2">
            <label className="text-[#aaa] text-xs font-semibold">Display Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[#111] border border-[#333] p-2 text-white text-sm focus:outline-none focus:border-primary transition placeholder:text-[#555]"
              placeholder="Enter your name"
              required
            />
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-1.5 bg-[#333] hover:bg-[#444] text-white text-xs font-semibold transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-black text-xs font-bold transition flex items-center gap-1 disabled:opacity-50"
            >
              {isLoading && <Loader2 size={12} className="animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
