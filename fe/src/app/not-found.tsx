import Link from "next/link";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[60vh] text-[#cccccc] font-sans">
      <div className="flex items-center gap-4 border-b border-[#333] pb-6 mb-6">
        <h1 className="text-5xl font-bold text-white border-r border-[#333] pr-4">404</h1>
        <div className="text-lg">This page could not be found.</div>
      </div>
      
      <p className="text-sm text-[#888] mb-6">
        The user or page you are looking for does not exist or has been removed.
      </p>
      
      <Link 
        href="/" 
        className="flex items-center gap-2 bg-[#21425e] hover:bg-[#29557b] text-white px-4 py-2 rounded-sm text-sm transition-colors shadow-sm"
      >
        <Home size={16} />
        Return to Homepage
      </Link>
    </div>
  );
}
