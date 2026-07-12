"use client";

import { useState, useEffect } from "react";
import { getMyPendingAds, createPendingAdAction, createAdPaymentAction, getMyActiveAdsAction } from "@/actions/ads.actions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, X, Image as ImageIcon, Pencil, Trash2, Search } from "lucide-react";
import axios from "axios";
import { useRef } from "react";

export default function AdsPage() {
  const [pendingAds, setPendingAds] = useState<any[]>([]);
  const [activeAds, setActiveAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBuying, setIsBuying] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState("");

  const router = useRouter();

  const [title, setTitle] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState("image");
  const [linkUrl, setLinkUrl] = useState("");
  const [isSubmittingAd, setIsSubmittingAd] = useState(false);
  const [setupTimeLeft, setSetupTimeLeft] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editAd, setEditAd] = useState<any>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editLinkUrl, setEditLinkUrl] = useState("");
  const [editMediaFile, setEditMediaFile] = useState<File | null>(null);
  const [editMediaType, setEditMediaType] = useState("image");
  const [isEditing, setIsEditing] = useState(false);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (pendingAds.length === 0) return;
    const calculateTimeLeft = () => {
      const createdAt = new Date(pendingAds[0].createdAt).getTime();
      const deadline = createdAt + 24 * 60 * 60 * 1000;
      const difference = deadline - new Date().getTime();
      if (difference <= 0) return "Expired";
      
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);
      return `${hours}h ${minutes}m ${seconds}s left`;
    };

    setSetupTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setSetupTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [pendingAds]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setMediaFile(e.target.files[0]);
      // Auto-detect media type
      if (e.target.files[0].type.startsWith("video/")) {
        setMediaType("video");
      } else {
        setMediaType("image");
      }
    }
  };

  useEffect(() => {
    Promise.all([getMyPendingAds(), getMyActiveAdsAction()])
      .then(([pending, active]) => {
        setPendingAds(pending);
        setActiveAds(active);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleBuyClick = async (durationDays: number) => {
    setSelectedDuration(durationDays);
    setIsBuying(true);
    try {
      const res = await axios.get("/api/payment/plisio/currencies");
      if (res.data.success) {
        setCurrencies(res.data.data);
        setShowModal(true);
      } else {
        toast.error(res.data.error || "Failed to load currencies");
      }
    } catch (error: any) {
      toast.error("Error loading crypto options");
    } finally {
      setIsBuying(false);
    }
  };

  const handleCurrencySelect = async (currency: string) => {
    setIsBuying(true);
    try {
      // 1. Create pending ad with selected duration
      const pendingAd = await createPendingAdAction(selectedDuration);
      if (!pendingAd || !pendingAd.id) {
        toast.error("Failed to create pending ad");
        setIsBuying(false);
        return;
      }
      
      // 2. Create ad payment (all slots are $1 for demo)
      const paymentRes = await createAdPaymentAction(pendingAd.id, 1, currency);
      
      if (paymentRes.success && paymentRes.invoiceUrl) {
        window.location.href = paymentRes.invoiceUrl;
      } else {
        toast.error("Failed to create invoice");
        setIsBuying(false);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to create invoice");
      setIsBuying(false);
    }
  };

  const handleSubmit = async (adId: string) => {
    if (!title || !mediaFile || !linkUrl) {
      toast.error("Please fill all required fields and upload media");
      return;
    }

    setIsSubmittingAd(true);
    try {
      const formData = new FormData();
      formData.append("title", title);
      formData.append("linkUrl", linkUrl);
      formData.append("mediaType", mediaType);
      formData.append("media", mediaFile);

      const res = await fetch(`/api/ads/${adId}/setup`, {
        method: "PUT",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to submit ad");
      }

      toast.success("Ad submitted successfully!");
      
      // Move to active ads
      const newAd = pendingAds.find(a => a.id === adId);
      if (newAd) {
        setActiveAds(prev => [{...newAd, title, linkUrl, mediaType, imageUrl: URL.createObjectURL(mediaFile)}, ...prev]);
      }
      
      setPendingAds(prev => prev.filter(a => a.id !== adId));
      setTitle("");
      setMediaFile(null);
      setLinkUrl("");
      
      if (pendingAds.length <= 1) {
        // router.push("/");
      }
    } catch (e) {
      toast.error("Failed to submit ad");
    } finally {
      setIsSubmittingAd(false);
    }
  };

  const handleEditClick = (ad: any) => {
    setEditAd(ad);
    setEditTitle(ad.title || "");
    setEditLinkUrl(ad.linkUrl || "");
    setEditMediaType(ad.mediaType || "image");
    setEditMediaFile(null);
  };

  const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setEditMediaFile(e.target.files[0]);
      if (e.target.files[0].type.startsWith("video/")) {
        setEditMediaType("video");
      } else {
        setEditMediaType("image");
      }
    }
  };

  const handleEditSubmit = async () => {
    if (!editAd || !editTitle || !editLinkUrl) {
      toast.error("Please fill all required fields");
      return;
    }

    setIsEditing(true);
    try {
      const formData = new FormData();
      formData.append("title", editTitle);
      formData.append("linkUrl", editLinkUrl);
      formData.append("mediaType", editMediaType);
      if (editMediaFile) {
        formData.append("media", editMediaFile);
      }

      const res = await fetch(`/api/ads/${editAd.id}`, {
        method: "PUT",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to edit ad");
      }

      toast.success("Ad updated successfully!");
      
      // Update local state
      setActiveAds(prev => prev.map(ad => {
        if (ad.id === editAd.id) {
          return {
            ...ad,
            title: editTitle,
            linkUrl: editLinkUrl,
            mediaType: editMediaType,
            imageUrl: editMediaFile ? URL.createObjectURL(editMediaFile) : ad.imageUrl
          };
        }
        return ad;
      }));
      setEditAd(null);
    } catch (e) {
      toast.error("Failed to update ad");
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteAd = async (adId: string) => {
    if (!confirm("Are you sure you want to delete this ad? It cannot be undone.")) return;
    
    try {
      const res = await fetch(`/api/ads/${adId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Failed to delete ad");
      }

      toast.success("Ad deleted successfully!");
      setActiveAds(prev => prev.filter(ad => ad.id !== adId));
    } catch (e) {
      toast.error("Failed to delete ad");
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-64px)] w-full items-center justify-center">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 w-full pt-12 pb-24">
      <h1 className="text-3xl font-bold mb-2">Premium Ad Slots</h1>
      <p className="text-muted-foreground mb-8">Feature your content in the right sidebar to reach all active users.</p>

      {/* Buy Ad Slot Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {/* 1 Day Slot */}
        <div className="bg-[#16181c] border border-[#333c45] rounded-2xl p-6 flex flex-col items-center text-center gap-4 hover:border-primary/50 transition-colors">
          <Sparkles className="w-8 h-8 text-pink-400" />
          <h2 className="text-xl font-bold">1 Day Slot</h2>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-bold">$1</span>
            <span className="text-[#71767b] text-sm">/ slot</span>
          </div>
          <p className="text-sm text-gray-400 mb-4">Featured for 24 hours.</p>
          <button 
            onClick={() => handleBuyClick(1)}
            disabled={isBuying}
            className="w-full py-2 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition disabled:opacity-70"
          >
            {isBuying && selectedDuration === 1 ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Purchase"}
          </button>
        </div>

        {/* 3 Days Slot */}
        <div className="bg-[#16181c] border border-primary rounded-2xl p-6 flex flex-col items-center text-center gap-4 hover:border-primary transition-colors relative">
          <div className="absolute -top-3 bg-primary text-white text-xs font-bold px-3 py-1 rounded-full">POPULAR</div>
          <Sparkles className="w-8 h-8 text-blue-400" />
          <h2 className="text-xl font-bold">3 Days Slot</h2>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-bold">$1</span>
            <span className="text-[#71767b] text-sm">/ slot (Demo)</span>
          </div>
          <p className="text-sm text-gray-400 mb-4">Featured for 3 days.</p>
          <button 
            onClick={() => handleBuyClick(3)}
            disabled={isBuying}
            className="w-full py-2 bg-primary text-white font-bold rounded-full hover:bg-primary/90 transition disabled:opacity-70"
          >
            {isBuying && selectedDuration === 3 ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Purchase"}
          </button>
        </div>

        {/* 7 Days Slot */}
        <div className="bg-[#16181c] border border-[#333c45] rounded-2xl p-6 flex flex-col items-center text-center gap-4 hover:border-primary/50 transition-colors">
          <Sparkles className="w-8 h-8 text-purple-400" />
          <h2 className="text-xl font-bold">7 Days Slot</h2>
          <div className="flex items-baseline gap-1 mt-2">
            <span className="text-3xl font-bold">$1</span>
            <span className="text-[#71767b] text-sm">/ slot (Demo)</span>
          </div>
          <p className="text-sm text-gray-400 mb-4">Featured for 7 days.</p>
          <button 
            onClick={() => handleBuyClick(7)}
            disabled={isBuying}
            className="w-full py-2 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition disabled:opacity-70"
          >
            {isBuying && selectedDuration === 7 ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Purchase"}
          </button>
        </div>
      </div>

      {/* Setup Section */}
      {pendingAds.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm">{pendingAds.length}</span>
            Pending Ads to Setup
          </h2>
          
          <div className="bg-card border rounded-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Configure Slot #{pendingAds[0].id.slice(-6)}</h3>
              {setupTimeLeft && (
                <div className="bg-orange-500/10 text-orange-500 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2">
                  <span>⏱</span>
                  {setupTimeLeft}
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title *</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Catchy Ad Title" />
              </div>
              <div>
                <label className="text-sm font-medium">Media Upload *</label>
                <div className="mt-2 border-2 border-dashed border-[#333] rounded-xl p-4 flex flex-col items-center justify-center bg-[#16181c]/50 relative overflow-hidden group">
                  {mediaFile ? (
                    <div className="relative w-full aspect-video flex items-center justify-center bg-black rounded-lg overflow-hidden">
                      {mediaType === "video" ? (
                        <video src={URL.createObjectURL(mediaFile)} controls className="w-full h-full object-contain" />
                      ) : (
                        <img src={URL.createObjectURL(mediaFile)} alt="Preview" className="w-full h-full object-contain" />
                      )}
                      <button 
                        onClick={() => setMediaFile(null)}
                        className="absolute top-2 right-2 bg-black/70 text-white p-1.5 rounded-full hover:bg-black"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="py-8 flex flex-col items-center text-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      <div className="w-12 h-12 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                      <p className="font-medium text-sm">Click to upload media</p>
                      <p className="text-xs text-muted-foreground mt-1">Recommended 16:9. Max 5MB image, 20MB video (max 30s).</p>
                    </div>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect} 
                    className="hidden" 
                    accept="image/*,video/*"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Link URL *</label>
                <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://yourwebsite.com" />
              </div>
              <Button 
                onClick={() => handleSubmit(pendingAds[0].id)} 
                disabled={isSubmittingAd}
                className="w-full py-6 text-md font-bold"
              >
                {isSubmittingAd ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Ad and Activate"}
              </Button>
            </div>
          </div>
          {pendingAds.length > 1 && (
            <p className="text-sm text-muted-foreground text-center mt-4">You have {pendingAds.length - 1} more pending slot(s) to setup after this one.</p>
          )}
        </div>
      )}

      {/* Active Ads Section */}
      {activeAds.length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            Your Active Ads
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeAds.map(ad => (
              <div key={ad.id} className="bg-card border rounded-xl overflow-hidden flex flex-col">
                <div className="aspect-video bg-black relative">
                  {ad.mediaType === "video" ? (
                    <video src={ad.imageUrl} autoPlay muted loop className="w-full h-full object-cover" />
                  ) : (
                    <img src={ad.imageUrl} alt={ad.title} className="w-full h-full object-cover" />
                  )}
                  <div className="absolute top-2 right-2 flex gap-2">
                    <button onClick={() => handleEditClick(ad)} className="bg-black/70 hover:bg-black text-white p-2 rounded-full transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteAd(ad.id)} className="bg-red-500/70 hover:bg-red-600 text-white p-2 rounded-full transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-lg leading-tight mb-1">{ad.title}</h3>
                    <a href={ad.linkUrl} target="_blank" className="text-xs text-primary hover:underline line-clamp-1 break-all">{ad.linkUrl}</a>
                  </div>
                  <div className="mt-4 pt-4 border-t flex justify-between items-center text-xs text-muted-foreground">
                    <span>Active until: {new Date(ad.activeUntil).toLocaleDateString()}</span>
                    <span className="bg-green-500/10 text-green-500 font-bold px-2 py-0.5 rounded-full">Active</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Ad Modal */}
      {editAd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#16181c] border border-[#333] rounded-2xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button 
              onClick={() => !isEditing && setEditAd(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white z-10"
              disabled={isEditing}
            >
              <X className="w-6 h-6" />
            </button>
            
            <h2 className="text-2xl font-bold mb-6">Edit Ad Slot</h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title *</label>
                <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Catchy Ad Title" />
              </div>
              
              <div>
                <label className="text-sm font-medium">Media Upload (Optional)</label>
                <div className="mt-2 border-2 border-dashed border-[#333] rounded-xl p-4 flex flex-col items-center justify-center bg-[#16181c]/50 relative overflow-hidden group">
                  {editMediaFile || editAd.imageUrl ? (
                    <div className="relative w-full aspect-video flex items-center justify-center bg-black rounded-lg overflow-hidden">
                      {(editMediaFile ? editMediaType === "video" : editAd.mediaType === "video") ? (
                        <video src={editMediaFile ? URL.createObjectURL(editMediaFile) : editAd.imageUrl} controls className="w-full h-full object-contain" />
                      ) : (
                        <img src={editMediaFile ? URL.createObjectURL(editMediaFile) : editAd.imageUrl} alt="Preview" className="w-full h-full object-contain" />
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button 
                          onClick={() => editFileInputRef.current?.click()}
                          className="bg-primary text-primary-foreground px-4 py-2 rounded-full font-bold text-sm"
                        >
                          Change Media
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 flex flex-col items-center text-center cursor-pointer" onClick={() => editFileInputRef.current?.click()}>
                      <div className="w-12 h-12 bg-primary/20 text-primary rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                      <p className="font-medium text-sm">Click to change media</p>
                    </div>
                  )}
                  <input 
                    type="file" 
                    ref={editFileInputRef} 
                    onChange={handleEditFileSelect} 
                    className="hidden" 
                    accept="image/*,video/*"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">Link URL *</label>
                <Input value={editLinkUrl} onChange={e => setEditLinkUrl(e.target.value)} placeholder="https://yourwebsite.com" />
              </div>
              
              <div className="pt-4 flex gap-3">
                <Button 
                  onClick={() => setEditAd(null)}
                  variant="outline"
                  className="flex-1"
                  disabled={isEditing}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleEditSubmit} 
                  disabled={isEditing}
                  className="flex-1 font-bold"
                >
                  {isEditing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Crypto Selection Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#16181c] border border-[#333] rounded-2xl w-full max-w-md p-6 relative">
            <button 
              onClick={() => !isBuying && setShowModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
              disabled={isBuying}
            >
              <X className="w-6 h-6" />
            </button>
            
            <h2 className="text-2xl font-bold mb-2">Select Crypto</h2>
            <p className="text-gray-400 text-sm mb-6">Choose your preferred cryptocurrency to complete the payment for the Ad Slot ({selectedDuration} Day{selectedDuration > 1 ? 's' : ''}) plan.</p>
            
            {currencies.length > 0 && (
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input 
                    type="text" 
                    placeholder="Search cryptocurrency..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-[#202327] border border-[#333] rounded-xl text-sm outline-none focus:border-[#1d9bf0] transition-colors text-white"
                  />
                </div>
              </div>
            )}

            {isBuying && !currencies.length ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-white" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {currencies
                  .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.currency.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(c => (
                  <button
                    key={c.cid}
                    onClick={() => handleCurrencySelect(c.currency)}
                    disabled={isBuying}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-[#333] hover:border-[#1d9bf0] hover:bg-[#1d9bf0]/10 transition-all disabled:opacity-50"
                  >
                    <img src={c.icon} alt={c.name} className="w-8 h-8" />
                    <span className="text-sm font-semibold">{c.name}</span>
                    <span className="text-xs text-gray-500">{c.currency}</span>
                  </button>
                ))}
              </div>
            )}
            
            {isBuying && currencies.length > 0 && (
              <div className="absolute inset-0 bg-[#16181c]/80 flex flex-col items-center justify-center rounded-2xl">
                <Loader2 className="w-10 h-10 animate-spin text-[#1d9bf0] mb-4" />
                <span className="font-medium text-white">Preparing checkout...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
