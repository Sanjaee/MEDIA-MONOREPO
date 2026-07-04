"use client";

import { useState, useEffect } from "react";
import { getMyPendingAds, submitAdDetails } from "@/actions/ads.actions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, X } from "lucide-react";
import axios from "axios";

export default function AdsPage() {
  const [pendingAds, setPendingAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBuying, setIsBuying] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [currencies, setCurrencies] = useState<any[]>([]);

  const router = useRouter();

  // setup form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  useEffect(() => {
    getMyPendingAds().then((ads) => {
      setPendingAds(ads);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleBuyClick = async () => {
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
      const res = await axios.post("/api/payment/plisio/create", {
        role: "ad_slot_1d",
        currency
      });
      if (res.data.success && res.data.data.hostedUrl) {
        window.location.href = res.data.data.hostedUrl;
      } else {
        toast.error(res.data.error || "Failed to create invoice");
        setIsBuying(false);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to create invoice");
      setIsBuying(false);
    }
  };

  const handleSubmit = async (adId: string) => {
    if (!title || !imageUrl || !linkUrl) {
      toast.error("Please fill all required fields");
      return;
    }

    try {
      await submitAdDetails(adId, title, description, imageUrl, linkUrl);
      toast.success("Ad submitted successfully!");
      setPendingAds(prev => prev.filter(a => a.id !== adId));
      setTitle("");
      setDescription("");
      setImageUrl("");
      setLinkUrl("");
      
      if (pendingAds.length <= 1) {
        router.push("/");
      }
    } catch (e) {
      toast.error("Failed to submit ad");
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
      <div className="bg-[#16181c] border border-[#333c45] rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between mb-12 gap-6 hover:border-primary/50 transition-colors">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-6 h-6 text-pink-400" />
            <h2 className="text-2xl font-bold">1 Day Ad Slot</h2>
          </div>
          <ul className="text-sm text-gray-400 space-y-1 mb-4">
            <li>• Featured in the Right Sidebar slider</li>
            <li>• Reaches all active users</li>
            <li>• 1 Day duration</li>
          </ul>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold">$10</span>
            <span className="text-[#71767b] text-sm">/ slot</span>
          </div>
        </div>
        <button 
          onClick={handleBuyClick}
          disabled={isBuying}
          className="w-full md:w-auto px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition flex items-center justify-center gap-2 disabled:opacity-70"
        >
          {isBuying ? <Loader2 className="w-5 h-5 animate-spin" /> : "Purchase Slot"}
        </button>
      </div>

      {/* Setup Section */}
      {pendingAds.length > 0 && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm">{pendingAds.length}</span>
            Pending Ads to Setup
          </h2>
          
          <div className="bg-card border rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Configure Slot #{pendingAds[0].id.slice(-6)}</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Title *</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Catchy Ad Title" />
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <textarea 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  placeholder="Tell people why they should click..." 
                  className="w-full flex min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Image URL *</label>
                <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://example.com/image.png" />
                <p className="text-xs text-muted-foreground mt-1">Recommended aspect ratio: 16:9</p>
              </div>
              <div>
                <label className="text-sm font-medium">Link URL *</label>
                <Input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://yourwebsite.com" />
              </div>
              <Button onClick={() => handleSubmit(pendingAds[0].id)} className="w-full py-6 text-md font-bold">
                Submit Ad and Activate
              </Button>
            </div>
          </div>
          {pendingAds.length > 1 && (
            <p className="text-sm text-muted-foreground text-center mt-4">You have {pendingAds.length - 1} more pending slot(s) to setup after this one.</p>
          )}
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
            <p className="text-gray-400 text-sm mb-6">Choose your preferred cryptocurrency to complete the payment for the Ad Slot (1 Day) plan.</p>
            
            {isBuying && !currencies.length ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-white" />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {currencies.map(c => (
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
