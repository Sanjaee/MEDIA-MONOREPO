"use client";

import { useState, useEffect, useRef } from "react";
import { withdrawEarningsAction } from "@/actions/product.actions";
import { getPlisioCurrenciesAction } from "@/actions/ads.actions";
import { X, Wallet, Loader2, AlertCircle, ChevronDown, Search } from "lucide-react";
import { useRouter } from "next/navigation";

interface WithdrawModalProps {
  availableBalance: number;
  isOpen: boolean;
  onClose: () => void;
}

export function WithdrawModal({ availableBalance, isOpen, onClose }: WithdrawModalProps) {
  const router = useRouter();
  const [asset, setAsset] = useState("USDT_TRX");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Dynamic Currencies State
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && currencies.length === 0) {
      getPlisioCurrenciesAction()
        .then(data => setCurrencies(data))
        .catch(err => console.error("Failed to load currencies:", err));
    }
    if (!isOpen) {
      setSuccess(false);
      setError("");
      setAmount("");
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const filteredCurrencies = currencies.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.currency.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const selectedCurrencyObj = currencies.find(c => c.currency === asset);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const numAmount = parseFloat(amount);
    const minWithdrawal = (availableBalance > 0 && availableBalance < 1) ? availableBalance : 1;
    if (isNaN(numAmount) || numAmount < minWithdrawal) {
      setError(`Minimum withdrawal amount is $${minWithdrawal.toFixed(2)}`);
      return;
    }

    if (numAmount > availableBalance) {
      setError("Insufficient balance");
      return;
    }

    if (!address.trim()) {
      setError("Please enter a valid withdrawal address");
      return;
    }

    setLoading(true);
    const res = await withdrawEarningsAction(asset, address, numAmount);
    setLoading(false);

    if (res.success) {
      setSuccess(true);
      setTimeout(() => {
        onClose();
        router.refresh();
      }, 2000);
    } else {
      setError(res.error || "Something went wrong.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Withdraw Funds
          </h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:bg-muted rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {success ? (
            <div className="bg-green-500/10 text-green-500 p-4 rounded-xl text-center border border-green-500/20">
              <h3 className="font-bold text-lg mb-1">Withdrawal Initiated!</h3>
              <p className="text-sm">Your funds are on the way. You can check the status on the blockchain shortly.</p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5 relative" ref={dropdownRef}>
                <label className="text-sm font-medium">Asset / Network</label>
                <div 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full p-3 bg-muted/50 border rounded-xl flex items-center justify-between cursor-pointer hover:border-primary/50 transition-all"
                >
                  {selectedCurrencyObj ? (
                    <div className="flex items-center gap-2">
                      <img src={selectedCurrencyObj.icon} alt={selectedCurrencyObj.name} className="w-5 h-5" />
                      <span>{selectedCurrencyObj.name} ({selectedCurrencyObj.currency})</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Select a currency...</span>
                  )}
                  <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                </div>

                {isDropdownOpen && (
                  <div className="absolute top-[70px] left-0 w-full bg-card border rounded-xl shadow-lg z-50 overflow-hidden flex flex-col">
                    <div className="p-2 border-b bg-muted/30">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input 
                          type="text" 
                          placeholder="Search asset..." 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 bg-background border rounded-lg text-sm outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto">
                      {filteredCurrencies.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">No assets found.</div>
                      ) : (
                        filteredCurrencies.map(c => (
                          <div 
                            key={c.currency}
                            onClick={() => {
                              setAsset(c.currency);
                              setIsDropdownOpen(false);
                              setSearchQuery("");
                            }}
                            className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer transition-colors border-b last:border-0"
                          >
                            <img src={c.icon} alt={c.name} className="w-6 h-6" />
                            <div>
                              <p className="font-medium text-sm">{c.name}</p>
                              <p className="text-xs text-muted-foreground">{c.currency}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Withdrawal Address</label>
                <input 
                  type="text" 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Paste your wallet address here"
                  className="w-full p-3 bg-muted/50 border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-end">
                  <label className="text-sm font-medium">Amount (USD)</label>
                  <span className="text-xs text-muted-foreground">Available: ${availableBalance.toFixed(2)}</span>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <input 
                    type="number" 
                    step="0.01"
                    min={availableBalance > 0 && availableBalance < 1 ? availableBalance : 1}
                    max={availableBalance}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={(availableBalance > 0 && availableBalance < 1 ? availableBalance : 1).toFixed(2)}
                    className="w-full p-3 pl-8 bg-muted/50 border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setAmount(availableBalance.toFixed(2))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-primary hover:text-primary/80"
                  >
                    MAX
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Minimum withdrawal: ${(availableBalance > 0 && availableBalance < 1 ? availableBalance : 1).toFixed(2)}</p>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 text-red-500 text-sm rounded-xl flex items-start gap-2 border border-red-500/20">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={loading || availableBalance <= 0 || !amount || parseFloat(amount) < (availableBalance > 0 && availableBalance < 1 ? availableBalance : 1) || parseFloat(amount) > availableBalance}
                  className="w-full py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm Withdrawal"}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
