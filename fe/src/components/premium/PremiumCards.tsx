"use client";

import { useState } from "react";
import { UserNameWithRole } from "@/components/ui/UserNameWithRole";
import { Check, Sparkles, Shield, Star, Crown, Zap, X, Loader2, Search } from "lucide-react";
import axios from "axios";
import { toast } from "sonner";
import Image from "next/image";

const TIERS = [
  { 
    role: "vip", 
    price: "$1", 
    name: "VIP Member", 
    icon: <Star className="w-5 h-5 text-blue-400" />,
    features: ["Verified checkmark", "Basic analytics", "Custom profile colors"] 
  },
  { 
    role: "mvp", 
    price: "$1", 
    name: "MVP", 
    icon: <Zap className="w-5 h-5 text-yellow-400" />,
    features: ["Everything in VIP", "Profile Badge", "Increased upload limits"] 
  },
  { 
    role: "mod", 
    price: "$1", 
    name: "Moderator", 
    icon: <Shield className="w-5 h-5 text-green-400" />,
    features: ["Everything in MVP", "Mod Tools access", "Content management"] 
  },
  { 
    role: "god", 
    price: "$1", 
    name: "God", 
    icon: <Sparkles className="w-5 h-5 text-purple-400" />,
    features: ["Everything in Mod", "God Mode privileges", "Bypass all limits"] 
  }
];

export function PremiumCards({ userName }: { userName: string }) {
  const [selected, setSelected] = useState<string>("vip");
  const [isLoading, setIsLoading] = useState(false);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedRoleForPayment, setSelectedRoleForPayment] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  const handleSubscribeClick = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get("/api/payment/plisio/currencies");
      if (res.data.success) {
        setCurrencies(res.data.data);
        setSelectedRoleForPayment(selected);
        setShowModal(true);
      } else {
        toast.error(res.data.error || "Failed to load currencies");
      }
    } catch (error: any) {
      toast.error("Error loading crypto options");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCurrencySelect = async (currency: string) => {
    setIsLoading(true);
    try {
      const res = await axios.post("/api/payment/plisio/create", {
        role: selectedRoleForPayment,
        currency
      });
      if (res.data.success && res.data.data.hostedUrl) {
        window.location.href = res.data.data.hostedUrl;
      } else {
        toast.error(res.data.error || "Failed to create invoice");
        setIsLoading(false);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Failed to create invoice");
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full max-w-[1000px] justify-center mb-24 mt-8">
        {TIERS.map(tier => (
          <div 
            key={tier.role}
            onClick={() => setSelected(tier.role)}
            className={`bg-[#16181c] rounded-2xl p-6 flex flex-col relative border-2 cursor-pointer transition-all ${
              selected === tier.role 
                ? 'border-[#1d9bf0] shadow-[0_0_20px_rgba(29,155,240,0.3)] scale-[1.02]' 
                : 'border-transparent hover:border-[#333c45]'
            }`}
          >
            <div className="mb-6 border-b border-[#333] pb-4">
              <div className="flex items-center gap-2 mb-2">
                {tier.icon}
                <h2 className="text-xl font-bold">{tier.name}</h2>
              </div>
              <div className="text-sm text-gray-400 mb-4 bg-black/40 p-2 rounded-md">
                Preview: <UserNameWithRole displayName={userName} role={tier.role} className="inline-block text-base ml-1" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">{tier.price}</span>
                <span className="text-[#71767b] text-sm">/ mo</span>
              </div>
            </div>

            <ul className="flex flex-col gap-4 text-[14px] font-medium mt-auto">
              {tier.features.map((feat, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check className="text-[#1d9bf0] w-5 h-5 shrink-0" />
                  <span className="text-gray-300">{feat}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Bottom Fixed Checkout Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-black/90 backdrop-blur border-t border-[#2f3336] p-4 flex justify-center z-50">
        <div className="w-full max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="font-bold text-lg">{TIERS.find(t => t.role === selected)?.name} Tier</span>
            <span className="text-[#71767b] text-sm">{TIERS.find(t => t.role === selected)?.price} / month · Billed monthly</span>
          </div>
          
          <div className="flex flex-col w-full md:w-auto items-end gap-2">
            <button 
              onClick={handleSubscribeClick}
              disabled={isLoading}
              className="w-full md:w-[300px] flex items-center justify-center gap-2 bg-white hover:bg-gray-200 text-black font-bold py-3 rounded-full text-[15px] transition-colors disabled:opacity-70"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : `Subscribe to ${TIERS.find(t => t.role === selected)?.name}`}
            </button>
            <p className="text-[#71767b] text-[11px] max-w-md text-right leading-tight hidden md:block">
              By subscribing, you agree to our <span className="underline cursor-pointer text-white">Purchaser Terms</span>. Cancel anytime.
            </p>
          </div>
        </div>
      </div>

      {/* Crypto Selection Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#16181c] border border-[#333] rounded-2xl w-full max-w-md p-6 relative">
            <button 
              onClick={() => !isLoading && setShowModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white"
              disabled={isLoading}
            >
              <X className="w-6 h-6" />
            </button>
            
            <h2 className="text-2xl font-bold mb-2">Select Crypto</h2>
            <p className="text-gray-400 text-sm mb-6">Choose your preferred cryptocurrency to complete the payment for the {TIERS.find(t => t.role === selectedRoleForPayment)?.name} plan.</p>
            
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

            {isLoading && !currencies.length ? (
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
                    disabled={isLoading}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-[#333] hover:border-[#1d9bf0] hover:bg-[#1d9bf0]/10 transition-all disabled:opacity-50"
                  >
                    <img src={c.icon} alt={c.name} className="w-8 h-8" />
                    <span className="text-sm font-semibold">{c.name}</span>
                    <span className="text-xs text-gray-500">{c.currency}</span>
                  </button>
                ))}
              </div>
            )}
            
            {isLoading && currencies.length > 0 && (
              <div className="absolute inset-0 bg-[#16181c]/80 flex flex-col items-center justify-center rounded-2xl">
                <Loader2 className="w-10 h-10 animate-spin text-[#1d9bf0] mb-4" />
                <span className="font-medium text-white">Preparing checkout...</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
